"use client";
import { createOpenAPIPage } from "fumadocs-openapi/ui";

// DA8: sem o "testar a rota" até a API ter um domínio público (os servidores da referência são os de dev).
export const OpenAPIPage = createOpenAPIPage({ playground: { enabled: false } });
