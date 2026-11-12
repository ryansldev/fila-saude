#!/usr/bin/env node
// Gera as tabelas de transição e a matriz de permissões das specs a partir dos
// dados de packages/domain (AD-051). As tabelas ficam entre marcadores:
//   <!-- gerado: contratos:<spec>:<máquina>[,<máquina>] --> … <!-- /gerado -->
//   <!-- gerado: permissoes --> … <!-- /gerado -->
// Não edite o conteúdo entre os marcadores: edite contratos.ts / permissoes.ts.
// Uso: node scripts/specs-gen.mjs [--dir <.specs/specs>] [--check]
//   sem --check: reescreve os blocos; com --check: só lista o que está desatualizado (sai com 1).
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import {
  MATRIZ,
  TRANSICOES_ENTRADA,
  TRANSICOES_ITEM,
  TRANSICOES_SESSAO,
  textoDaCelula,
} from "../packages/domain/src/index.ts";

const ROOT = new URL("..", import.meta.url).pathname;
export const SPECS_DIR = join(ROOT, ".specs/specs");

const TRANSICOES = { entrada: TRANSICOES_ENTRADA, item: TRANSICOES_ITEM, sessao: TRANSICOES_SESSAO };

const ROTULOS = {
  entrada: {
    aguardando_encaminhamento: "Aguardando encaminhamento",
    aguardando: "Aguardando",
    alocada: "Alocada",
    confirmada: "Confirmada",
    na_reserva: "Na reserva",
    na_fila: "Na fila",
    remanejada: "Remanejada",
    arquivada: "Arquivada",
    concluida: "Concluída",
    cancelada: "Cancelada",
    encerrada_sem_atendimento: "Encerrada sem atendimento",
  },
  item: {
    remoto: "Remoto",
    presente: "Presente",
    chamado: "Chamado",
    atendido_na_etapa: "Atendido na etapa",
    saiu_da_fila: "Saiu da fila",
    remanejado: "Remanejado",
  },
  sessao: { planejada: "Planejada", aberta: "Aberta", cancelada: "Cancelada", encerrada: "Encerrada" },
};

const PERFIS = [
  "paciente",
  "gestao_sms",
  "regulacao_sms",
  "gerente_ubs",
  "agendar",
  "recepcao",
  "enfermeiro",
  "tecnico_enfermagem",
  "atendimento",
];
const CABECALHO_MATRIZ = [
  "Ação",
  "Paciente",
  "Gestão SMS",
  "Regulação SMS",
  "Gerente da UBS",
  "Agendar",
  "Recepção",
  "Enfermeiro",
  "Técnico de enfermagem",
  "Atendimento",
];

const linhaTabela = (celulas) => `| ${celulas.join(" | ")} |`;
const separador = (n) => linhaTabela(Array(n).fill("---"));

function rotulo(maquina, estado) {
  const r = ROTULOS[maquina][estado];
  if (!r) throw new Error(`estado sem rótulo (${maquina}): ${estado}`);
  return r;
}

function celulaDe(maquina, t) {
  if (t.textoDe) return t.textoDe;
  if (t.de === "—") return "—";
  return t.qualificador ? `${rotulo(maquina, t.de)} (${t.qualificador})` : rotulo(maquina, t.de);
}

function celulaPara(maquina, t) {
  if (t.para.startsWith("(")) return `(${t.paraQualificador ?? t.para.slice(1, -1)})`;
  return t.paraQualificador ? `${rotulo(maquina, t.para)} (${t.paraQualificador})` : rotulo(maquina, t.para);
}

/** Tabela de transições: linhas seguidas com o mesmo `textoDe` (e o resto igual) viram uma linha só. */
function tabelaContratos(spec, maquinas) {
  const condicao = maquinas.length === 1 && maquinas[0] === "sessao" ? "Quem / condição" : "Condição";
  const linhas = [linhaTabela(["De", "Evento", condicao, "Para", "Efeitos"]), separador(5)];
  let anterior = null;
  for (const maquina of maquinas) {
    const dados = TRANSICOES[maquina];
    if (!dados) throw new Error(`máquina desconhecida: ${maquina}`);
    for (const t of dados.filter((x) => x.spec === spec)) {
      const resto = [t.evento, t.condicao, celulaPara(maquina, t), t.efeitos];
      const chave = t.textoDe ? JSON.stringify([maquina, t.textoDe, ...resto]) : null;
      if (chave !== null && chave === anterior) continue;
      anterior = chave;
      linhas.push(linhaTabela([celulaDe(maquina, t), ...resto]));
    }
  }
  return linhas;
}

