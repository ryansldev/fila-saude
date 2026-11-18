# Discovery: captcha na inscrição pública (2026-11-18)

Pergunta (NC5, item b): a RN-ID-07 pede "limitar tentativas e exigir captcha na inscrição em sessão pública". O limite já existe; o captcha, não. Qual usar?

Fontes no fim. Preços e limites mudaram várias vezes em 2026 e vêm em parte de blogs de concorrentes: conferir na página de cada fornecedor antes de contratar.

## 1. O que pesa aqui

- **Quem usa:** paciente do SUS pelo app (Expo), muitas vezes idoso, com pouca leitura, Android barato e 4G fraco. Quebra-cabeça de imagem ("clique nos semáforos") é uma barreira real para esse público.
- **Onde aparece:** só na inscrição em sessão pública, que é o ponto que um robô atacaria (encher a fila). O login comum não precisa.
- **App nativo:** os captchas de mercado são feitos para navegador. No app, entram por WebView ou por uma biblioteca própria.
- **LGPD:** a prefeitura é a controladora. Um captcha de terceiro recebe IP e sinais do aparelho, muitas vezes nos EUA. Isso é transferência internacional (art. 33): precisa estar no contrato e no aviso de privacidade.
- **Custo:** o piloto tem margem curta ([discovery-preco](discovery-preco.md)).

## 2. Opções

| Opção | Custo | Para o usuário | No app | Dados |
| --- | --- | --- | --- | --- |
| **Cloudflare Turnstile** | Grátis, sem limite de pedidos; até 20 widgets | Quase sempre invisível; às vezes uma caixa para marcar | Sem SDK nativo: WebView carregando uma página nossa ([guia oficial](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation)); cookies e armazenamento da WebView precisam estar ligados | Vão para a Cloudflare (EUA); diz não usar para anúncio; tem DPA |
| **hCaptcha** | Grátis até ~100 mil por mês, **mas o grátis mostra quebra-cabeça de imagem**; invisível só no Pro (~US$ 99–139/mês) | Grátis: quebra-cabeça para todo mundo | Biblioteca oficial para React Native (WebView por dentro) | Vão para a hCaptcha (EUA); tem programa de acessibilidade por cookie |
| **Google reCAPTCHA** | Grátis só até 10 mil por mês desde 2026; exige conta de cobrança no Google Cloud | v3 invisível; v2 com imagem | WebView | Vão para o Google, com histórico de uso de sinais em outros produtos |
| **ALTCHA** (prova de trabalho, código aberto MIT, hospedado por nós) | Zero | Invisível: o aparelho faz uma conta de cerca de 1 segundo; não há quebra-cabeça, então é acessível | Sem SDK para React Native; o cálculo é SHA-256 repetido, simples de fazer no app (ex.: `expo-crypto`); o servidor gera e confere o desafio com a biblioteca deles | **Nada sai da nossa infraestrutura** |

**Sobre a prova de trabalho:** ela não distingue humano de robô. Ela torna cada inscrição cara para quem faz milhares, e para uma pessoa o custo é imperceptível. Contra um atacante decidido com muitas máquinas, segura menos que o Turnstile. Aqui ela soma com o que já existe: a inscrição exige conta, uma conta põe até 5 pessoas, cada uma informa até 20 CPFs por hora, e a pessoa é conferida na recepção.

**Outra via, a investigar:** a atestação do aparelho (Play Integrity no Android, App Attest no iOS) prova que o pedido vem do nosso app instalado de verdade, sem nada na tela. É forte contra robôs que chamam a API direto, mas pede um módulo nativo no Expo e conta no Google e na Apple. Não validei o suporte atual no Expo.

## 3. Recomendação

**ALTCHA (prova de trabalho, hospedado por nós) na inscrição em sessão pública, na v0.1.**
- Custo zero, nenhum dado com terceiros (fecha a questão da LGPD), e nada que o paciente idoso precise resolver.
- Somado aos limites que já existem, cobre o risco realista do piloto: alguém com um script enchendo a fila.
- O desafio vale para um só pedido e expira em poucos minutos, conferido pela API.

**Se aparecer abuso de verdade,** troca-se pelo **Turnstile** (grátis, quase sempre invisível) por WebView, com a transferência internacional prevista no contrato. hCaptcha grátis está descartado (quebra-cabeça para todos) e reCAPTCHA também (limite baixo, cobrança e dados no Google).

**Decisão sua:** a RN-ID-07 diz "captcha". A prova de trabalho é um captcha invisível, e não um teste que a pessoa resolve. Se a spec quis dizer um teste visível, ou se um edital exigir um captcha "reconhecido", fica o Turnstile.

**No painel** (web, Next), se a [contagem por IP](discovery-bloqueio-por-ip.md) usar captcha depois de muitos erros, qualquer uma das opções entra sem WebView. A mesma escolha vale para os dois.

## Fontes

- [Cloudflare Turnstile: planos](https://developers.cloudflare.com/turnstile/plans/)
- [Cloudflare Turnstile: apps móveis](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation)
- [hCaptcha para React Native](https://github.com/hCaptcha/react-native-hcaptcha)
- [hCaptcha: acessibilidade](https://www.hcaptcha.com/learning/accessibility/hcaptcha-accessibility/)
- [Revisão do hCaptcha 2026 (preços)](https://www.phpcaptcha.org/hcaptcha-review)
- [Preço do reCAPTCHA em 2026](https://www.phpcaptcha.org/recaptcha-pricing)
- [Turnstile vs. reCAPTCHA vs. Procaptcha (blog de concorrente)](https://prosopo.io/blog/recaptcha-vs-cloudflare-turnstile/)
- [ALTCHA](https://altcha.org) e [repositório](https://github.com/altcha-org/altcha)
- [Turnkey: captcha em React Native com página própria](https://docs.turnkey.com/solutions/embedded-wallets/integration-guide/react-native/authentication/captcha)
