import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const deps = 'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1105-1297-0_26.1105.1297.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules';
const pdfjs = await import(pathToFileURL(path.join(deps, 'pdfjs-dist/legacy/build/pdf.mjs')).href);
const require = createRequire(path.join(deps, 'pdfjs-dist/package.json'));
const { createCanvas } = require('@napi-rs/canvas');
const input = 'C:/Users/alexa/Proyecto RT/docs/entregables/arquitectura_actualizada_revision.pdf';
const outDir = 'C:/Users/alexa/Proyecto RT/tmp/arquitectura_paginas';
fs.mkdirSync(outDir, { recursive: true });
const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(input)), useSystemFonts: true, disableFontFace: false }).promise;
for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const viewport = page.getViewport({ scale: 1.6 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');
  await page.render({ canvasContext: context, viewport, canvas }).promise;
  fs.writeFileSync(path.join(outDir, `page-${i}.png`), canvas.toBuffer('image/png'));
}
console.log(`${pdf.numPages} pages rendered`);
