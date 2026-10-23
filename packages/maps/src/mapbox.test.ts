import { afterEach, describe, expect, it, vi } from "vitest";
import { reverseGeocode } from "./mapbox";

afterEach(() => vi.unstubAllGlobals());

const point = { lat: 12.128, lng: -86.2649 };
const reply = (body: unknown, ok = true) => vi.fn().mockResolvedValue({ ok, json: async () => body });

describe("reverseGeocode", () => {
  it("devuelve la dirección completa sin el país", async () => {
    const fetchMock = reply({ features: [{ properties: { full_address: "Paseo de la Unión Europea, Managua, Nicaragua" } }] });
    vi.stubGlobal("fetch", fetchMock);
    expect(await reverseGeocode(point, "pk.test")).toBe("Paseo de la Unión Europea, Managua");
    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain("longitude=-86.2649");
    expect(url).toContain("latitude=12.128");
    expect(url).toContain("country=ni");
  });

  it("si solo hay barrio, arma la dirección con el nombre y el lugar", async () => {
    vi.stubGlobal("fetch", reply({ features: [{ properties: { name: "Villa Fontana", place_formatted: "Managua, Departamento de Managua, Nicaragua" } }] }));
    expect(await reverseGeocode(point, "pk.test")).toBe("Villa Fontana, Managua, Departamento de Managua");
  });

  it("devuelve null si no encuentra nada o el servicio falla", async () => {
    vi.stubGlobal("fetch", reply({ features: [] }));
    expect(await reverseGeocode(point, "pk.test")).toBeNull();
    vi.stubGlobal("fetch", reply({}, false));
    expect(await reverseGeocode(point, "pk.test")).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("red")));
    expect(await reverseGeocode(point, "pk.test")).toBeNull();
  });
});
