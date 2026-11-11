import { readFileSync, writeFileSync } from "node:fs";

// Las pruebas aisladas no necesitan credenciales de Google ni cambian la configuración alojada.
if (!process.env.CI) throw new Error("Este script solo se ejecuta en CI.");
const path = "supabase/config.toml";
const source = readFileSync(path, "utf8");
const section = /(\[auth\.external\.google\]\r?\n)enabled = (true|false)/;
if (!section.test(source)) throw new Error("No se encontró la configuración esperada de Google.");
writeFileSync(path, source.replace(section, "$1enabled = false"));
