import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** WCAG 2.2 AA con axe. El mensaje de fallo lista cada regla y los elementos afectados. */
export async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const summary = violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n${v.nodes
        .slice(0, 3)
        .map((n) => `   - ${n.target.join(" ")}\n     ${n.failureSummary?.split("\n").slice(1).join(" ")}`)
        .join("\n")}`,
  );
  expect(summary, `Violaciones de accesibilidad:\n${summary.join("\n")}`).toEqual([]);
}
