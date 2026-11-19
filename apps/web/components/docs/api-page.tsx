"use client";
import { createOpenAPIPage } from "fumadocs-openapi/ui";

// DA8: sem o "testar a rota": a API só aceita chamadas do navegador vindas do painel (CORS), então a página
// das docs não consegue chamar nenhum dos servidores da referência.
export const OpenAPIPage = createOpenAPIPage({ playground: { enabled: false } });
