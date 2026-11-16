import type { ComandoEstacao, NivelRiscoApi, OperacaoEstacao } from "@fila-saude/schemas/fila";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  FootprintsIcon,
  HeartIcon,
  MegaphoneIcon,
  PauseIcon,
  SmartphoneIcon,
  TriangleAlertIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CartaoDeRisco } from "@/components/ui/cartao-de-risco";
import { faseDoChamado, pilulaDoMaisAntigo, textoDaEspera } from "@/lib/estacao";
import { cronometro } from "@/lib/fila";
import { CORES_DA_TRIAGEM, corDoNivel, podeEncaminhar, precisaClassificar, textoDaPrioridade } from "@/lib/triagem";
import { cn } from "@/lib/utils";

type Props = {
  op: OperacaoEstacao;
  cor: NivelRiscoApi | null;
  aoEscolherCor: (nivel: NivelRiscoApi) => void;
  aoComando: (c: ComandoEstacao, encaminhar?: boolean) => void;
  enviando: boolean;
  /** Hora do servidor (já com o desvio do relógio). */
  agora: number;
};

function Pilula({ icone, tom = "neutro", children }: { icone: ReactNode; tom?: Tom; children: ReactNode }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold", TONS[tom])}
    >
      {icone}
      {children}
    </span>
  );
}
type Tom = "neutro" | "alerta" | "atrasado" | "sala";
const TONS: Record<Tom, string> = {
  neutro: "border-[var(--ds-linha)] bg-white text-slate-700",
  alerta: "border-amber-200 bg-amber-50 text-amber-900",
  atrasado: "border-red-200 bg-red-50 text-red-800",
  sala: "border-green-200 bg-green-50 text-green-800",
};

const ICONE = "size-3.5";

/** Quem aguarda na unidade (na ordem de chamada) e quem está a caminho: senha e primeiro nome. */
function FilaDaEstacao({ op, agora }: { op: OperacaoEstacao; agora: number }) {
  const antigo = pilulaDoMaisAntigo(op.maisAntigo, agora);
  const mais = (n: number, mostrados: number) =>
    n > mostrados ? (
      <span className="rounded-lg border border-[var(--ds-linha)] px-2 py-1 text-xs font-bold">+{n - mostrados}</span>
    ) : null;
  return (
    <section
      aria-label="Fila da estação"
      className="grid gap-4 rounded-2xl border border-[var(--ds-linha)] bg-white px-4 py-3 md:grid-cols-[1.4fr_1fr]"
    >
      <div className="flex flex-col gap-2">
        <h2 className="flex flex-wrap items-center gap-1.5 text-xs font-extrabold text-slate-900">
          <UsersIcon className={cn(ICONE, "text-green-700")} aria-hidden />
          aguardando na unidade
          <span className="rounded-full bg-slate-100 px-2">{op.aguardando}</span>
          {antigo ? (
            <Pilula tom={antigo.atrasado ? "atrasado" : "alerta"} icone={<ClockIcon className="size-3" aria-hidden />}>
              {antigo.texto}
            </Pilula>
          ) : null}
        </h2>
        <ul className="flex flex-wrap gap-1.5">
          {op.proximos.length === 0 ? <li className="text-sm text-slate-500">ninguém ainda</li> : null}
          {op.proximos.map((p) => (
            <li
              key={p.senha}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ds-linha)] bg-white px-2 py-1 text-xs font-bold text-slate-900"
            >
              <span className="font-mono font-extrabold">{p.senha}</span>
              {p.nome}
              <span className="font-semibold text-slate-500">{textoDaEspera(p.presenteDesde, agora)}</span>
            </li>
          ))}
          {mais(op.aguardando, op.proximos.length)}
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
          <FootprintsIcon className={cn(ICONE, "text-primary")} aria-hidden />a caminho
          <span className="rounded-full bg-slate-100 px-2">{op.remotos}</span>
        </h2>
        <ul className="flex flex-wrap gap-1.5">
          {op.aCaminho.length === 0 ? <li className="text-sm text-slate-500">ninguém</li> : null}
          {op.aCaminho.map((p) => (
            <li
              key={p.senha}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-600"
            >
              <span className="font-mono font-extrabold">{p.senha}</span>
              {p.nome}
            </li>
          ))}
          {mais(op.remotos, op.aCaminho.length)}
        </ul>
      </div>
    </section>
  );
}

