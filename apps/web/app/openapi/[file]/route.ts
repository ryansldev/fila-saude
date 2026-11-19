import { readFile } from "node:fs/promises";
import { API_VERSIONS, openapiFile } from "@/lib/api-versions";

// O documento OpenAPI de cada versão para baixar (`/openapi/v{n}.json`): gerar um cliente, importar no
// Postman ou no Insomnia.
export const revalidate = false;
export const dynamicParams = false;

export function generateStaticParams() {
  return API_VERSIONS.map((version) => ({ file: `${version}.json` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const text = await readFile(openapiFile(file.replace(/\.json$/, "")), "utf8");
  return new Response(text, { headers: { "content-type": "application/json; charset=utf-8" } });
}
