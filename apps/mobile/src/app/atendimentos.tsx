import { Abas, Tela, Titulo } from "@/components/ui";

// Esqueleto: a tela de verdade entra no redesenho de 2026-11-14.
export default function Pagina() {
  return (
    <Tela voltar={false} rodape={<Abas atual="atendimentos" />}>
      <Titulo>atendimentos</Titulo>
    </Tela>
  );
}
