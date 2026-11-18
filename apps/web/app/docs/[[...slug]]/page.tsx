import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OpenAPIPage } from "@/components/docs/api-page";
import { getMDXComponents } from "@/components/docs/mdx";
import { source } from "@/lib/source";

export default async function Page(props: PageProps<"/docs/[[...slug]]">) {
  const { slug } = await props.params;
  const page = source.getPage(slug);
  if (!page) notFound();

  // Toda fonte além dos guias é a referência de uma versão da API (DOC3).
  if (page.type !== "docs") {
    return (
      <DocsPage toc={page.data.toc} full>
        <DocsTitle>{page.data.title}</DocsTitle>
        <DocsBody>
          <OpenAPIPage {...page.data.getOpenAPIPageProps()} />
        </DocsBody>
      </DocsPage>
    );
  }

  const MDX = page.data.body;
  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<"/docs/[[...slug]]">): Promise<Metadata> {
  const { slug } = await props.params;
  const page = source.getPage(slug);
  if (!page) notFound();
  return { title: page.data.title, description: page.data.description };
}
