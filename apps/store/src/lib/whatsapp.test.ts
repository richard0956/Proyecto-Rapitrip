import { describe, expect, it } from "vitest";
import { whatsappLink } from "./whatsapp";

describe("whatsappLink", () => {
  it("arma el enlace wa.me solo con dígitos", () => {
    expect(whatsappLink("+505 8888-1234")).toBe("https://wa.me/50588881234");
  });
  it("codifica el texto inicial", () => {
    expect(whatsappLink("50588881234", "Hola, necesito ayuda")).toBe("https://wa.me/50588881234?text=Hola%2C%20necesito%20ayuda");
  });
  it("sin número válido no hay enlace", () => {
    expect(whatsappLink("")).toBeNull();
    expect(whatsappLink("123")).toBeNull();
  });
});
