import { assertEquals } from "jsr:@std/assert@1";
import { toCsv } from "./csv.ts";

Deno.test("toCsv escribe encabezados y filas con CRLF", () => {
  assertEquals(toCsv([{ a: 1, b: "x" }, { a: 2, b: "y" }]), "a,b\r\n1,x\r\n2,y\r\n");
});

Deno.test("toCsv escapa comas, comillas y saltos de línea", () => {
  assertEquals(toCsv([{ t: 'dijo "hola", ya' }]), 't\r\n"dijo ""hola"", ya"\r\n');
  assertEquals(toCsv([{ t: "a\nb" }]), 't\r\n"a\nb"\r\n');
});

Deno.test("toCsv neutraliza fórmulas de hoja de cálculo en textos, no en números", () => {
  assertEquals(toCsv([{ t: "=1+1", n: -5 }]), "t,n\r\n'=1+1,-5\r\n");
  assertEquals(toCsv([{ t: "@cmd" }, { t: "+52" }, { t: "-x" }]), "t\r\n'@cmd\r\n'+52\r\n'-x\r\n");
});

Deno.test("toCsv deja vacíos null y undefined, y serializa objetos", () => {
  assertEquals(toCsv([{ a: null, b: undefined, c: { k: 1 } }]), 'a,b,c\r\n,,"{""k"":1}"\r\n');
});

Deno.test("toCsv de una lista vacía es una cadena vacía", () => {
  assertEquals(toCsv([]), "");
});