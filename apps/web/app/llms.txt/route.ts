import { docsLlms } from "@/lib/source";

// Índice das docs para ferramentas de IA (llms.txt).
export const revalidate = false;

export async function GET() {
  return (await docsLlms.serve("/llms.txt")) ?? new Response(null, { status: 404 });
}
