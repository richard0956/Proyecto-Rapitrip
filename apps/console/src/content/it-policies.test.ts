import { describe, expect, it } from "vitest";
import { itPolicyManual, policyAppliesTo, procedureAppliesTo, procedurePolicies } from "./it-policies";

describe("manual de políticas de TI en la consola", () => {
  it("trae el manual completo: 9 políticas, 21 normas, 15 controles y 13 procedimientos", () => {
    const { policies, procedures } = itPolicyManual;
    expect(policies.map((p) => p.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(policies.flatMap((p) => p.normas)).toHaveLength(21);
    expect(policies.flatMap((p) => p.normas.flatMap((n) => n.controls))).toHaveLength(15);
    expect(procedures.items).toHaveLength(13);
    for (const policy of policies) {
      expect(policy.objective).not.toBe("");
      expect(policy.guidelines.length).toBeGreaterThan(0);
      expect(policy.responsible.length).toBeGreaterThan(0);
    }
    expect(procedures.items.every((p) => p.steps.length > 0 && p.relation.includes("Norma"))).toBe(true);
  });

  it("cada rol ve lo que le toca; la administración responde por todo", () => {
    expect(policyAppliesTo(1, "caja")).toBe(true);
    expect(policyAppliesTo(4, "caja")).toBe(false);
    expect(policyAppliesTo(8, "comercio")).toBe(true);
    expect(policyAppliesTo(9, "comercio")).toBe(false);
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].every((n) => policyAppliesTo(n, "admin"))).toBe(true);
  });

  it("los procedimientos se ligan a sus políticas por las normas que citan", () => {
    const backup = itPolicyManual.procedures.items.find((p) => p.number === 6)!;
    expect(procedurePolicies(backup)).toEqual([3]);
    const catalog = itPolicyManual.procedures.items.find((p) => p.number === 12)!;
    expect(procedureAppliesTo(catalog, "comercio")).toBe(true);
    expect(procedureAppliesTo(backup, "coordinacion")).toBe(true);
  });
});
