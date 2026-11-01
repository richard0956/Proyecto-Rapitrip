import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BarChart } from "./bar-chart";
import { ColumnList } from "./column-list";
import { DonutChart } from "./donut-chart";
import { HBarList } from "./hbar-list";
import { KpiCard } from "./kpi-card";
import { LineChart } from "./line-chart";

const labels = ["1", "2", "3", "4", "5"];

describe("LineChart", () => {
  it("dibuja una línea por serie y marca la punteada", () => {
    const { container } = render(
      <LineChart
        ariaLabel="Ventas del mes"
        labels={labels}
        series={[
          { name: "Octubre", tone: "hoja", values: [1, 2, 3, 4, 5] },
          { name: "Septiembre", tone: "gris", dashed: true, values: [2, 2, 3, 3, 4] },
        ]}
      />,
    );
    expect(screen.getByRole("img", { name: "Ventas del mes" })).toBeInTheDocument();
    const lines = container.querySelectorAll("polyline");
    expect(lines).toHaveLength(2);
    expect(lines[0]).not.toHaveAttribute("stroke-dasharray");
    expect(lines[1]).toHaveAttribute("stroke-dasharray");
  });

  it("sin datos o con todo en cero muestra un mensaje y no falla", () => {
    const empty = render(<LineChart ariaLabel="Vacío" labels={[]} series={[]} />);
    expect(empty.getByText("Sin datos en este periodo")).toBeInTheDocument();
    empty.unmount();
    const zeros = render(<LineChart ariaLabel="Ceros" labels={labels} series={[{ name: "A", tone: "hoja", values: [0, 0, 0, 0, 0] }]} />);
    expect(zeros.container.innerHTML).not.toContain("NaN");
    expect(zeros.getByText("Sin datos en este periodo")).toBeInTheDocument();
  });

  it("el gráfico que se desplaza en pantallas angostas se puede recorrer con el teclado", () => {
    const { container } = render(<LineChart ariaLabel="Ventas" labels={labels} series={[{ name: "A", tone: "hoja", values: [1, 2, 3, 4, 5] }]} />);
    const scroller = container.querySelector(".overflow-x-auto");
    expect(scroller).toHaveAttribute("tabindex", "0");
  });

  it("con valores pequeños el eje no repite etiquetas", () => {
    const { container } = render(<LineChart ariaLabel="Pocas unidades" labels={["a", "b"]} series={[{ name: "A", tone: "hoja", values: [0, 3] }]} />);
    const axis = Array.from(container.querySelectorAll("svg text")).map((node) => node.textContent).filter((text) => ["0", "1", "2", "3"].includes(text ?? ""));
    expect(new Set(axis).size).toBe(axis.length);
  });

  it("ofrece una tabla para lectores de pantalla con los datos", () => {
    render(<LineChart ariaLabel="Ventas" labels={labels} series={[{ name: "Octubre", tone: "hoja", values: [1, 2, 3, 4, 5] }]} formatValue={(n) => `C$ ${n}`} />);
    expect(screen.getByRole("table", { hidden: true })).toBeInTheDocument();
    expect(screen.getAllByText("C$ 5", { selector: "td" }).length).toBeGreaterThan(0);
  });
});

describe("BarChart", () => {
  it("con valores en cero no produce NaN", () => {
    const { container } = render(<BarChart ariaLabel="Pedidos" labels={["L", "M"]} values={[0, 0]} />);
    expect(container.innerHTML).not.toContain("NaN");
    expect(container.querySelectorAll("rect")).toHaveLength(2);
  });
});

describe("HBarList", () => {
  it("muestra cada fila con su valor formateado y respeta el orden recibido", () => {
    render(<HBarList items={[{ label: "Tienda A", value: 80 }, { label: "Tienda B", value: 55 }]} formatValue={(n) => `C$ ${n}`} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Tienda A");
    expect(rows[0]).toHaveTextContent("C$ 80");
    expect(rows[1]).toHaveTextContent("Tienda B");
  });

  it("dos filas con la misma etiqueta no repiten clave de React", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<HBarList items={[{ label: "Café molido", value: 3 }, { label: "Café molido", value: 2 }]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("una lista vacía lo explica", () => {
    render(<HBarList items={[]} />);
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
  });
});

describe("DonutChart", () => {
  it("dibuja una porción por valor positivo y muestra total y porcentajes", () => {
    const { container } = render(
      <DonutChart
        ariaLabel="Pedidos por estado"
        totalLabel="pedidos"
        items={[
          { label: "Listo", value: 8, color: "var(--esmeralda)" },
          { label: "Entregado", value: 4, color: "var(--hoja)" },
          { label: "Sin pedidos", value: 0, color: "var(--rojo)" },
        ]}
      />,
    );
    expect(screen.getByRole("img", { name: "Pedidos por estado" })).toBeInTheDocument();
    expect(container.querySelectorAll("circle")).toHaveLength(2);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("67 %")).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("NaN");
  });

  it("con todo en cero lo explica", () => {
    render(<DonutChart ariaLabel="Vacío" items={[{ label: "Listo", value: 0, color: "red" }]} />);
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
  });
});

describe("ColumnList", () => {
  it("una columna por elemento con el valor formateado y sin NaN en cero", () => {
    const { container } = render(<ColumnList ariaLabel="Ventas" items={[{ label: "Café Central", value: 1050 }, { label: "Tienda B", value: 0 }]} formatValue={(n) => `C$ ${n}`} />);
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(screen.getAllByText("C$ 1050").length).toBeGreaterThan(0);
    expect(container.innerHTML).not.toContain("NaN");
  });

  it("una lista vacía lo explica", () => {
    render(<ColumnList ariaLabel="Ventas" items={[]} />);
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
  });
});

describe("KpiCard con tendencia", () => {
  it("muestra el texto de la tendencia", () => {
    render(<KpiCard icon={null} label="Ventas" value="C$ 10" trend={{ text: "▲ 9 % vs septiembre", direction: "up" }} />);
    expect(screen.getByText("▲ 9 % vs septiembre")).toBeInTheDocument();
  });

  it("sin tendencia se ve como antes", () => {
    render(<KpiCard icon={null} label="Ventas" value="C$ 10" hint="Nota" />);
    expect(screen.getByText("Nota")).toBeInTheDocument();
  });
});
