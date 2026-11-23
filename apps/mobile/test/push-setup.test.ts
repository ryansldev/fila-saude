import { describe, expect, it } from "vitest";
import { googleServicesFile, pushTarget } from "@/lib/push-setup";

describe("o google-services.json do build (fora do git)", () => {
  it("no EAS: o arquivo da variável GOOGLE_SERVICES_JSON", () => {
    expect(googleServicesFile("/eas/tmp/gs.json", false)).toBe("/eas/tmp/gs.json");
  });

  it("em dev: o arquivo local, se existir", () => {
    expect(googleServicesFile(undefined, true)).toBe("./google-services.json");
  });

  it("sem nenhum dos dois: fica de fora e o build segue sem push", () => {
    expect(googleServicesFile(undefined, false)).toBeUndefined();
    expect(googleServicesFile("", false)).toBeUndefined();
  });
});

describe("onde o token de push pode ser pedido", () => {
  const ok = { isDevice: true, expoGo: false, os: "android", projectId: "abc" } as const;

  it("build de desenvolvimento ou da loja, com projeto: pede com o projectId", () => {
    expect(pushTarget(ok)).toEqual({ projectId: "abc" });
  });

  it("simulador: sem push", () => {
    expect(pushTarget({ ...ok, isDevice: false })).toBe("simulator");
  });

  it("Expo Go no Android: sem push remoto (desde o SDK 53), mesmo com projeto", () => {
    expect(pushTarget({ ...ok, expoGo: true })).toBe("expo_go");
  });

  it("Expo Go no iPhone: o push remoto ainda funciona", () => {
    expect(pushTarget({ ...ok, expoGo: true, os: "ios" })).toEqual({ projectId: "abc" });
  });

  it("sem projeto EAS: sem push", () => {
    expect(pushTarget({ ...ok, projectId: undefined })).toBe("no_project");
    expect(pushTarget({ ...ok, projectId: "" })).toBe("no_project");
  });
});
