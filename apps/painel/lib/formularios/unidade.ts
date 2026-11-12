export type ConfigEfetiva = { valores: Record<string, unknown>; origem: Record<string, string> };

const ORIGENS: Record<string, string> = { padrao: "do padrão", municipio: "do município", unidade: "da unidade" };

/** Campos numéricos da configuração que a tela da unidade mostra. */
export const CAMPOS_CONFIG = [
  { campo: "janelaK", rotulo: "Janela de chamada (K)" },
  { campo: "toleranciaMin", rotulo: "Tolerância (min)" },
  { campo: "saiaDeCasaMin", rotulo: 'Aviso "saia de casa" (min)' },
  { campo: "prazoConfirmacaoHoras", rotulo: "Prazo de confirmação (h)" },
] as const;

/** PD-28: valor efetivo e de onde vem; `proprio` = a unidade definiu. */
export function campoHerdado(efetiva: ConfigEfetiva, campo: string) {
  const valor = efetiva.valores[campo];
  const origem = efetiva.origem[campo] ?? "padrao";
  return {
    valor,
    origem,
    proprio: origem === "unidade",
    texto: `herdado ${ORIGENS[origem] ?? origem}: ${String(valor)}`,
  };
}

/** Campo vazio que era próprio vai como `null` (volta a herdar); vazio que já herdava não vai. */
export function configParaEnvio(valores: Record<string, string>, proprios: string[]): Record<string, number | null> {
  const saida: Record<string, number | null> = {};
  for (const [campo, texto] of Object.entries(valores)) {
    if (texto.trim() === "") {
      if (proprios.includes(campo)) saida[campo] = null;
    } else saida[campo] = Number(texto);
  }
  return saida;
}