function tabelaPermissoes() {
  return [
    linhaTabela(CABECALHO_MATRIZ),
    separador(CABECALHO_MATRIZ.length),
    ...MATRIZ.map((l) => linhaTabela([l.texto, ...PERFIS.map((p) => textoDaCelula(l.perfis[p]))])),
  ];
}

function conteudo(nome) {
  if (nome === "permissoes") return tabelaPermissoes();
  const m = nome.match(/^contratos:([a-z-]+):([a-z,]+)$/);
  if (!m) throw new Error(`marcador desconhecido: ${nome}`);
  return tabelaContratos(m[1], m[2].split(","));
}

const ABRE = /^<!-- gerado: (.+?) -->$/;
const FECHA = "<!-- /gerado -->";
const TABELA_MANUAL = /^\|\s*(De\s*\|\s*Evento|Ação\s*\|\s*Paciente)\s*\|/;

/** Regera os blocos de um texto. Devolve o texto novo, os blocos encontrados e os problemas. */
export function processar(texto) {
  const entrada = texto.split("\n");
  const saida = [];
  const blocos = [];
  const problemas = [];
  for (let i = 0; i < entrada.length; i++) {
    const linha = entrada[i];
    const abre = linha.match(ABRE);
    if (!abre) {
      if (TABELA_MANUAL.test(linha)) problemas.push(`tabela na linha ${i + 1} está fora dos marcadores`);
      saida.push(linha);
      continue;
    }
    const fim = entrada.indexOf(FECHA, i + 1);
    if (fim < 0) {
      problemas.push(`marcador "${abre[1]}" sem ${FECHA}`);
      saida.push(linha);
      continue;
    }
    let gerado;
    try {
      gerado = conteudo(abre[1]);
    } catch (e) {
      problemas.push(e.message);
      saida.push(...entrada.slice(i, fim + 1));
      i = fim;
      continue;
    }
    const atual = entrada.slice(i + 1, fim);
    blocos.push({ nome: abre[1], desatualizado: atual.join("\n") !== gerado.join("\n") });
    saida.push(linha, ...gerado, FECHA);
    i = fim;
  }
  return { texto: saida.join("\n"), blocos, problemas };
}

function arquivosMd(dir) {
  return readdirSync(dir).flatMap((nome) => {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) return arquivosMd(p);
    return nome.endsWith(".md") ? [p] : [];
  });
}

/** Linhas de dados que nenhum bloco publica (ex.: um marcador apagado). */
function naoPublicados(nomes) {
  const cobertos = new Set(
    nomes.flatMap((n) => {
      const m = n.match(/^contratos:([a-z-]+):([a-z,]+)$/);
      return m ? m[2].split(",").map((maq) => `${m[1]}:${maq}`) : [];
    }),
  );
  const faltam = new Set();
  for (const [maquina, dados] of Object.entries(TRANSICOES)) {
    for (const t of dados) if (!cobertos.has(`${t.spec}:${maquina}`)) faltam.add(`contratos:${t.spec}:${maquina}`);
  }
  if (!nomes.includes("permissoes")) faltam.add("permissoes");
  return [...faltam];
}

/** Gera (ou, com `checar`, só confere) os blocos de todas as specs em `dir`. Devolve os erros. */
export function rodar(dir = SPECS_DIR, { checar = false } = {}) {
  const erros = [];
  const nomes = [];
  for (const arquivo of arquivosMd(dir)) {
    const rel = relative(dir, arquivo);
    const original = readFileSync(arquivo, "utf8");
    const { texto, blocos, problemas } = processar(original);
    for (const p of problemas) erros.push(`${rel}: ${p}`);
    for (const b of blocos) {
      if (nomes.includes(b.nome)) erros.push(`${rel}: bloco ${b.nome} repetido`);
      nomes.push(b.nome);
      if (checar && b.desatualizado) erros.push(`${rel}: bloco ${b.nome} desatualizado (rode npm run specs:gen)`);
    }
    if (!checar && texto !== original) writeFileSync(arquivo, texto);
  }
  for (const n of naoPublicados(nomes)) erros.push(`nenhum bloco publica ${n}`);
  return erros;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2);
  const iDir = args.indexOf("--dir");
  const dir = iDir >= 0 ? args[iDir + 1] : SPECS_DIR;
  const checar = args.includes("--check");
  const erros = rodar(dir, { checar });
  for (const e of erros) console.log(`ERRO: ${e}`);
  if (!erros.length) console.log(checar ? "tabelas geradas em dia" : "tabelas geradas");
  process.exit(erros.length ? 1 : 0);
}
