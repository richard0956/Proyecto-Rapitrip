import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { UsersWorkspace, type StaffRow } from "./users-workspace";

const base = { email: "", since: "1 oct 2026", isMe: false };
const rows: StaffRow[] = [
  { ...base, key: "1", userId: "u1", name: "Ana Admin", email: "ana@t.test", role: "admin", roleLabel: "Administrador", scope: "Plataforma", status: "activo", isPersonal: true },
  { ...base, key: "2", userId: "u2", name: "Marta Gómez", email: "marta@t.test", role: "comercio", roleLabel: "Comercio", scope: "Panadería La Espiga", status: "suspendido", isPersonal: false },
  { ...base, key: "3", userId: "u3", name: "Luis Caja", email: "luis@t.test", role: "cajero", roleLabel: "Encargado de ventas (caja)", scope: "Operaciones", status: "activo", isPersonal: true },
];
const bodyRows = () => within(within(screen.getByRole("table", { name: "Cuentas con rol" })).getAllByRole("rowgroup")[1]!).getAllByRole("row");

beforeEach(() => push.mockClear());

describe("UsersWorkspace", () => {
  it("resume las cuentas y cuántas están suspendidas", () => {
    render(<UsersWorkspace rows={rows} />);
    const suspended = screen.getByText("Suspendidas").closest("li")!;
    expect(within(suspended).getByText("1")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("3 de 3 cuentas");
  });

  it("filtra por rol, por estado y por texto", async () => {
    const user = userEvent.setup();
    render(<UsersWorkspace rows={rows} />);
    await user.selectOptions(screen.getByLabelText("Estado"), "suspendido");
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText("Marta Gómez")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Estado"), "todos");
    await user.selectOptions(screen.getByLabelText("Rol"), "cajero");
    expect(bodyRows()).toHaveLength(1);
    await user.selectOptions(screen.getByLabelText("Rol"), "todos");
    await user.type(screen.getByRole("searchbox", { name: "Buscar" }), "espiga");
    expect(bodyRows()).toHaveLength(1);
  });

  it("cada cuenta abre su ficha, con el enlace o con un clic en la fila", async () => {
    const user = userEvent.setup();
    render(<UsersWorkspace rows={rows} />);
    expect(screen.getByRole("link", { name: /Ana Admin/ })).toHaveAttribute("href", "/admin/usuarios/u1");
    await user.click(within(bodyRows()[2]!).getByText("Operaciones"));
    expect(push).toHaveBeenCalledWith("/admin/usuarios/u3");
  });

  it("sin coincidencias ofrece limpiar los filtros", async () => {
    const user = userEvent.setup();
    render(<UsersWorkspace rows={rows} />);
    await user.type(screen.getByRole("searchbox", { name: "Buscar" }), "zzz");
    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(bodyRows()).toHaveLength(3);
  });
});
