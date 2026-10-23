import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { DirectoryRow } from "@/lib/directory";
import { DirectoryTable } from "./directory-table";

const rows: DirectoryRow[] = [
  { id: "a", name: "Panadería La Esperanza", ruc: "J0310000123456", status: "activo", stores: 2, accounts: 1, createdAt: "1 oct 2026" },
  { id: "b", name: "Ferretería Núñez", ruc: "J0310000999999", status: "suspendido", stores: 0, accounts: 1, createdAt: "3 oct 2026" },
  { id: "c", name: "Café Aroma", ruc: "J0310000555555", status: "activo", stores: 1, accounts: 2, createdAt: "5 oct 2026" },
];

const setup = () => render(<DirectoryTable rows={rows} kind="empresa" noun={{ one: "comercio", many: "comercios" }} detailBase="/admin/comercios" />);
const bodyRows = () => within(screen.getAllByRole("rowgroup")[1]!).getAllByRole("row");

describe("DirectoryTable", () => {
  it("muestra todas las filas y cuántas son", () => {
    setup();
    expect(bodyRows()).toHaveLength(3);
    expect(screen.getByRole("status")).toHaveTextContent("3 de 3 comercios");
  });

  it("la búsqueda filtra mientras se escribe, sin acentos", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByRole("searchbox", { name: "Buscar comercio" }), "nunez");
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Ferretería Núñez" })).toHaveAttribute("href", "/admin/comercios/b");
    expect(screen.getByRole("status")).toHaveTextContent("1 de 3 comercios");
  });

  it("los filtros de estado muestran su conteo y filtran", async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.getByRole("button", { name: "Suspendidos · 1" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Suspendidos · 1" }));
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Suspendidos · 1" })).toHaveAttribute("aria-pressed", "true");
  });

  it("sin coincidencias lo explica y limpiar filtros devuelve la lista", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByRole("searchbox", { name: "Buscar comercio" }), "zzz");
    expect(screen.getByText("Ningún comercio coincide")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(bodyRows()).toHaveLength(3);
    expect(screen.getByRole("searchbox", { name: "Buscar comercio" })).toHaveValue("");
  });

  it("la lista de empresas muestra el RUC y la de vendedores no", () => {
    const { unmount } = setup();
    expect(screen.getByRole("columnheader", { name: "RUC" })).toBeInTheDocument();
    unmount();
    render(<DirectoryTable rows={rows.map((r) => ({ ...r, ruc: null }))} kind="informal" noun={{ one: "vendedor", many: "vendedores" }} detailBase="/admin/vendedores" />);
    expect(screen.queryByRole("columnheader", { name: "RUC" })).not.toBeInTheDocument();
  });

  it("sin ningún registro explica cómo aparecen", () => {
    render(<DirectoryTable rows={[]} kind="informal" noun={{ one: "vendedor", many: "vendedores" }} detailBase="/admin/vendedores" />);
    expect(screen.getByText("Todavía no hay vendedores")).toBeInTheDocument();
  });
});
