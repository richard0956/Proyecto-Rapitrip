import { describe, expect, it } from "vitest";
import { initials } from "./avatar";

describe("initials", () => {
  it("toma la primera y la última palabra", () => {
    expect(initials("Alex Rivera")).toBe("AR");
    expect(initials("María José López")).toBe("ML");
    expect(initials("andrea")).toBe("A");
    expect(initials(null)).toBe("·");
  });
});
