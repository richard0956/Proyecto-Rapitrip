import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer, connect } from "node:net";
import { fileURLToPath } from "node:url";

const apps = { store: 3000, console: 3001, dealer: 3002 };
const app = process.argv[2] || "store";
if (!Object.hasOwn(apps, app)) {
  console.error("Aplicación desconocida. Usa store, console o dealer.");
  process.exit(1);
}
const port = Number(process.env.PORT || apps[app]);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error("PORT debe ser un puerto entre 1024 y 65535.");
  process.exit(1);
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error("Completa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en el .env.local de la aplicación.");
  process.exit(1);
}

let backend;
try {
  backend = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!["http:", "https:"].includes(backend.protocol)) throw new Error("Protocolo inválido");
} catch {
  console.error("NEXT_PUBLIC_SUPABASE_URL debe ser una URL HTTP o HTTPS válida.");
  process.exit(1);
}

// El navegador usa 127.0.0.1 del equipo, mientras que el SSR usa el del contenedor.
// Este puente conserva la misma URL pública y también transporta WebSockets.
let bridge;
const sockets = new Set();
if (["127.0.0.1", "localhost", "[::1]"].includes(backend.hostname)) {
  const backendPort = Number(backend.port || (backend.protocol === "https:" ? 443 : 80));
  const target = process.env.DOCKER_HOST_ADDRESS || "host.docker.internal";
  bridge = createServer((client) => {
    const upstream = connect({ host: target, port: backendPort });
    for (const socket of [client, upstream]) {
      sockets.add(socket);
      socket.once("close", () => sockets.delete(socket));
    }
    client.on("error", () => upstream.destroy());
    upstream.on("error", (error) => {
      console.error(`No se pudo conectar con Supabase en ${target}:${backendPort}: ${error.code}`);
      client.destroy();
    });
    client.once("close", () => upstream.destroy());
    client.pipe(upstream).pipe(client);
  });
  try {
    await new Promise((resolve, reject) => {
      bridge.once("error", reject);
      // localhost puede resolverse a IPv4 o IPv6; sin host Node acepta ambos.
      const host = backend.hostname === "localhost" ? undefined : backend.hostname.replace(/[\[\]]/g, "");
      bridge.listen(backendPort, host, resolve);
    });
  } catch (error) {
    console.error(`No se pudo iniciar el puente local de Supabase: ${error.message}`);
    process.exit(1);
  }
  console.log(`Supabase local: puente hacia ${target}:${backendPort} listo.`);
}

const cwd = fileURLToPath(new URL(`../../apps/${app}/`, import.meta.url));
const require = createRequire(`${cwd}package.json`);
const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "--hostname", "0.0.0.0", "--port", String(port)], {
  cwd,
  stdio: "inherit",
  env: { ...process.env, PORT: String(port), NODE_ENV: "development" },
});

function finish(code) {
  for (const socket of sockets) socket.destroy();
  bridge?.close();
  process.exit(code);
}
child.once("error", (error) => { console.error(error.message); finish(1); });
child.once("exit", (code, signal) => finish(code ?? (signal === "SIGTERM" || signal === "SIGINT" ? 0 : 1)));
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => child.kill(signal));
}
