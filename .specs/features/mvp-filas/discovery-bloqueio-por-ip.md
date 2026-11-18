# Discovery: contar tentativas por IP (2026-11-18)

Pergunta (NC5, item c): hoje 5 senhas erradas bloqueiam o login por 15 minutos, e quem sabe um login ("gestor", "recepcao") consegue mantê-lo bloqueado errando de propósito. Contar por IP resolve? E uma VPN não fura isso?

Fontes no fim. É pesquisa de mesa somada à leitura do código do better-auth; nada foi medido em produção.

## 1. O que muda o jogo

- **A equipe de uma UBS sai pelo mesmo IP.** A rede da prefeitura costuma passar por um NAT, então todos os computadores da unidade aparecem com o mesmo IP. Bloquear "o IP" depois de erros bloquearia a UBS inteira: basta uma pessoa errar várias vezes ou um computador infectado.
- **O celular do paciente também divide IP.** As operadoras móveis usam CGNAT: milhares de clientes atrás de um IP. A Cloudflare mediu que IPs de CGNAT sofrem limite de taxa cerca de 3 vezes mais que os outros, mesmo com tráfego humano, e o Brasil está entre os países com mais CGNAT.
- **IPv6 é metade do Brasil.** Cerca de 50% dos acessos já usam IPv6. Cada cliente recebe um bloco inteiro (/64) e pode trocar de endereço à vontade dentro dele, então é preciso contar pelo bloco /64, não pelo endereço.
- **A VPN fura a contagem só por IP**, como você disse. Proxies residenciais e botnets também: cada tentativa sai de um IP novo, a contagem por IP nunca chega a 5, e a OWASP registra que limites por IP não seguram ataques distribuídos.
- **Hoje a API não sabe o IP real.** Atrás de um proxy reverso (Caddy ou nginx), o IP vem no cabeçalho `X-Forwarded-For`, que o cliente pode forjar se a API não souber em qual proxy confiar. Sem essa configuração, contar por IP seria inútil, porque o atacante inventaria um IP por pedido.

**Achado à parte, que vale corrigir já:** o limitador do próprio better-auth, que vem ligado em produção, procura o IP no `X-Forwarded-For`. Sem `advanced.ipAddress.trustedProxies` configurado, ele não acha um IP confiável e cai num **balde único por rota** (aviso no código: "falling back to a single shared per-path bucket"). Na rota de login, o limite padrão vira 3 tentativas a cada 10 segundos **para todo mundo junto**. Em produção, numa manhã de UBS, gente legítima receberia 429.

## 2. Opções

| Opção | Ataque de bloqueio de propósito | Adivinhação distribuída (VPN, botnet) | Efeito colateral |
| --- | --- | --- | --- |
| **Só por login (hoje)** | Funciona contra nós: o atacante bloqueia o "gestor" | Segura: 5 tentativas no total | O usuário legítimo fica de fora |
| **Só por IP** | Resolve: o atacante bloqueia só a si mesmo | Não segura: cada IP da VPN tem 5 tentativas novas | Bloqueia a UBS inteira (NAT) ou vizinhos de operadora (CGNAT) |
| **Par (login, IP)** | Resolve: o atacante bloqueia só o par dele; o gestor, no IP da UBS, entra | Não segura sozinho | Pouco: só quem erra no mesmo IP e no mesmo login |
| **Par (login, IP) + teto por login que pede captcha** | Resolve | Segura: passado o teto (ex.: 30 erros por hora no login, somando todos os IPs), **todo mundo** precisa resolver o captcha para tentar; o robô para e a pessoa resolve e entra | Só quem tenta o login atacado vê o captcha, enquanto durar o ataque |
| **Dispositivo conhecido** (cookie do aparelho, OWASP) | Resolve: o navegador ou o app que já entrou antes tem contagem própria e passa por cima do bloqueio do atacante | Segura: o atacante não tem o cookie | Nenhum; complementa as outras |

## 3. E a VPN?

Com o desenho recomendado, a VPN deixa de ajudar o atacante nos dois casos:
- **Para adivinhar a senha:** trocar de IP zera só o par dele. O teto por login soma todos os IPs, e passado o teto o login pede captcha, que a VPN não resolve.
- **Para bloquear o gestor:** o atacante bloqueia o próprio par em cada IP da VPN, nunca o par do gestor. Se ele forçar o teto, o efeito é o gestor ver um captcha, não ficar sem entrar.

## 4. Recomendação

1. **Já, independente do resto:** configurar o IP confiável. São três coisas:
   - o `trustProxy` do Fastify apontando para o proxy da VPS;
   - `advanced.ipAddress.trustedProxies` no better-auth;
   - `ipv6Subnet: 64`.

   Isso corrige o balde único do limitador do better-auth e é pré-requisito de qualquer contagem por IP.
2. **Bloqueio pelo par (login, IP)**, com IPv4 inteiro e IPv6 por /64: 5 erros bloqueiam o par por 15 minutos. Substitui a contagem só por login.
3. **Teto por login somando os IPs** (ex.: 30 erros por hora). Passado o teto, o login passa a **pedir captcha**, não a bloquear. Depende do [captcha](discovery-captcha.md); até ele existir, passado o teto o login bloqueia, que é o comportamento de hoje, só que muito mais difícil de atingir.
4. **Depois, se valer:** cookie de dispositivo conhecido. Os computadores fixos da UBS e o app com token salvo passariam a ignorar o bloqueio que um estranho provocou.

As contagens novas precisam do mesmo [armazenamento](discovery-tentativas-armazenamento.md); o item 1 não precisa de nada além de configuração.

## Fontes

- Código: `node_modules/@better-auth/core/dist/utils/ip.mjs` e `node_modules/better-auth/dist/api/rate-limiter/index.mjs` (IP confiável e balde único).
- [OWASP: Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP: Blocking Brute Force Attacks (par conta/IP)](https://owasp.org/www-community/controls/Blocking_Brute_Force_Attacks)
- [OWASP: Credential Stuffing Prevention (limites por IP não seguram ataque distribuído)](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html)
- [OWASP: Slow Down Online Guessing Attacks with Device Cookies](https://owasp.org/www-community/Slow_Down_Online_Guessing_Attacks_with_Device_Cookies)
- [Cloudflare: detectar CGNAT para reduzir dano colateral](https://blog.cloudflare.com/detecting-cgn-to-reduce-collateral-damage/)
- [The Register: IPs de CGNAT sofrem mais limite (pesquisa da Cloudflare)](https://www.theregister.com/2025/11/03/cloudflare_cgnat_bias_research/)
- [Convergência Digital: IPv6 em ~50% dos usuários no Brasil](https://convergenciadigital.com.br/?p=36104)
- [Coseners: IPs com vários usuários (Brasil entre os maiores em CGNAT)](https://coseners.net/wp-content/uploads/2025/07/Coseners-Multiuser-IPs_compressed.pdf)
