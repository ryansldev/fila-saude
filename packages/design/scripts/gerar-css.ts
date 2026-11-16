import { writeFileSync } from "node:fs";
import { gerarCss } from "../css.ts";

const destino = new URL("../tokens.css", import.meta.url);
writeFileSync(destino, gerarCss());
console.log(`tokens.css gerado em ${destino.pathname}`);
