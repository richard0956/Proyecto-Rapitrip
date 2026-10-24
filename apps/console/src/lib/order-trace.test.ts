import { describe, expect, it } from "vitest";
import { buildTrace, cashDifference } from "./order-trace";

const base = { courierName: (id: string | null) => (id === "c1" ? "Ana" : "el repartidor"), statusLabel: (s: string) => s.toUpperCase() };

describe("buildTrace", () => {
  it("mezcla estados, propuestas, evidencias y avisos en orden de hora", () => {
    const entries = buildTrace({
      ...base,
      events: [{ to_status: "listo", reason: null, created_at: "2026-10-23T14:00:00Z" }, { to_status: "en_camino", reason: null, created_at: "2026-10-23T14:20:00Z" }],
      offers: [{ courier_id: "c1", status: "aceptada", offered_at: "2026-10-23T14:05:00Z", expires_at: "2026-10-23T14:08:00Z", responded_at: "2026-10-23T14:06:00Z", reject_reason: null }],
      evidence: [{ kind: "recogida", taken_at: "2026-10-23T14:15:00Z", flagged: false, flag_reason: null, distance_m: 40, units_count: 2, note: null, purged_at: null }],
      issues: [],
    });
    expect(entries.map((e) => e.title)).toEqual(["LISTO", "Propuesta a Ana", "Ana aceptó la propuesta", "Foto de recogida en la tienda", "EN_CAMINO"]);
    expect(entries[3]?.detail).toBe("a 40 m del punto · 2 bultos");
  });

  it("una propuesta rechazada o vencida es una alerta y conserva el motivo", () => {
    const entries = buildTrace({
      ...base, events: [], evidence: [], issues: [],
      offers: [
        { courier_id: "c1", status: "rechazada", offered_at: "2026-10-23T14:00:00Z", expires_at: "2026-10-23T14:03:00Z", responded_at: "2026-10-23T14:01:00Z", reject_reason: "Estoy muy lejos" },
        { courier_id: "c1", status: "vencida", offered_at: "2026-10-23T14:10:00Z", expires_at: "2026-10-23T14:13:00Z", responded_at: null, reject_reason: null },
        { courier_id: "c1", status: "pendiente", offered_at: "2026-10-23T14:20:00Z", expires_at: "2026-10-23T14:23:00Z", responded_at: null, reject_reason: null },
      ],
    });
    expect(entries.filter((e) => e.alert).map((e) => e.title)).toEqual(["Ana rechazó la propuesta", "Ana no respondió: la propuesta venció"]);
    expect(entries.find((e) => e.title === "Ana rechazó la propuesta")?.detail).toBe("Estoy muy lejos");
    // La pendiente solo aparece como enviada: aún no tiene desenlace.
    expect(entries.filter((e) => e.title === "Propuesta a Ana")).toHaveLength(3);
  });

  it("una evidencia marcada es una alerta con su explicación", () => {
    const [entry] = buildTrace({ ...base, events: [], offers: [], issues: [], evidence: [{ kind: "entrega", taken_at: "2026-10-23T15:00:00Z", flagged: true, flag_reason: "lejos_del_punto", distance_m: 420, units_count: null, note: null, purged_at: null }] });
    expect(entry).toMatchObject({ alert: true, detail: "Tomada lejos del punto marcado · a 420 m del punto" });
  });

  it("avisa cuando la foto ya se eliminó por antigüedad", () => {
    const [entry] = buildTrace({ ...base, events: [], offers: [], issues: [], evidence: [{ kind: "entrega", taken_at: "2026-07-01T15:00:00Z", flagged: false, flag_reason: null, distance_m: null, units_count: null, note: null, purged_at: "2026-10-01T00:00:00Z" }] });
    expect(entry?.detail).toContain("foto eliminada por antigüedad");
  });

  it("un aviso abierto es alerta; al atenderse deja su constancia", () => {
    const entries = buildTrace({ ...base, events: [], offers: [], evidence: [], issues: [{ kind: "no_entregado", reason: "Nadie abrió", status: "atendida", created_at: "2026-10-23T16:00:00Z", attended_at: "2026-10-23T16:10:00Z", attended_note: "Se reprograma" }] });
    expect(entries.map((e) => e.title)).toEqual(["No se pudo entregar", "Aviso atendido"]);
    expect(entries[0]?.alert).toBe(false);
    expect(entries[1]?.detail).toBe("Se reprograma");
  });

  it("ignora filas sin hora", () => {
    expect(buildTrace({ ...base, offers: [], evidence: [], issues: [], events: [{ to_status: "listo", reason: null, created_at: null }] })).toEqual([]);
  });
});

describe("cashDifference", () => {
  it("cobrar de menos da negativo", () => {
    expect(cashDifference({ method: "efectivo", total: 350, collected: 330, code: "CE-1", receivedAt: null })).toBe(-20);
  });
  it("sin cobro o con tarjeta no hay diferencia", () => {
    expect(cashDifference({ method: "efectivo", total: 350, collected: null, code: null, receivedAt: null })).toBeNull();
    expect(cashDifference({ method: "tarjeta", total: 350, collected: 350, code: null, receivedAt: null })).toBeNull();
  });
  it("sin errores de redondeo", () => {
    expect(cashDifference({ method: "efectivo", total: 0.1 + 0.2, collected: 0.3, code: null, receivedAt: null })).toBe(0);
  });
});
