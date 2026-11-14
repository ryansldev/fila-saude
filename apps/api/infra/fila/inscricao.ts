import { randomUUID } from "node:crypto";
import { type Entrada, inscreverPublica, type Respostas } from "@fila-saude/domain";
import { ErroApi } from "infra/erros";
import { configDaUnidade, naSessao } from "./dia";
import {
  entradasAtivasDoServico,
  inserirEntrada,
  type PessoaInformada,
  pessoaAtendida,
  pessoaPorCpf,
} from "./entradas";

export type CmdInscrever = {
  pessoa: PessoaInformada;
  responsavelPacienteId: string | null;
  respostas: Respostas;
  agora: number;
};

// RN-PUB-01/02 (T3.3): inscrição na sessão pública; aberta → direto na fila; lotada → reserva (S2).
export async function inscrever(
  db: Parameters<typeof naSessao>[0],
  sessaoId: string,
  cmd: CmdInscrever,
): Promise<Entrada> {
  return naSessao(db, sessaoId, async (c) => {
    if (c.linha.estado !== "planejada" && c.linha.estado !== "aberta") throw new ErroApi(409, "sessao_fechada");
    // Passou do fim: ninguém mais seria atendido nela, mesmo que ninguém tenha encerrado.
    if (c.linha.fim.getTime() <= cmd.agora)
      throw new ErroApi(409, "sessao_fechada", undefined, "Este atendimento já terminou.");
    if (!c.servicoLinha.ativo) throw new ErroApi(404, "nao_encontrado");
    await pessoaPorCpf(c.tx, cmd.pessoa);
    const r = inscreverPublica(
      c.sessao,
      c.dia,
      {
        servico: c.servico,
        pessoa: { nome: cmd.pessoa.nome, nascimento: cmd.pessoa.nascimento, cpf: cmd.pessoa.cpf },
        respostas: cmd.respostas,
        id: randomUUID(),
        entradasAtivas: await entradasAtivasDoServico(c.tx, c.servico.id),
        responsavelId: cmd.responsavelPacienteId,
        fotoAceita: false,
      },
      cmd.agora,
      c.dia?.config ?? configDaUnidade(c.unidadeLinha),
    );
    if (!r.ok) throw new ErroApi(409, r.erro);
    const { id } = await pessoaAtendida(c.tx, cmd.pessoa);
    await inserirEntrada(c.tx, r.estado.entrada, id);
    return { dia: r.estado.dia, sessao: r.estado.sessao, resultado: r.estado.entrada };
  });
}
