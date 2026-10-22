import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRoute, formatDistance, formatMinutes } from "./route";

afterEach(() => vi.unstubAllGlobals());

const from = { lat: 12.128, lng: -86.2649 };
const to = { lat: 12.1594, lng: -86.2744 };

describe("fetchRoute", () => {
  it("devuelve distancia, tiempo y trazo", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [{ distance: 5400, duration: 900, geometry: { coordinates: [[-86.2649, 12.128], [-86.2744, 12.1594]] } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const route = await fetchRoute(from, to, "pk.test");
    expect(route).toEqual({ distanceKm: 5.4, minutes: 15, coordinates: [[-86.2649, 12.128], [-86.2744, 12.1594]] });
    // Mapbox espera longitud,latitud.
    expect(String(fetchMock.mock.calls[0]![0])).toContain("/driving/-86.2649,12.128;-86.2744,12.1594");
  });

  it("devuelve null si el servicio falla o no hay camino", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await fetchRoute(from, to, "pk.test")).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ routes: [] }) }));
    expect(await fetchRoute(from, to, "pk.test")).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("red")));
    expect(await fetchRoute(from, to, "pk.test")).toBeNull();
  });
});

describe("formato", () => {
  it("distancia en metros o kilómetros", () => {
    expect(formatDistance(0.85)).toBe("850 m");
    expect(formatDistance(1.34)).toBe("1,3 km");
    expect(formatDistance(12)).toBe("12,0 km");
  });
  it("tiempo en minutos u horas", () => {
    expect(formatMinutes(0.2)).toBe("1 min");
    expect(formatMinutes(14.4)).toBe("14 min");
    expect(formatMinutes(65)).toBe("1 h 5 min");
    expect(formatMinutes(120)).toBe("2 h");
  });
});
