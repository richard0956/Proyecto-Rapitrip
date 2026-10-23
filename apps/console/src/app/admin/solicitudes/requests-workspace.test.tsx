import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RequestsWorkspace, type RequestRow } from "./requests-workspace";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const details = { contactName: "Ana", phone: "", address: "", category: "", ruc: "", cedula: "", email: "", description: "" };
const rows: RequestRow[] = [
  { id: "1", name: "Panadería La Esperanza", status: "pendiente", receivedAgo: "hace 2 h", receivedAt: "", decisionReason: null, reviewedAt: null, details: { ...details, kind: "empresa" } },
  { id: "2", name: "Doña Marta Frutas", status: "pendiente", receivedAgo: "hace 1 día", receivedAt: "", decisionReason: null, reviewedAt: null, details: { ...details, kind: "informal" } },
  { id: "3", name: "Ferretería Núñez", status: "aprobada", receivedAgo: "hace 3 días", receivedAt: "", decisionReason: null, reviewedAt: "", details: { ...details, kind: "empresa" } },
];
const ok = async () => ({ ok: true as const });
const setup = () => render(<RequestsWorkspace rows={rows} approve={ok} reject={ok} />);
const bodyRows = () => within(screen.getAllByRole("rowgroup")[1]!).getAllByRole("row");

describe("RequestsWorkspace", () => {
  it("distingue comercios de vendedores con una columna de tipo", () => {
    setup();
    expect(screen.getByRole("columnheader", { name: "Tipo" })).toBeInTheDocument();
    expect(within(bodyRows()[0]!).getByText("Comercio")).toBeInTheDocument();
    expect(within(bodyRows()[1]!).getByText("Vendedor")).toBeInTheDocument();
  });

  it("el filtro de tipo deja solo comercios o solo vendedores", async () => {
    const user = userEvent.setup();
    setup();
    expect(bodyRows()).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Vendedores · 1" }));
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText("Doña Marta Frutas")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Comercios · 1" }));
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText("Panadería La Esperanza")).toBeInTheDocument();
  });

  it("el tipo se combina con la búsqueda por nombre", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByRole("searchbox", { name: "Buscar negocio" }), "marta");
    expect(bodyRows()).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Comercios · 1" }));
    expect(screen.getByText("No hay solicitudes aquí")).toBeInTheDocument();
  });
});
