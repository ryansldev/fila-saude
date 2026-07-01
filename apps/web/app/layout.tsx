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

const description =
  "Você entra na fila de atendimento de casa. A gente te avisa quando estiver perto da sua vez. Simples assim. Um projeto open source pra tornar o SUS mais transparente.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Fila Saúde — Acompanhe sua vez sem sair de casa",
    template: "%s | Fila Saúde",
  },
  description,
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
    description,
  },
  twitter: {
    card: "summary",
    title: "Fila Saúde — Acompanhe sua vez sem sair de casa",
    description,
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
