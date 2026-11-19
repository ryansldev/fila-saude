import { COLOR } from "@fila-saude/design";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";
import { PT_BR, PT_BR_API } from "@/lib/docs-i18n";
import { baseOptions, docsOptions } from "@/lib/layout.shared";
import { siteMetadata } from "@/lib/site-metadata";
import { source } from "@/lib/source";
import "./docs.css";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });

const description = "Como integrar com a API do Fila Saúde: municípios, paciente, painel e TV.";

export const metadata: Metadata = {
  ...siteMetadata,
  title: { default: "Docs", template: "%s | Fila Saúde docs" },
  description,
  alternates: { canonical: "/docs" },
  openGraph: { ...siteMetadata.openGraph, url: "/docs", title: "Fila Saúde docs", description },
};

// Cores do Fila Saúde (`packages/design`) nas variáveis do Fumadocs; só o modo claro.
const theme = {
  "--color-fd-background": COLOR.surface,
  "--color-fd-foreground": COLOR.ink,
  "--color-fd-muted": COLOR.surfaceMuted,
  "--color-fd-muted-foreground": COLOR.inkMuted,
  "--color-fd-popover": COLOR.surface,
  "--color-fd-popover-foreground": COLOR.ink,
  "--color-fd-card": COLOR.fieldBackground,
  "--color-fd-card-foreground": COLOR.ink,
  "--color-fd-border": COLOR.line,
  "--color-fd-primary": COLOR.action,
  "--color-fd-primary-foreground": COLOR.surface,
  "--color-fd-secondary": COLOR.primary50,
  "--color-fd-secondary-foreground": COLOR.primary900,
  "--color-fd-accent": COLOR.primary50,
  "--color-fd-accent-foreground": COLOR.primary900,
  "--color-fd-ring": COLOR.primary500,
} as CSSProperties;

// DOC1: as docs têm o próprio layout raiz (o CSS do Fumadocs não entra na landing; a troca entre os
// dois recarrega a página, ver route-groups do Next).
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={nunito.variable} style={theme} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider
          theme={{ forcedTheme: "light" }}
          search={{ options: { api: "/api/search" } }}
          i18n={{ locale: "pt-BR", translations: { ...PT_BR, ...PT_BR_API } }}
        >
          <DocsLayout
            tree={source.getPageTree()}
            tabMode="navbar"
            nav={{ ...baseOptions().nav, mode: "top" }}
            {...docsOptions()}
          >
            {children}
          </DocsLayout>
        </RootProvider>
      </body>
    </html>
  );
}
