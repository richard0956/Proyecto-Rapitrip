import { assertEquals } from "jsr:@std/assert@1";
import { isCoordinate, isUuid, roadDistanceKm } from "./mapbox.ts";

const from = { lat: 12.128, lng: -86.2649 };
const to = { lat: 12.1594, lng: -86.2744 };

const reply = (body: unknown, ok = true) => (() => Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response)) as typeof fetch;

Deno.test("devuelve los kilómetros por calle de la primera ruta", async () => {
  assertEquals(await roadDistanceKm(from, to, "pk.test", reply({ routes: [{ distance: 5430 }] })), 5.43);
});

Deno.test("manda longitud,latitud y el token a la API", async () => {
  let called = "";
  const spy = ((url: string) => {
    called = url;
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ routes: [{ distance: 1000 }] }) } as Response);
  }) as unknown as typeof fetch;
  await roadDistanceKm(from, to, "pk.test", spy);
  assertEquals(called.includes("/driving/-86.2649,12.128;-86.2744,12.1594"), true);
  assertEquals(called.includes("access_token=pk.test"), true);
});

Deno.test("sin token, con error del servicio o sin ruta devuelve null (se usa el respaldo)", async () => {
  assertEquals(await roadDistanceKm(from, to, "", reply({ routes: [{ distance: 5000 }] })), null);
  assertEquals(await roadDistanceKm(from, to, "pk.test", reply({}, false)), null);
  assertEquals(await roadDistanceKm(from, to, "pk.test", reply({ routes: [] })), null);
  assertEquals(await roadDistanceKm(from, to, "pk.test", reply({ routes: [{ distance: 0 }] })), null);
  assertEquals(await roadDistanceKm(from, to, "pk.test", (() => Promise.reject(new Error("red"))) as typeof fetch), null);
});

Deno.test("si el servicio tarda más que el límite se rinde", async () => {
  const slow = ((_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("abort", "AbortError"))))) as unknown as typeof fetch;
  assertEquals(await roadDistanceKm(from, to, "pk.test", slow, 20), null);
});

Deno.test("valida identificadores y coordenadas", () => {
  assertEquals(isUuid("11111111-1111-4111-8111-111111111111"), true);
  assertEquals(isUuid("no-es-uuid"), false);
  assertEquals(isCoordinate(12.13, 90), true);
  assertEquals(isCoordinate(Number.NaN, 90), false);
  assertEquals(isCoordinate("12", 90), false);
  assertEquals(isCoordinate(95, 90), false);
});
