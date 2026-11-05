import { Card } from "@rapitrip/ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));

import { BlockReveal, collectBlocks, paceFor } from "./block-reveal";

describe("entrada de los bloques", () => {
  it("cada tarjeta es un bloque; un contenedor con tarjetas se abre y las piezas sueltas cuentan solas", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <header id="encabezado"><h1>Inicio</h1></header>
      <div id="cuadricula"><div data-block id="kpi-1"><div data-block id="anidada"></div></div><div data-block id="kpi-2"></div></div>
      <p id="nota">Texto</p>
      <dialog id="dialogo"><div data-block></div></dialog>`;
    expect(collectBlocks(root).map((block) => block.id)).toEqual(["encabezado", "kpi-1", "kpi-2", "nota"]);
  });

  it("marca los bloques antes de pintar y deja el contenido en la página", () => {
    render(
      <BlockReveal>
        <h1>Resumen</h1>
        <div className="grid">
          <Card>Ventas</Card>
          <Card>Pedidos</Card>
        </div>
      </BlockReveal>,
    );
    const wrapper = screen.getByText("Resumen").parentElement!;
    expect(wrapper).toHaveAttribute("data-ready");
    // Sin IntersectionObserver (jsdom) todo queda visible de una vez.
    expect(screen.getByText("Resumen")).toHaveAttribute("data-reveal");
    expect(screen.getByText("Ventas").parentElement).toHaveAttribute("data-reveal");
    expect(screen.getByText("Pedidos").parentElement).toHaveAttribute("data-reveal");
  });

  it("el inicio de cada área va con el ritmo pausado; el resto, con el normal", () => {
    expect(paceFor("/admin")).toBe("inicio");
    expect(paceFor("/caja")).toBe("inicio");
    expect(paceFor("/admin/pedidos")).toBe("normal");
    expect(paceFor("/cuenta")).toBe("normal");
    expect(paceFor(null)).toBe("normal");
  });
});
