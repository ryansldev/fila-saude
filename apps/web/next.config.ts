import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";
import { CURRENT_API_VERSION } from "./lib/api-versions";

const withMDX = createMDX();

const nextConfig: NextConfig = {
  transpilePackages: ["@fila-saude/design"],
  // Dois layouts raiz (landing e docs): o 404 de endereço desconhecido é o `app/global-not-found.tsx`.
  experimental: { globalNotFound: true },
  // Ferramentas de IA e leitores de Markdown: `/docs/<página>.md` serve o Markdown da página.
  async rewrites() {
    return [
      { source: "/docs.md", destination: "/llms.mdx/docs.md" },
      { source: "/docs/:path*.md", destination: "/llms.mdx/docs/:path*.md" },
    ];
  },
  // AD-068: os guias linkam a referência da versão atual por `/docs/api/atual/…`, que leva à mais nova.
  async redirects() {
    return [
      // A raiz de uma versão (ou da atual) não tem página: leva ao guia da referência.
      { source: "/docs/api/:version(v[1-9]\\d*|atual)", destination: "/docs/referencia", permanent: false },
      { source: "/docs/api/atual/:path+", destination: `/docs/api/${CURRENT_API_VERSION}/:path+`, permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
};

export default withMDX(nextConfig);