function Tracejado({
  icone,
  titulo,
  texto,
  acao,
}: {
  icone: ReactNode;
  titulo: string;
  texto?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-4 py-4">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary-50 text-primary">{icone}</span>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="font-extrabold text-slate-900">{titulo}</p>
        {texto ? <p className="text-sm text-slate-600">{texto}</p> : null}
      </div>
      {acao}
    </div>
  );
}

/** A estação com a sessão aberta: a fila, quem está chamado (em duas fases) e as ações. */
export function PainelDaEstacao({ op, cor, aoEscolherCor, aoComando, enviando, agora }: Props) {
  const chamado = op.chamado;
  const triagem = op.estacao.etapa === "triagem";
  return (
    <div className="flex flex-col gap-3">
      <FilaDaEstacao op={op} agora={agora} />
      {chamado ? (
        <Chamado
          op={op}
          chamado={chamado}
          triagem={triagem}
          cor={cor}
          aoEscolherCor={aoEscolherCor}
          aoComando={aoComando}
          enviando={enviando}
          agora={agora}
        />
      ) : op.aguardando > 0 ? (
        <Tracejado
          icone={<MegaphoneIcon className="size-5" aria-hidden />}
          titulo="Estação livre"
          texto={
            op.aguardando === 1 ? "1 pessoa aguardando na unidade." : `${op.aguardando} pessoas aguardando na unidade.`
          }
          acao={
            <Button icone={MegaphoneIcon} disabled={enviando} onClick={() => aoComando("chamar")}>
              Chamar o próximo
            </Button>
          }
        />
      ) : (
        <Tracejado
          icone={<UsersIcon className="size-5" aria-hidden />}
          titulo="Ninguém aguardando agora"
          texto={
            op.remotos > 0
              ? `${op.remotos} a caminho. Quando chegar, o botão acende.`
              : "Quando alguém chegar, o botão acende."
          }
          acao={
            <Button icone={MegaphoneIcon} disabled>
              Chamar o próximo
            </Button>
          }
        />
      )}
    </div>
  );
}

