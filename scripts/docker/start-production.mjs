const app = process.env.APP_NAME;
if (!["store", "console", "dealer"].includes(app)) throw new Error("APP_NAME inválido.");
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT inválido.");
// Railway establece PORT; HOSTNAME debe aceptar conexiones desde su proxy.
process.env.PORT = String(port);
process.env.HOSTNAME = "0.0.0.0";
await import(new URL(`../../apps/${app}/server.js`, import.meta.url));
