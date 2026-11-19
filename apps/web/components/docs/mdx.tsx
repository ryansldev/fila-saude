import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Braces, LayoutDashboard, Rocket, Shapes, Smartphone, TriangleExclamationPoint, Tv } from "lucide-react";
import type { MDXComponents } from "mdx/types";
import { Callout, Card, Cards, Flow, Hero } from "@/components/docs/brand";

// Os componentes dos guias: os padrões do Fumadocs (código), abas, passos, acordeões, os cartões e avisos
// com a cara do Fila Saúde e os ícones dos cartões.
export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    // Cartão, aviso e o Dr. Lino com a cara do Fila Saúde (DS).
    Callout,
    Card,
    Cards,
    Flow,
    Hero,
    Accordion,
    Accordions,
    Step,
    Steps,
    Tab,
    Tabs,
    // Ícones dos cartões (`<Card icon={<Rocket />}>`), com os nomes canônicos do lucide: os mesmos do
    // mapa `icons`, que os ícones do menu (`icon:` no frontmatter) usam.
    Braces,
    LayoutDashboard,
    Rocket,
    Shapes,
    Smartphone,
    TriangleExclamationPoint,
    Tv,
    ...components,
  } satisfies MDXComponents;
}

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