function Chamado({
  op,
  chamado,
  triagem,
  cor,
  aoEscolherCor,
  aoComando,
  enviando,
  agora,
}: Props & { chamado: NonNullable<OperacaoEstacao["chamado"]>; triagem: boolean }) {
  const fase = faseDoChamado(chamado);
  const ficha = chamado.triagem;
  const falta = precisaClassificar(op.estacao.etapa, true, cor);
  return (
    <>
      <section
        aria-label="Paciente da estação"
        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-b-4 border-[var(--ds-linha)] bg-white px-5 py-4"
      >
        <div className="flex items-center gap-5">
          <span className="font-mono text-5xl font-black tracking-tight text-primary">{chamado.senha}</span>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              {fase === "chamado" ? "chamado, esperando entrar" : "na sua sala"}
            </span>
            <span className="text-lg font-extrabold text-slate-900">{chamado.nome}</span>
            <div className="flex flex-wrap gap-1.5">
              {fase === "chamado" ? (
                <Pilula
                  tom={chamado.toleranciaEsgotada ? "atrasado" : "neutro"}
                  icone={<ClockIcon className={ICONE} aria-hidden />}
                >
                  <span className="tabular-nums">{cronometro(chamado.chamadoEm, agora)}</span> desde a chamada
                  {chamado.toleranciaEsgotada ? <span>, passou a tolerância</span> : null}
                </Pilula>
              ) : (
                <Pilula tom="sala" icone={<CheckIcon className={ICONE} aria-hidden />}>
                  na sua sala há{" "}
                  <span className="tabular-nums">{cronometro(chamado.compareceuEm ?? chamado.chamadoEm, agora)}</span>
                </Pilula>
              )}
              {chamado.prioridade.map((g) => (
                <Pilula key={g} icone={<HeartIcon className={ICONE} aria-hidden />}>
                  {textoDaPrioridade([g])}
                </Pilula>
              ))}
              {chamado.pulos > 0 ? (
                <Pilula icone={<XIcon className={ICONE} aria-hidden />}>
                  {chamado.pulos === 1 ? "1 pulo" : `${chamado.pulos} pulos`}
                </Pilula>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {fase === "chamado" ? (
            <>
              <Button
                variante="secundario"
                icone={MegaphoneIcon}
                disabled={enviando}
                onClick={() => aoComando("rechamar")}
              >
                Rechamar
              </Button>
              <Button
                variante="perigoContorno"
                icone={XIcon}
                disabled={enviando}
                onClick={() => aoComando("nao-compareceu")}
              >
                Não compareceu
              </Button>
              <Button icone={CheckIcon} disabled={enviando} onClick={() => aoComando("compareceu")}>
                Compareceu
              </Button>
            </>
          ) : (
            <Button variante="texto" disabled={enviando} onClick={() => aoComando("desfazer-compareceu")}>
              desfazer
            </Button>
          )}
        </div>
      </section>

      {triagem && ficha?.apoio ? (
        <p role="alert" className="flex gap-2 rounded-xl bg-red-50 px-4 py-3 text-red-900">
          <TriangleAlertIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>
            <strong>Atenção:</strong> respondeu no app que tem pensamentos de tirar a própria vida ou de se machucar.
            Acolha agora. <strong>CVV 188</strong>, <strong>SAMU 192</strong>.
          </span>
        </p>
      ) : null}

      {fase === "chamado" ? (
        triagem ? (
          <Tracejado
            icone={<CheckIcon className="size-5" aria-hidden />}
            titulo="A classificação de risco abre quando a pessoa entrar na sala (Compareceu)."
          />
        ) : null
      ) : (
        <section
          aria-label="Fechar o atendimento"
          className="flex flex-col gap-3 rounded-2xl border border-[var(--ds-linha)] bg-white p-4"
        >
          {triagem && ficha ? (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-3 font-extrabold text-slate-900">Classifique o risco</legend>
              <div className="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-3 xl:grid-cols-5">
                {CORES_DA_TRIAGEM.map((c) => (
                  <CartaoDeRisco
                    key={c.nivel}
                    cor={c}
                    selecionado={cor === c.nivel}
                    sugerida={c.nivel === ficha.riscoSugerido}
                    onClick={() => aoEscolherCor(c.nivel)}
                  />
                ))}
              </div>
              <p className="flex items-center gap-1.5 text-sm text-slate-600">
                <SmartphoneIcon className={ICONE} aria-hidden />o app sugeriu{" "}
                {corDoNivel(ficha.riscoSugerido).rotulo.toLowerCase()} porque:{" "}
                {ficha.regra.charAt(0).toLowerCase() + ficha.regra.slice(1)}
              </p>
            </fieldset>
          ) : null}
          {triagem && podeEncaminhar(cor) ? (
            <p className="flex gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              Vermelho: ao finalizar, a pessoa vai para o 1º lugar do atendimento desta unidade. Se ela precisa ir para
              outro serviço, encaminhe.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {triagem && podeEncaminhar(cor) ? (
                <Button
                  variante="perigo"
                  icone={ArrowRightIcon}
                  disabled={enviando}
                  onClick={() => aoComando("finalizar", true)}
                >
                  Encaminhar à emergência
                </Button>
              ) : falta ? (
                <p className="text-sm text-slate-600">Escolha a cor para finalizar.</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variante="texto"
                icone={PauseIcon}
                disabled={enviando || falta}
                onClick={() => aoComando("finalizar")}
              >
                só finalizar
              </Button>
              <Button icone={CheckIcon} disabled={enviando || falta} onClick={() => aoComando("chamar")}>
                Finalizar e chamar o próximo
              </Button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
