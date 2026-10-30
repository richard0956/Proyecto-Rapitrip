import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrderProgress } from "./order-progress";

describe("OrderProgress", () => {
  it("el pedido Express viaja en moto y marca el paso actual", () => {
    const { container } = render(<OrderProgress step={2} deliveryClass="express" finished={false} />);
    expect(container.querySelector('[data-vehiculo="moto"]')).not.toBeNull();
    expect(container.querySelector('[data-vehiculo="camion"]')).toBeNull();
    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(6);
    expect(steps[2]).toHaveAttribute("aria-current", "step");
    expect(steps[2]).toHaveTextContent("Preparando");
  });

  it("el pedido programado viaja en camión", () => {
    const { container } = render(<OrderProgress step={0} deliveryClass="programado" finished={false} />);
    expect(container.querySelector('[data-vehiculo="camion"]')).not.toBeNull();
    expect(container.querySelector('[data-vehiculo="moto"]')).toBeNull();
  });

  it("el vehículo avanza en proporción al paso y se queda quieto al terminar", () => {
    const { container, rerender } = render(<OrderProgress step={5} deliveryClass="express" finished />);
    expect(container.querySelector<HTMLElement>(".progreso-vehiculo")?.style.left).toBe("100%");
    expect(container.querySelector(".progreso-bob")).toBeNull();
    expect(container.querySelector(".progreso-late")).toBeNull();
    rerender(<OrderProgress step={1} deliveryClass="express" finished={false} />);
    expect(container.querySelector<HTMLElement>(".progreso-vehiculo")?.style.left).toBe("20%");
    expect(container.querySelector(".progreso-bob")).not.toBeNull();
    expect(container.querySelector(".progreso-late")).not.toBeNull();
  });

  it("sin pagar todavía, el vehículo espera en el primer punto y ningún paso está actual", () => {
    const { container } = render(<OrderProgress step={-1} deliveryClass="express" finished={false} />);
    expect(container.querySelector<HTMLElement>(".progreso-vehiculo")?.style.left).toBe("0%");
    expect(container.querySelector("[aria-current]")).toBeNull();
  });
});
