import { type ZodType, z } from "zod";
import { ErroDaApi } from "@/lib/api";

// Mensagens dos schemas em português, as mesmas da API.
z.config(z.locales.pt());

const MENSAGENS: Record<string, string | ((e: ErroDaApi) => string)> = {
  sem_conexao: "Sem conexão com o servidor. Tente de novo.",
  nao_autenticado: "Sua sessão expirou. Entre de novo.",
  sem_permissao: "Você não tem permissão para isso.",
  nao_encontrado: "Não encontrado. Recarregue a página.",
  entrada_invalida: "Confira os campos destacados.",
  ultimo_gestor: "Este é o último gestor do município: ele não pode perder o perfil.",
  login_em_uso: "Este login já está em uso.",
  prefixo_em_uso: "Este prefixo já está em uso nesta unidade.",
  sessao_aberta: "Há sessão aberta deste serviço. Espere ela encerrar.",
  servico_em_estacao_de_triagem: "Há estação de triagem ligada a este serviço. Tire o serviço dela antes.",
  servico_com_entradas: (e) =>
    `Este serviço tem ${String(e.dados?.entradasAtivas ?? "algumas")} entradas ativas. O modo só muda sem entradas.`,
  servico_regulado: "Serviço regulado não tem sessão pública.",
  estacao_ocupada: "A estação está aberta. Feche-a antes de arquivar.",
  versao_desatualizada: "A sessão mudou desde que você abriu. Recarregue a página.",
  vagas_abaixo_das_ocupadas: (e) =>
    `As vagas não podem ficar abaixo das ${String(e.dados?.ocupadas ?? "")} já ocupadas.`,
  transicao_proibida: "Não dá para fazer isso no estado atual da sessão.",
  sessao_com_pacientes: "Há pacientes nesta sessão. Ela não pode ser cancelada agora.",
  unidade_com_sessoes: "A unidade tem sessões planejadas ou abertas. Cancele ou encerre antes de remover.",
  unidade_com_entradas: (e) =>
    `A unidade tem ${String(e.dados?.entradasAtivas ?? "")} pacientes na lista de espera. Não dá para remover agora.`,
  remover_a_si_mesmo: "Você não pode remover você mesmo da equipe.",
  estacao_com_chamado: "Há paciente chamado em uma estação. Finalize ou marque 'não compareceu' antes de encerrar.",
  motivo_obrigatorio: "Escreva o motivo.",
  estacao_em_uso: "A estação está em uma sessão planejada ou aberta. Tire-a dessas sessões antes de remover.",
  sessao_fechada: "Nenhuma sessão aberta para isso agora.",
  nenhum_elegivel: "Ninguém aguardando na unidade.",
  codigo_invalido: "Código não encontrado ou vencido. Confira o código que aparece na TV.",
  duplicada: "Já existe um registro igual. Recarregue a página.",
};

/** Texto para a pessoa a partir de qualquer erro da chamada. */
export function mensagemDoErro(e: unknown): string {
  if (e instanceof ErroDaApi) {
    const m = MENSAGENS[e.erro];
    if (typeof m === "function") return m(e);
    if (m) return m;
    if (e.mensagem) return e.mensagem;
  }
  return "Não foi possível concluir. Tente de novo.";
}

export type ErrosDoEnvio = { geral: string | null; campos: Record<string, string> };

/**
 * 400 com campos vira erro por campo; o resto, mensagem geral. Cada chave vale também para as
 * chaves "de cima" (`horario.1.0.abre` aparece em `horario.1.0`), para chegar a algum campo da tela;
 * erro na raiz (`_`) vira a mensagem geral.
 */
export function errosDoEnvio(e: unknown): ErrosDoEnvio {
  if (e instanceof ErroDaApi && e.status === 400 && e.campos) {
    const campos: Record<string, string> = {};
    let geral: string | null = null;
    for (const [k, v] of Object.entries(e.campos)) {
      const msg = v[0] ?? "inválido";
      if (k === "_") {
        geral = msg;
        continue;
      }
      const partes = k.split(".");
      for (let n = partes.length; n >= 1; n--) {
        const chave = partes.slice(0, n).join(".");
        if (!(chave in campos)) campos[chave] = msg;
      }
    }
    return { geral, campos };
  }
  return { geral: mensagemDoErro(e), campos: {} };
}

/**
 * Valida no navegador com o mesmo schema da API, antes de enviar: o erro aparece no campo na hora,
 * sem ida ao servidor. `null` = pode enviar.
 */
export function validarNoCliente(schema: ZodType, dados: unknown): ErrosDoEnvio | null {
  const r = schema.safeParse(dados);
  if (r.success) return null;
  const campos: Record<string, string[]> = {};
  for (const p of r.error.issues) {
    const chave = p.path.length > 0 ? p.path.join(".") : "_";
    campos[chave] = [...(campos[chave] ?? []), p.message];
  }
  return errosDoEnvio(new ErroDaApi(400, "entrada_invalida", undefined, campos));
}
