import { docsLlms } from "@/lib/source";

// Todas as páginas das docs num arquivo só, para ferramentas de IA.
export const revalidate = false;

export async function GET() {
  return (await docsLlms.serve("/llms-full.txt")) ?? new Response(null, { status: 404 });
}
