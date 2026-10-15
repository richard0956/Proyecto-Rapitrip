export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** MAIL_MODE=log imprime el correo (desarrollo local). MAIL_MODE=resend lo envía de verdad. */
export async function sendMail(msg: MailMessage): Promise<void> {
  const mode = Deno.env.get("MAIL_MODE") ?? "log";
  if (mode === "log") {
    console.log(`[mail:log] to=${msg.to} subject=${msg.subject}\n${msg.text}`);
    return;
  }
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MAIL_FROM");
  if (!key || !from) {
    throw new Error("RESEND_API_KEY y MAIL_FROM son obligatorios con MAIL_MODE=resend");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text }),
  });
  if (!res.ok) throw new Error(`Resend respondió ${res.status}: ${await res.text()}`);
}