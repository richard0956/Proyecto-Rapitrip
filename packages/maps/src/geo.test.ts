import { describe, expect, it } from "vitest";
import { distanceKm, formatPoint, isInNicaragua, MANAGUA, nudge, roundPoint } from "./geo";

describe("geo", () => {
  it("reconoce puntos dentro de Nicaragua y descarta el resto", () => {
    expect(isInNicaragua(MANAGUA)).toBe(true);
    expect(isInNicaragua({ lat: 12.4, lng: -86.0 })).toBe(true); // Tipitapa
    expect(isInNicaragua({ lat: 10.0, lng: -84.0 })).toBe(false); // Costa Rica
    expect(isInNicaragua({ lat: 40.7, lng: -74.0 })).toBe(false); // Nueva York
    expect(isInNicaragua({ lat: Number.NaN, lng: -86 })).toBe(false);
  });

  it("redondea a seis decimales", () => {
    expect(roundPoint({ lat: 12.13641234567, lng: -86.25149999999 })).toEqual({ lat: 12.136412, lng: -86.2515 });
  });

  it("da formato legible al punto", () => {
    expect(formatPoint({ lat: 12.1364, lng: -86.2514 })).toBe("12.13640, -86.25140");
  });

  it("mueve el punto unos metros en cada dirección", () => {
    const start = { lat: 12.1364, lng: -86.2514 };
    expect(nudge(start, "norte").lat).toBeGreaterThan(start.lat);
    expect(nudge(start, "sur").lat).toBeLessThan(start.lat);
    expect(nudge(start, "este").lng).toBeGreaterThan(start.lng);
    expect(nudge(start, "oeste").lng).toBeLessThan(start.lng);
    // El desplazamiento solicitado coincide con la distancia real.
    expect(distanceKm(start, nudge(start, "norte", 10)) * 1000).toBeCloseTo(10, 0);
  });

  it("calcula la distancia en línea recta", () => {
    // Catedral → Metrocentro: unos 0,5 km
    const km = distanceKm({ lat: 12.1327, lng: -86.266 }, { lat: 12.128, lng: -86.2649 });
    expect(km).toBeGreaterThan(0.4);
    expect(km).toBeLessThan(0.7);
  });
});
