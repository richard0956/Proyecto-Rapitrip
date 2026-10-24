import { describe, expect, it } from "vitest";
import { formatCountdown, rejectReasons, secondsLeft } from "./offers";

describe("secondsLeft", () => {
  const now = Date.parse("2026-10-23T12:00:00Z");
  it("cuenta hacia arriba el segundo parcial", () => {
    expect(secondsLeft("2026-10-23T12:02:30Z", now)).toBe(150);
    expect(secondsLeft("2026-10-23T12:00:00.400Z", now)).toBe(1);
  });
  it("nunca baja de cero ni falla con datos malos", () => {
    expect(secondsLeft("2026-10-23T11:59:00Z", now)).toBe(0);
    expect(secondsLeft(null, now)).toBe(0);
    expect(secondsLeft("no es una fecha", now)).toBe(0);
  });
});

describe("formatCountdown", () => {
  it("muestra minutos y segundos", () => {
    expect(formatCountdown(150)).toBe("2:30");
    expect(formatCountdown(65)).toBe("1:05");
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(-5)).toBe("0:00");
  });
});

describe("rejectReasons", () => {
  it("todos cumplen el mínimo de 5 caracteres de la base de datos", () => {
    expect(rejectReasons.every((reason) => reason.length >= 5 && reason.length <= 200)).toBe(true);
  });
});
