import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeliveryCodeCard } from "./delivery-code-card";
import { DeliveryProof } from "./delivery-proof";

describe("DeliveryCodeCard", () => {
  it("muestra el código grande y advierte que no se comparta antes de recibir", () => {
    render(<DeliveryCodeCard code="7305" />);
    expect(screen.getByLabelText("Código de entrega 7 3 0 5")).toHaveTextContent("7305");
    expect(screen.getByText(/No lo compartas antes de recibir/)).toBeInTheDocument();
  });
});

describe("DeliveryProof", () => {
  it("muestra la foto y la hora", () => {
    render(<DeliveryProof proof={{ url: "https://x.test/f.jpg", takenAt: "23 oct, 3:27 p. m.", purged: false }} />);
    expect(screen.getByAltText(/en el lugar de entrega/)).toHaveAttribute("src", "https://x.test/f.jpg");
    expect(screen.getByText(/Tomada el 23 oct/)).toBeInTheDocument();
  });
  it("si la foto ya se eliminó, lo explica sin romper", () => {
    render(<DeliveryProof proof={{ url: null, takenAt: null, purged: true }} />);
    expect(screen.getByText(/se eliminó pasados 3 meses/)).toBeInTheDocument();
  });
  it("si no está disponible, lo dice", () => {
    render(<DeliveryProof proof={{ url: null, takenAt: null, purged: false }} />);
    expect(screen.getByText(/no está disponible/)).toBeInTheDocument();
  });
});
