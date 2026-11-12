/** RN-TRI-02: estação de triagem só atende serviços que exigem triagem. */
export function servicosParaEtapa<S extends { exigeTriagem: boolean }>(
  servicos: S[],
  etapa: "triagem" | "atendimento",
): S[] {
  return etapa === "triagem" ? servicos.filter((s) => s.exigeTriagem) : servicos;
}
