import { expect, test } from "@playwright/test";
import { backendHint, confirmEmail, createUser, hasBackend, PASSWORD, uniqueEmail } from "../support/backend";
import { expectNoViolations } from "../support/axe";
import { alertOf } from "../support/locators";
import { STORE_URL } from "../support/urls";

async function signIn(page: import("@playwright/test").Page, email: string, next = "") {
  await page.goto(`${STORE_URL}/ingresar${next}`);
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
}

test.describe("@backend tienda · cuenta del cliente", () => {
  test.skip(!hasBackend, backendHint);

  test("las rutas protegidas llevan a ingresar y conservan el destino", async ({ page }) => {
    await page.goto(`${STORE_URL}/perfil`);
    await expect(page).toHaveURL(/\/ingresar\?next=%2Fperfil$/);
    await page.goto(`${STORE_URL}/vende`);
    await expect(page).toHaveURL(/\/ingresar\?next=%2Fvende$/);
  });

  test("crear cuenta responde igual y, ya confirmada, permite ingresar y editar el perfil", async ({ page }) => {
    const email = uniqueEmail("cliente");
    await page.goto(`${STORE_URL}/registro`);
    await page.getByLabel("Nombre completo").fill("Ana Pérez");
    await page.getByLabel("Correo").fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Repite la contraseña").fill(PASSWORD);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByRole("status")).toContainText(`Si ${email} no tenía cuenta`);

    await confirmEmail(email);
    await signIn(page, email, "?next=%2Fperfil");
    await expect(page).toHaveURL(/\/perfil$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mi perfil");
    await expect(page.getByLabel("Nombre completo")).toHaveValue("Ana Pérez");
    await expectNoViolations(page);

    await page.getByLabel("Teléfono").fill("+505 8888 1425");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("status")).toContainText("Datos guardados");
    await page.reload();
    await expect(page.getByLabel("Teléfono")).toHaveValue("+505 8888 1425");
  });

  test("una cuenta sin confirmar no puede ingresar", async ({ page }) => {
    const email = uniqueEmail("sinconfirmar");
    await createUser(email, { confirmed: false });
    await signIn(page, email);
    await expect(alertOf(page)).toContainText("Confirma tu correo");
  });

  test("Vende en Rapitrip: se envía la solicitud y una segunda queda rechazada por pendiente", async ({ page }) => {
    const email = uniqueEmail("negocio");
    await createUser(email, { fullName: "Juan Téllez" });
    await signIn(page, email, "?next=%2Fvende");
    await expect(page).toHaveURL(/\/vende$/);
    await expect(page.getByLabel("Representante")).toHaveValue("Juan Téllez");
    await expectNoViolations(page);

    const enviar = async () => {
      await page.getByLabel("Nombre del negocio").fill("Ferretería El Clavo");
      await page.getByLabel("Teléfono").fill("+505 8456 2210");
      await page.getByLabel("Dirección del negocio").fill("Bo. Altagracia, Managua");
      await page.getByLabel("Categoría").fill("Ferretería");
      await page.getByRole("button", { name: "Enviar solicitud" }).click();
    };
    await enviar();
    await expect(page.getByRole("status").filter({ hasText: "Recibimos la solicitud" })).toBeVisible();

    await page.goto(`${STORE_URL}/vende`);
    await enviar();
    await expect(alertOf(page)).toContainText("ya tienes una solicitud pendiente");
  });

  test("recuperar contraseña responde igual para cuentas que existen y que no", async ({ page }) => {
    const existente = uniqueEmail("existe");
    await createUser(existente);
    for (const email of [existente, uniqueEmail("noexiste")]) {
      await page.goto(`${STORE_URL}/recuperar`);
      await page.getByLabel("Correo").fill(email);
      await page.getByRole("button", { name: "Enviar enlace" }).click();
      await expect(page.getByRole("status")).toContainText("Si hay una cuenta con ese correo");
    }
  });

  test("cerrar sesión devuelve al inicio y /perfil vuelve a pedir ingreso", async ({ page }) => {
    const email = uniqueEmail("salir");
    await createUser(email);
    await signIn(page, email, "?next=%2Fperfil");
    await page.getByRole("button", { name: /Salir/ }).click();
    await expect(page).toHaveURL(`${STORE_URL}/`);
    await page.goto(`${STORE_URL}/perfil`);
    await expect(page).toHaveURL(/\/ingresar/);
  });
});
