// PD-40: o seed apaga e recria o município de exemplo; nunca fora de development multi.
export function podeSemear(env: { NODE_ENV: string; TENANT_MODE: string }): boolean {
  return env.NODE_ENV === "development" && env.TENANT_MODE === "multi";
}
