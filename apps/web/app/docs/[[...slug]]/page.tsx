import type { OpenAPIPageData } from "fumadocs-openapi/server";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/notebook/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OpenAPIPage } from "@/components/docs/api-page";
import { getMDXComponents } from "@/components/docs/mdx";
import { source } from "@/lib/source";

export default async function Page(props: PageProps<"/docs/[[...slug]]">) {
  const { slug } = await props.params;
  const page = source.getPage(slug);
  if (!page) notFound();

  // A referência de uma versão da API (AD-068): a página vem do documento OpenAPI.
  if (page.type !== "docs") {
    const api = page.data as unknown as OpenAPIPageData;
    return (
      <DocsPage toc={api.toc} full>
        <DocsTitle>{api.title}</DocsTitle>
        <DocsBody>
          <OpenAPIPage {...api.getOpenAPIPageProps()} />
        </DocsBody>
      </DocsPage>
    );
  }

  const MDX = page.data.body;
  // A introdução traz o próprio herói (título, fala do Dr. Lino e botões); as outras, a seção acima do título.
  const hero = page.data.hero === true;
  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      {hero ? null : (
        <>
          {page.data.section ? <span className="docs-eyebrow">{page.data.section}</span> : null}
          <DocsTitle>{page.data.title}</DocsTitle>
          <DocsDescription className="docs-lead">{page.data.description}</DocsDescription>
        </>
      )}
      <DocsBody className="docs-guide">
        <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
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
