import { describe, expect, it } from "vitest";
import { classifyDeliveryExceptions, exceptionWindows, IGNORED_OFFERS_LIMIT } from "./delivery-exceptions";

const empty = { issues: [], statuses: [], evidence: [], offers: [] };

describe("classifyDeliveryExceptions", () => {
  it("sin nada que mirar, todo vacío", () => {
    expect(classifyDeliveryExceptions(empty)).toEqual({ avisos: [], incompletas: [], marcadas: [], rapidas: [], sinRespuesta: [] });
  });

  it("lista los avisos abiertos con su tipo y motivo, el más reciente primero", () => {
    const out = classifyDeliveryExceptions({ ...empty, issues: [
      { number: 1, kind: "no_cabe", reason: "No cabe", at: "2026-10-23T10:00:00Z" },
      { number: 2, kind: "no_entregado", reason: "Nadie abrió", at: "2026-10-23T11:00:00Z" },
    ] });
    expect(out.avisos.map((a) => a.number)).toEqual([2, 1]);
    expect(out.avisos[0]?.detail).toBe("No se pudo entregar: «Nadie abrió»");
  });

  it("solo marca como incompletos los pedidos en camino o entregados", () => {
    const out = classifyDeliveryExceptions({ ...empty, statuses: [
      { number: 1, status: "entregado", complete: false, at: "2026-10-23T10:00:00Z" },
      { number: 2, status: "en_camino", complete: false, at: "2026-10-23T11:00:00Z" },
      { number: 3, status: "listo", complete: false, at: "2026-10-23T12:00:00Z" },
      { number: 4, status: "entregado", complete: true, at: "2026-10-23T13:00:00Z" },
    ] });
    expect(out.incompletas.map((r) => r.number)).toEqual([2, 1]);
    expect(out.incompletas[1]?.detail).toBe("Entregado sin la evidencia exigida");
  });

  it("muestra las fotos marcadas con su motivo y su distancia", () => {
    const out = classifyDeliveryExceptions({ ...empty, evidence: [
      { number: 5, kind: "entrega", at: "2026-10-23T10:00:00Z", flagged: true, flagReason: "lejos_del_punto", distanceM: 420 },
      { number: 6, kind: "recogida", at: "2026-10-23T11:00:00Z", flagged: true, flagReason: "sin_ubicacion", distanceM: null },
      { number: 7, kind: "entrega", at: "2026-10-23T12:00:00Z", flagged: false, flagReason: null, distanceM: 10 },
    ] });
    expect(out.marcadas.map((r) => r.detail)).toEqual(["Recogida: Sin ubicación al tomar la foto", "Entrega: Tomada lejos del punto marcado (a 420 m)"]);
  });

  it("detecta entregas demasiado rápidas tras la recogida", () => {
    const out = classifyDeliveryExceptions({ ...empty, evidence: [
      { number: 8, kind: "recogida", at: "2026-10-23T10:00:00Z", flagged: false, flagReason: null, distanceM: 5 },
      { number: 8, kind: "entrega", at: "2026-10-23T10:00:40Z", flagged: false, flagReason: null, distanceM: 5 },
      { number: 9, kind: "recogida", at: "2026-10-23T10:00:00Z", flagged: false, flagReason: null, distanceM: 5 },
      { number: 9, kind: "entrega", at: "2026-10-23T10:20:00Z", flagged: false, flagReason: null, distanceM: 5 },
      { number: 10, kind: "entrega", at: "2026-10-23T10:00:00Z", flagged: false, flagReason: null, distanceM: 5 },
    ] });
    expect(out.rapidas.map((r) => r.number)).toEqual([8]);
    expect(out.rapidas[0]?.detail).toBe("Entregado en menos de 1 minuto después de recoger");
  });

  it("avisa de quien deja vencer demasiadas propuestas", () => {
    const offers = [
      ...Array.from({ length: IGNORED_OFFERS_LIMIT }, () => ({ courierName: "Ana", status: "vencida" })),
      { courierName: "Beto", status: "vencida" },
      { courierName: "Beto", status: "rechazada" },
    ];
    expect(classifyDeliveryExceptions({ ...empty, offers }).sinRespuesta).toEqual([{ courier: "Ana", count: IGNORED_OFFERS_LIMIT }]);
  });
});

describe("exceptionWindows", () => {
  it("da 24 horas y 7 días hacia atrás", () => {
    const now = new Date("2026-10-23T12:00:00Z");
    expect(exceptionWindows(now)).toEqual({ day: "2026-10-22T12:00:00.000Z", week: "2026-10-16T12:00:00.000Z" });
  });
});
