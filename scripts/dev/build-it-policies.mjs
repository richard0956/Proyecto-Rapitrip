// Convierte el Manual de Políticas de TI (Markdown) en datos para la consola.
//   node scripts/dev/build-it-policies.mjs
// Lee docs/politicas/Manual_Politicas_TI_Rapitrip.md y escribe apps/console/src/content/it-policies.data.ts.
// Si el manual cambia, se vuelve a correr: el texto de la consola nunca se edita a mano.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const source = join(root, "docs", "politicas", "Manual_Politicas_TI_Rapitrip.md");
const target = join(root, "apps", "console", "src", "content", "it-policies.data.ts");

/** Quita las negritas y espacios sobrantes del Markdown. */
const clean = (text) => text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();

const lines = readFileSync(source, "utf8").split(/\r?\n/);
const manual = { title: "", date: "", policies: [], procedures: { objective: "", scope: "", intro: [], items: [] } };

let policy = null; // política actual
let norma = null; // norma actual
let control = null; // control actual
let procedure = null; // procedimiento actual
let inProcedures = false;
let list = null; // lista numerada que se está llenando
let freeText = null; // destino de párrafos sueltos (Responsables de una política, intro de procedimientos)

/** Objeto que recibe los campos «Objetivo:», «Alcance:»… según lo que se esté leyendo. */
const current = () => control ?? norma ?? procedure ?? policy ?? (inProcedures ? manual.procedures : null);

const fieldKeys = {
  Objetivo: "objective",
  Alcance: "scope",
  Finalidad: "purpose",
  Aplicación: "application",
  Evidencia: "evidence",
  Evidencias: "evidence",
  Responsable: "responsible",
  Responsables: "responsible",
  "Relación con Norma/Control": "relation",
  "Resultado esperado": "result",
};

for (const raw of lines) {
  const line = raw.trim();
  if (!line) continue;

  if (!manual.title && /^\*\*Manual de Políticas/.test(line)) {
    manual.title = clean(line);
    continue;
  }
  if (!manual.date && /^(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre) de \d{4}$/.test(line)) {
    manual.date = line;
    continue;
  }

  let m;
  if ((m = line.match(/^# \*\*Política (\d+)\. (.+?)\*\*$/))) {
    policy = { number: Number(m[1]), title: clean(m[2]), objective: "", scope: "", guidelines: [], responsible: [], normas: [] };
    manual.policies.push(policy);
    norma = control = procedure = null;
    list = freeText = null;
    continue;
  }
  if (/^# \*\*Manual de Procedimientos/.test(line)) {
    inProcedures = true;
    policy = norma = control = procedure = null;
    list = null;
    freeText = manual.procedures.intro;
    continue;
  }
  if (/^## \*\*Normas de la Política/.test(line)) {
    list = freeText = null;
    continue;
  }
  if ((m = line.match(/^\*\*Norma (\d+\.\d+)\. (.+?)\*\*$/))) {
    norma = { code: m[1], title: clean(m[2]), objective: "", scope: "", rules: [], responsible: "", controls: [] };
    policy.normas.push(norma);
    control = null;
    list = freeText = null;
    continue;
  }
  if ((m = line.match(/^\*\*Control (\d+\.\d+\.\d+)\. (.+?)\*\*$/))) {
    control = { code: m[1], title: clean(m[2]), purpose: "", application: "", evidence: "" };
    norma.controls.push(control);
    list = freeText = null;
    continue;
  }
  if ((m = line.match(/^\*\*Procedimiento (\d+)\. (.+?)\*\*$/))) {
    procedure = { number: Number(m[1]), title: clean(m[2]), objective: "", scope: "", responsible: "", relation: "", steps: [], evidence: "", result: "" };
    manual.procedures.items.push(procedure);
    list = freeText = null;
    continue;
  }

  // «**Lineamientos:**», «**Reglas:**», «**Pasos:**» abren una lista numerada.
  if ((m = line.match(/^\*\*(Lineamientos|Reglas|Pasos):\*\*$/))) {
    const owner = current();
    list = m[1] === "Lineamientos" ? owner.guidelines : m[1] === "Reglas" ? owner.rules : owner.steps;
    freeText = null;
    continue;
  }
  // «**Responsables:**» solo, en una política: los responsables vienen en los párrafos siguientes.
  if (/^\*\*Responsables:\*\*$/.test(line) && policy && !norma) {
    list = null;
    freeText = policy.responsible;
    continue;
  }
  // «**Campo:** texto»
  if ((m = line.match(/^\*\*([^*]+?):\*\*\s*(.*)$/)) && fieldKeys[m[1]]) {
    const owner = current();
    owner[fieldKeys[m[1]]] = clean(m[2]);
    list = null;
    // En la introducción de los procedimientos, los párrafos que siguen al alcance son parte de la introducción.
    freeText = owner === manual.procedures ? manual.procedures.intro : null;
    continue;
  }
  if ((m = line.match(/^\d+\.\s+(.+)$/)) && list) {
    list.push(clean(m[1]));
    continue;
  }
  if (freeText) {
    freeText.push(clean(line));
    continue;
  }
}

// Comprobaciones: si el formato del manual cambia, mejor fallar aquí que publicar un manual a medias.
const problems = [];
if (manual.policies.length === 0) problems.push("no se encontraron políticas");
for (const p of manual.policies) {
  if (!p.objective || p.guidelines.length === 0 || p.normas.length === 0) problems.push(`Política ${p.number} incompleta`);
  for (const n of p.normas) if (n.rules.length === 0) problems.push(`Norma ${n.code} sin reglas`);
}
for (const p of manual.procedures.items) if (p.steps.length === 0) problems.push(`Procedimiento ${p.number} sin pasos`);
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

const header = `// Generado por scripts/dev/build-it-policies.mjs desde docs/politicas/Manual_Politicas_TI_Rapitrip.md. No editar a mano.\nimport type { ItPolicyManual } from "./it-policies";\n\n`;
writeFileSync(target, `${header}export const itPolicyManual: ItPolicyManual = ${JSON.stringify(manual, null, 2)};\n`);
const counts = manual.policies.reduce((acc, p) => ({ normas: acc.normas + p.normas.length, controls: acc.controls + p.normas.reduce((n, x) => n + x.controls.length, 0) }), { normas: 0, controls: 0 });
console.log(`Manual: ${manual.policies.length} políticas, ${counts.normas} normas, ${counts.controls} controles, ${manual.procedures.items.length} procedimientos → ${target}`);
