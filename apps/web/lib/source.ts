import { loader } from "fumadocs-core/source";
import { defineDocs } from "fumadocs-mdx/macro";

// DOC1: as docs em `/docs`, escritas em MDX em `content/docs`.
const docs = defineDocs({ dir: "content/docs" });

export const source = loader({ docs: docs.toFumadocsSource() }, { baseUrl: "/docs" });
