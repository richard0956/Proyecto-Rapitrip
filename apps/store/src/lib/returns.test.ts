import { describe, expect, it } from "vitest";
import { MAX_RETURN_PHOTO_BYTES, MAX_RETURN_PHOTOS, photoPath, photoProblem, returnStatusText, withinReturnWindow } from "./returns";

const photo = (overrides: Partial<{ name: string; size: number; type: string }> = {}) => ({ name: "foto.jpg", size: 1000, type: "image/jpeg", ...overrides });

describe("photoProblem", () => {
  it("pide al menos una foto", () => {
    expect(photoProblem([])).not.toBeNull();
  });

  it("acepta de 1 a 5 fotos JPG, PNG o WebP", () => {
    expect(photoProblem([photo()])).toBeNull();
    expect(photoProblem([photo({ type: "image/png" }), photo({ type: "image/webp" })])).toBeNull();
  });

  it("rechaza más de 5 fotos", () => {
    expect(photoProblem(Array.from({ length: MAX_RETURN_PHOTOS + 1 }, () => photo()))).not.toBeNull();
  });

  it("rechaza archivos que no son imagen", () => {
    expect(photoProblem([photo({ type: "application/pdf", name: "doc.pdf" })])).toContain("doc.pdf");
  });

  it("rechaza fotos de más de 8 MB", () => {
    expect(photoProblem([photo({ size: MAX_RETURN_PHOTO_BYTES + 1 })])).toContain("8 MB");
  });
});

describe("withinReturnWindow", () => {
  const now = new Date("2026-10-21T12:00:00Z");

  it("acepta una entrega de hace 3 días o menos", () => {
    expect(withinReturnWindow("2026-10-18T12:00:00Z", now)).toBe(true);
    expect(withinReturnWindow("2026-10-20T08:00:00Z", now)).toBe(true);
  });

  it("rechaza una entrega de más de 3 días", () => {
    expect(withinReturnWindow("2026-10-18T11:59:00Z", now)).toBe(false);
  });

  it("rechaza un pedido sin fecha de entrega", () => {
    expect(withinReturnWindow(null, now)).toBe(false);
  });
});

describe("photoPath", () => {
  it("empieza por el id del cliente, como exige la base de datos", () => {
    const path = photoPath("cliente-1", "pedido-2", 0, "Foto Empaque.JPG", 1700000000000);
    expect(path).toBe("cliente-1/pedido-2/1700000000000-0.jpg");
    expect(path.split("/")[0]).toBe("cliente-1");
  });
});

describe("returnStatusText", () => {
  it("explica que la solicitud sigue en revisión", () => {
    expect(returnStatusText("solicitada", "tarjeta").title).toBe("Solicitud en revisión");
  });

  it("dice cómo se devuelve el dinero según el pago", () => {
    expect(returnStatusText("aprobada", "tarjeta").detail).toContain("tarjeta");
    expect(returnStatusText("aprobada", "efectivo").detail).toContain("efectivo");
  });

  it("marca como no aprobada una devolución rechazada", () => {
    expect(returnStatusText("rechazada", "efectivo").title).toBe("Devolución no aprobada");
  });
});
