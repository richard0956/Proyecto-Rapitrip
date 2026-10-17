import { describe, expect, it } from "vitest";
import { timeAgo } from "./format";

const now = Date.parse("2026-10-17T12:00:00Z");

describe("timeAgo", () => {
  it("expresa días, horas y minutos en español", () => {
    expect(timeAgo("2026-10-14T12:00:00Z", now)).toBe("hace 3 días");
    expect(timeAgo("2026-10-15T12:00:00Z", now)).toBe("anteayer");
    expect(timeAgo("2026-10-16T12:00:00Z", now)).toBe("ayer");
    expect(timeAgo("2026-10-17T07:00:00Z", now)).toBe("hace 5 horas");
    expect(timeAgo("2026-10-17T11:30:00Z", now)).toBe("hace 30 minutos");
  });

  it("maneja el instante actual y los valores vacíos", () => {
    expect(timeAgo("2026-10-17T11:59:50Z", now)).toBe("hace un momento");
    expect(timeAgo(null, now)).toBe("—");
  });
});
