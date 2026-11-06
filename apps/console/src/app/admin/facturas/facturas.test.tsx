import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const order = vi.fn();
vi.mock("@/lib/guard", () => ({ requireConsoleAccess: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/supabase", () => ({ serverSupabase: async () => ({ rpc, from: () => ({ select: () => ({ order }) }) }) }));
vi.mock("@/components/shell", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));

import FacturasPage from "./page";
import { GET } from "./exportar/route";

const ledgerRow = (over: Record<string, unknown>) => ({
  id: "i1", kind: "venta", number: "RT-V-000001", issued_at: "2026-11-05T20:32:00Z", total: 200, order_id: "o1", order_number: 88,
  commerce_id: "c1", commerce_name: "Café del Norte", payment_method: "tarjeta", payment_status: "pagado", credit_for_number: null, ...over,
});
const rows = [
  ledgerRow({}),
  ledgerRow({ id: "i2", kind: "servicio", number: "RT-S-000001", total: 30 }),
  ledgerRow({ id: "i3", kind: "nota_credito_servicio", number: "RT-NCS-000001", total: 30, credit_for_number: "RT-S-000001", payment_status: "reembolsado" }),
];

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: rows, error: null });
  order.mockReset().mockResolvedValue({ data: [{ id: "c1", name: "Café del Norte" }], error: null });
});

describe("Libro de facturas", () => {
  it("pide el rango del mes en hora de Managua, lista los documentos y suma facturado, acreditado y neto", async () => {
    render(await FacturasPage({ searchParams: Promise.resolve({ desde: "2026-11-01", hasta: "2026-11-05", metodo: "tarjeta" }) }));
    expect(rpc).toHaveBeenCalledWith("invoice_ledger", expect.objectContaining({ p_from: "2026-11-01T06:00:00.000Z", p_to: "2026-11-06T06:00:00.000Z", p_method: "tarjeta", p_limit: 2000 }));

    const table = screen.getByRole("table", { name: "Facturas y notas de crédito" });
    expect(within(table).getByText("RT-V-000001")).toBeInTheDocument();
    expect(within(table).getByText("Anula RT-S-000001")).toBeInTheDocument();
    expect(within(table).getAllByRole("link", { name: "#88" })[0]).toHaveAttribute("href", "/admin/pedidos/88");
    expect(within(table).getByRole("link", { name: "Descargar PDF de RT-V-000001" })).toHaveAttribute("href", "/facturas/i1");

    // Facturado 230, acreditado 30, neto 200.
    expect(screen.getByText("Facturado").nextElementSibling).toHaveTextContent("230");
    expect(screen.getByText("Acreditado por notas").nextElementSibling).toHaveTextContent("30");
    expect(screen.getByText("Neto").nextElementSibling).toHaveTextContent("200");
    expect(screen.getByRole("link", { name: /Descargar CSV/ })).toHaveAttribute("href", "/admin/facturas/exportar?desde=2026-11-01&hasta=2026-11-05&metodo=tarjeta");
  });

  it("sin documentos lo dice, y si la base falla avisa sin romper", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    const { unmount } = render(await FacturasPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("No hay documentos con esos filtros")).toBeInTheDocument();
    unmount();

    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    render(await FacturasPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/No pudimos cargar el libro/)).toBeInTheDocument();
  });
});

describe("Exportar libro", () => {
  it("devuelve un CSV con las notas de crédito en negativo, para que la suma sea el neto", async () => {
    const response = await GET(new Request("http://x.test/admin/facturas/exportar?desde=2026-11-01&hasta=2026-11-05"));
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(response.headers.get("Content-Disposition")).toContain("libro-facturas-2026-11-01_2026-11-05.csv");
    const lines = (await response.text()).trim().split("\r\n");
    expect(lines[0]).toContain("Importe (notas en negativo)");
    expect(lines).toHaveLength(4);
    expect(lines[3]).toContain("RT-NCS-000001");
    expect(lines[3]).toContain(",-30,RT-S-000001");
    expect(lines[1]).toContain(",200,");
  });

  it("si la base falla responde 500", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect((await GET(new Request("http://x.test/admin/facturas/exportar"))).status).toBe(500);
  });
});
