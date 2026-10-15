import { assertEquals, assertMatch, assertNotEquals } from "jsr:@std/assert@1";
import { generateToken, sha256Hex } from "./token.ts";

Deno.test("generateToken produce 43 caracteres base64url distintos cada vez", () => {
  const a = generateToken();
  const b = generateToken();
  assertMatch(a, /^[A-Za-z0-9_-]{43}$/);
  assertNotEquals(a, b);
});

Deno.test("sha256Hex es determinista y coincide con el vector conocido de 'abc'", async () => {
  assertEquals(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});