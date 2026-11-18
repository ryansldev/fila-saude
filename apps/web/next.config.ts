import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

const nextConfig: NextConfig = {
  transpilePackages: ["@fila-saude/design"],
  // Dois layouts raiz (landing e docs): o 404 de endereço desconhecido é o `app/global-not-found.tsx`.
  experimental: { globalNotFound: true },
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
