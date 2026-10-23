import { describe, expect, it } from "vitest";
import { mapsUrl, telHref } from "./links";

describe("mapsUrl", () => {
  it("prefiere el punto exacto", () => {
    expect(mapsUrl({ latitude: 12.14, longitude: -86.25, address: "Barrio Central" })).toBe("https://www.google.com/maps/search/?api=1&query=12.14,-86.25");
  });
  it("sin punto usa la dirección escrita y la codifica", () => {
    expect(mapsUrl({ address: "Km 5, local 3" })).toBe("https://www.google.com/maps/search/?api=1&query=Km%205%2C%20local%203");
  });
  it("sin nada devuelve nulo", () => {
    expect(mapsUrl({})).toBeNull();
    expect(mapsUrl({ address: "  " })).toBeNull();
  });
});

describe("telHref", () => {
  it("deja solo dígitos y +", () => {
    expect(telHref("(505) 8888-1111")).toBe("tel:50588881111");
    expect(telHref("+505 8888 1111")).toBe("tel:+50588881111");
  });
  it("un teléfono demasiado corto o vacío no genera enlace", () => {
    expect(telHref("123")).toBeNull();
    expect(telHref(null)).toBeNull();
  });
});
