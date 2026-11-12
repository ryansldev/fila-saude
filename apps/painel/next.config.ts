import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@fila-saude/domain", "@fila-saude/schemas"],
};

export default nextConfig;
