/** RN-TRI-02: estação de triagem só atende serviços que exigem triagem. */
export function servicesForStage<S extends { requiresTriage: boolean }>(services: S[], stage: "triage" | "care"): S[] {
  return stage === "triage" ? services.filter((s) => s.requiresTriage) : services;
}
