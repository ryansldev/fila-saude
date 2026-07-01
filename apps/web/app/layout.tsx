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

export const metadata: Metadata = {
  title: "Fila Saúde",
  description: "Vamos tornar a espera nos postos de saúde mais tranquila?",
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
