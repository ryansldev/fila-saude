import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { BrandName } from "@/components/landing/brand-name";
import { Button } from "@/components/ui/button";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Página não encontrada | Fila Saúde",
  description: "A página que você procura não existe.",
};

// Endereço que não é da landing nem das docs (os dois têm layouts raiz próprios).
export default function GlobalNotFound() {
  return (
    <html lang="pt-BR" className={`${nunito.variable} font-sans antialiased`}>
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
        <BrandName />
        <h1 className="text-2xl font-extrabold">página não encontrada</h1>
        <p className="text-muted-foreground max-w-sm">A página que você procura não existe ou mudou de endereço.</p>
        <Button render={<Link href="/" />} nativeButton={false}>
          Voltar ao início
        </Button>
      </body>
    </html>
  );
}
