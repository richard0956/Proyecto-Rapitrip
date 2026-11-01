import { describe, expect, it } from "vitest";
import { defaultPrefs, parsePrefs } from "./prefs";

describe("parsePrefs", () => {
  it("sin nada guardado usa los predeterminados", () => {
    expect(parsePrefs(null)).toEqual(defaultPrefs);
  });

  it("respeta lo guardado", () => {
    expect(parsePrefs(JSON.stringify({ maps: "waze", alert: false, awake: false }))).toEqual({ maps: "waze", alert: false, awake: false });
  });

  it("un valor raro o un texto dañado vuelve al predeterminado de ese campo", () => {
    expect(parsePrefs(JSON.stringify({ maps: "bing", alert: "sí", awake: false }))).toEqual({ ...defaultPrefs, awake: false });
    expect(parsePrefs("{no es json")).toEqual(defaultPrefs);
  });
});
