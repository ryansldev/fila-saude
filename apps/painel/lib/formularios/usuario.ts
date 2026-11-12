export type PerfilPainel = "gestor" | "admin" | "agendador" | "recepcao" | "triagem" | "profissional";
export type PerfilEscolhido = { perfil: PerfilPainel; unidadeId: string | null };

export const ROTULOS_PERFIL: Record<PerfilPainel, string> = {
  gestor: "Gestor",
  admin: "Admin da unidade",
  agendador: "Agendador",
  recepcao: "Recepção",
  triagem: "Triagem",
  profissional: "Profissional",
};

/** RN-PERF-01: perfis de unidade exigem a unidade; gestor é do município. */
export function problemasDosPerfis(perfis: PerfilEscolhido[]): Record<string, string> {
  if (perfis.length === 0) return { perfis: "Escolha ao menos um perfil." };
  const erros: Record<string, string> = {};
  perfis.forEach((p, i) => {
    if (p.perfil !== "gestor" && !p.unidadeId) erros[`perfis.${i}.unidadeId`] = "Escolha a unidade.";
  });
  return erros;
}
