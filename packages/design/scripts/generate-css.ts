import { writeFileSync } from "node:fs";
import { generateCss } from "../css.ts";

const destination = new URL("../tokens.css", import.meta.url);
writeFileSync(destination, generateCss());
console.log(`tokens.css gerado em ${destination.pathname}`);
