import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

// Busca das docs: o índice fica no servidor (montado uma vez por instância), não vai para o navegador.
export const { GET } = createFromSource(source, { language: "portuguese" });
