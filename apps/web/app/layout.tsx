import type { Metadata } from "next";
import { Geist, Nunito } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const SITE_URL = "https://filasaude.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Fila Saúde — Acompanhe sua vez sem sair de casa",
    template: "%s | Fila Saúde",
  },
  description:
    "Você entra na fila de atendimento de casa. A gente te avisa quando estiver perto da sua vez. Simples assim. Um projeto open source pra tornar o SUS mais transparente.",
  applicationName: "Fila Saúde",
  keywords: [
    "fila de espera SUS",
    "fila do posto de saúde",
    "fila remota UBS",
    "entrar na fila de casa",
    "triagem online SUS",
    "UBS",
    "UPA",
    "tempo de espera SUS",
    "atendimento público de saúde",
    "posição na fila",
    "saúde pública",
    "open source",
    "código aberto",
    "transparência na saúde",
    "priorização clínica",
  ],
  authors: [{ name: "Fila Saúde", url: "https://github.com/ryansldev/fila-saude" }],
  creator: "Fila Saúde",
  publisher: "Fila Saúde",
  category: "health",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: "Fila Saúde",
    title: "Fila Saúde — Acompanhe sua vez sem sair de casa",
    description:
      "Você entra na fila de casa. A gente te avisa quando estiver perto da sua vez. Simples assim. Um projeto open source pra tornar o SUS mais transparente.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Fila Saúde — acompanhe sua vez sem sair de casa",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fila Saúde — Acompanhe sua vez sem sair de casa",
    description:
      "Você entra na fila de casa. A gente te avisa quando estiver perto da sua vez. Simples assim. Open source.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={cn("h-full antialiased font-sans", geist.variable, nunito.variable)}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
