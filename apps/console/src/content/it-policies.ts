import type { ConsoleArea } from "@rapitrip/supabase";
import { normalizeText } from "@/lib/directory";
import { itPolicyManual } from "./it-policies.data";

/** Manual de Políticas, Normas, Controles y Procedimientos de TI (fuente: docs/politicas/). */
export type ItControl = { code: string; title: string; purpose: string; application: string; evidence: string };
export type ItNorma = { code: string; title: string; objective: string; scope: string; rules: string[]; responsible: string; controls: ItControl[] };
export type ItPolicy = { number: number; title: string; objective: string; scope: string; guidelines: string[]; responsible: string[]; normas: ItNorma[] };
export type ItProcedure = { number: number; title: string; objective: string; scope: string; responsible: string; relation: string; steps: string[]; evidence: string; result: string };
export type ItPolicyManual = {
  title: string;
  date: string;
  policies: ItPolicy[];
  procedures: { objective: string; scope: string; intro: string[]; items: ItProcedure[] };
};

export { itPolicyManual };

/**
 * A quién le toca cada política dentro de la consola. Las de seguridad, cuentas y datos personales son para todos; las de
 * la operación, para quien la ejecuta. La administración y la dirección responden por todas.
 */
const policyAreas: Record<number, ConsoleArea[] | "todas"> = {
  1: "todas",
  2: "todas",
  3: "todas",
  4: ["admin"],
  5: ["admin"],
  6: ["admin", "coordinacion", "comercio"],
  7: ["admin", "coordinacion"],
  8: ["admin", "coordinacion", "comercio"],
  9: ["admin", "caja", "coordinacion"],
};

export function policyAppliesTo(policy: number, area: ConsoleArea): boolean {
  const areas = policyAreas[policy];
  return areas === "todas" || (areas?.includes(area) ?? false) || area === "admin";
}

/** Políticas con las que se relaciona un procedimiento, leídas de su «Relación con Norma/Control» (Norma 6.1 → Política 6). */
export function procedurePolicies(procedure: ItProcedure): number[] {
  const found = [...procedure.relation.matchAll(/Norma (\d+)\.\d+/g)].map((m) => Number(m[1]));
  return [...new Set(found)];
}

export function procedureAppliesTo(procedure: ItProcedure, area: ConsoleArea): boolean {
  return procedurePolicies(procedure).some((policy) => policyAppliesTo(policy, area));
}

/** Todo el texto de una política (con sus normas y controles), para el buscador. */
export function policyText(policy: ItPolicy): string {
  return normalizeText(
    [
      `Política ${policy.number}`,
      policy.title,
      policy.objective,
      policy.scope,
      ...policy.guidelines,
      ...policy.responsible,
      ...policy.normas.flatMap((n) => [`Norma ${n.code}`, n.title, n.objective, n.scope, ...n.rules, n.responsible, ...n.controls.flatMap((c) => [`Control ${c.code}`, c.title, c.purpose, c.application, c.evidence])]),
    ].join(" "),
  );
}

export function procedureText(procedure: ItProcedure): string {
  return normalizeText([`Procedimiento ${procedure.number}`, procedure.title, procedure.objective, procedure.scope, procedure.responsible, procedure.relation, ...procedure.steps, procedure.evidence, procedure.result].join(" "));
}
