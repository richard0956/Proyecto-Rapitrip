import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable } from "./data-table";

const columns = [{ header: "Nombre", cell: (r: { name: string }) => r.name }];

describe("DataTable", () => {
  it("renderiza filas con encabezados accesibles", () => {
    render(<DataTable caption="Personas" columns={columns} rows={[{ name: "Ana" }]} rowKey={(r) => r.name} emptyTitle="Sin datos" />);
    expect(screen.getByRole("table", { name: "Personas" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Nombre" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Ana" })).toBeInTheDocument();
  });

  it("muestra el estado vacío sin filas", () => {
    render(<DataTable caption="Personas" columns={columns} rows={[]} rowKey={(r) => r.name} emptyTitle="Sin datos" emptyHint="Nada por ahora" />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
  });
});
