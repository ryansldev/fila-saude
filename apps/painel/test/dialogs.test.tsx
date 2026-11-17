import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DialogsProvider, useConfirm } from "@/components/dialogs";

afterEach(cleanup);

describe("diálogos de confirmação", () => {
  it("um segundo diálogo por cima do primeiro: o primeiro responde 'cancelar' (não fica esperando)", async () => {
    let confirm: ReturnType<typeof useConfirm> | null = null;
    function Probe() {
      confirm = useConfirm();
      return null;
    }
    render(
      <DialogsProvider>
        <Probe />
      </DialogsProvider>,
    );
    const ask = { title: "Remover?", description: "", action: "Remover" };
    let first: Promise<boolean> | undefined;
    await act(async () => {
      first = confirm?.(ask);
      void confirm?.(ask);
    });
    await expect(first).resolves.toBe(false);
  });
});
