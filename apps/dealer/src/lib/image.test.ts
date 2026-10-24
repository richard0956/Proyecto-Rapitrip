import { Blob as NodeBlob } from "node:buffer";
import { describe, expect, it } from "vitest";
import { MAX_SIDE, scaledSize, sha256Hex } from "./image";

describe("scaledSize", () => {
  it("no agranda una imagen que ya cabe", () => {
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(scaledSize(MAX_SIDE, 900)).toEqual({ width: MAX_SIDE, height: 900 });
  });
  it("reduce manteniendo la proporción", () => {
    expect(scaledSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(scaledSize(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });
  it("nunca da una dimensión menor a 1", () => {
    expect(scaledSize(100000, 10).height).toBeGreaterThanOrEqual(1);
  });
});

// jsdom no implementa Blob.arrayBuffer (los navegadores sí): la prueba usa el Blob de Node.
describe("sha256Hex", () => {
  it("calcula la huella conocida de un texto", async () => {
    expect(await sha256Hex(new NodeBlob(["abc"]) as unknown as Blob)).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("cambia si cambia un solo byte", async () => {
    expect(await sha256Hex(new NodeBlob(["abc"]) as unknown as Blob)).not.toBe(await sha256Hex(new NodeBlob(["abd"]) as unknown as Blob));
  });
});
