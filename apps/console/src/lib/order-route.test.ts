import { describe, expect, it } from "vitest";
import { toRoutePoints } from "./order-route";

describe("toRoutePoints", () => {
  it("arma los dos puntos cuando hay coordenadas", () => {
    expect(toRoutePoints({ store_name: "Tienda A", store_latitude: 12.128, store_longitude: -86.2649, dest_latitude: 12.1594, dest_longitude: -86.2744 })).toEqual({
      storeName: "Tienda A",
      store: { lat: 12.128, lng: -86.2649 },
      destination: { lat: 12.1594, lng: -86.2744 },
    });
  });

  it("deja en nulo el punto que falta", () => {
    expect(toRoutePoints({ store_name: "Tienda B", store_latitude: null, store_longitude: null, dest_latitude: 12.1594, dest_longitude: -86.2744 })).toMatchObject({ store: null });
    expect(toRoutePoints({ store_name: null, store_latitude: 12.128, store_longitude: -86.2649, dest_latitude: null, dest_longitude: null })).toMatchObject({ storeName: "", destination: null });
  });
});
