import { expect, test } from "@playwright/test";
import { CONSOLE_URL, STORE_URL } from "../support/urls";

const pages = [
  ["tienda · inicio", `${STORE_URL}/`],
  ["tienda · ingresar", `${STORE_URL}/ingresar`],
  ["tienda · registro", `${STORE_URL}/registro`],
  ["consola · login", `${CONSOLE_URL}/login`],
] as const;

for (const [name, url] of pages) {
  test(`${name}: la CSP no bloquea nada y llegan las cabeceras`, async ({ page }) => {
    const violations: string[] = [];
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) => {
        (window as unknown as { __csp: string[] }).__csp = [...((window as unknown as { __csp?: string[] }).__csp ?? []), `${e.violatedDirective} ${e.blockedURI}`];
      });
    });
    const response = await page.goto(url);
    await page.waitForLoadState("networkidle");
    const headers = response!.headers();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["permissions-policy"]).toContain("camera=()");
    violations.push(...((await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp)) ?? []));
    expect(violations).toEqual([]);
  });
}
