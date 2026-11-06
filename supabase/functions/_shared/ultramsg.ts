/** Cliente mínimo de UltraMsg (API de WhatsApp). Los secretos viven solo en las variables de entorno de las funciones. */

/** El número no sirve: no se envía y no tiene sentido reintentar. */
export class InvalidPhoneError extends Error {}

/**
 * Teléfono de Nicaragua (código 505, 8 dígitos que empiezan en 2, 5, 7 u 8) a formato internacional `+505XXXXXXXX`.
 * Acepta «8888-1234», «+505 8888 1234», «(505) 88881234», «00505 88881234». Devuelve `null` si no es válido.
 */
export function normalizeNicaraguaPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/[\s().-]/g, "");
  if (!/^\+?[0-9]+$/.test(digits)) return null;
  digits = digits.replace(/^\+/, "").replace(/^00/, "");
  if (digits.length === 11 && digits.startsWith("505")) digits = digits.slice(3);
  return /^[2578][0-9]{7}$/.test(digits) ? `+505${digits}` : null;
}

export function ultramsgConfigured(): boolean {
  return Boolean(Deno.env.get("ULTRAMSG_INSTANCE_ID") && Deno.env.get("ULTRAMSG_TOKEN"));
}

/** Envía un texto. Lanza `InvalidPhoneError` si el número no es válido y `Error` si UltraMsg lo rechaza o no responde. */
export async function sendWhatsApp(
  msg: { to: string; body: string },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const instance = Deno.env.get("ULTRAMSG_INSTANCE_ID");
  const token = Deno.env.get("ULTRAMSG_TOKEN");
  if (!instance || !token) throw new Error("ULTRAMSG_INSTANCE_ID y ULTRAMSG_TOKEN son obligatorios para enviar WhatsApp");
  const to = normalizeNicaraguaPhone(msg.to);
  if (!to) throw new InvalidPhoneError("teléfono no válido para Nicaragua (se esperan 8 dígitos con código 505)");

  const res = await fetchImpl(`https://api.ultramsg.com/${encodeURIComponent(instance)}/messages/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token, to, body: msg.body }).toString(),
  });
  const text = await res.text();
  let json: { sent?: unknown; error?: unknown; message?: unknown } = {};
  try {
    json = JSON.parse(text);
  } catch { /* respuesta que no es JSON: se informa abajo */ }
  const accepted = res.ok && json.error === undefined && String(json.sent ?? "true") !== "false";
  if (!accepted) {
    // Nunca se incluye el token en el error: el mensaje termina en la bandeja de la base de datos.
    throw new Error(`UltraMsg respondió ${res.status}: ${String(json.error ?? json.message ?? text).slice(0, 200)}`);
  }
}
