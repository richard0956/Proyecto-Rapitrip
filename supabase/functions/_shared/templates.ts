export type TemplateName =
  | "invitation" | "commerce_approved" | "commerce_rejected" | "incident_alert" | "order_received" | "order_cancelled";
export interface Rendered { subject: string; html: string; text: string }

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  cajero: "Cajero",
  coordinador: "Coordinador de pedidos",
};

function layout(title: string, body: string): string {
  return `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">`
    + `<h2 style="margin:0 0 16px">${escapeHtml(title)}</h2>${body}`
    + `<p style="color:#666;font-size:12px;margin-top:32px">Rapitrip · Mensaje automático.</p></body></html>`;
}

function money(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? `C$ ${n.toFixed(2)}` : "";
}

function orderUrl(data: Record<string, unknown>): string {
  const base = String(data.store_url ?? "").replace(/\/$/, "");
  return base && data.order_id ? `${base}/pedidos/${data.order_id}` : "";
}

export function renderEmail(template: TemplateName, data: Record<string, unknown>): Rendered {
  switch (template) {
    case "invitation": {
      const role = ROLE_LABELS[String(data.role)] ?? String(data.role);
      const link = String(data.link);
      const subject = "Te invitaron a la consola de Rapitrip";
      const text = `Te invitaron como ${role}. Crea tu acceso aquí: ${link}\nEl enlace vence el ${data.expiresAt} y sirve una sola vez.`;
      const html = layout(subject,
        `<p>Te invitaron como <strong>${escapeHtml(role)}</strong>.</p>`
        + `<p><a href="${escapeHtml(link)}">Crear mi acceso</a></p>`
        + `<p>El enlace vence el ${escapeHtml(data.expiresAt)} y sirve una sola vez.</p>`);
      return { subject, html, text };
    }
    case "commerce_approved": {
      const subject = "Tu afiliación a Rapitrip fue aprobada";
      const url = String(data.console_url ?? "");
      const text = `Aprobamos la afiliación de ${data.business_name}. Entra a la consola: ${url}\nLa primera vez deberás crear una contraseña y activar el segundo factor.`;
      const html = layout(subject,
        `<p>Aprobamos la afiliación de <strong>${escapeHtml(data.business_name)}</strong>.</p>`
        + `<p><a href="${escapeHtml(url)}">Entrar a la consola</a></p>`
        + `<p>La primera vez deberás crear una contraseña y activar el segundo factor.</p>`);
      return { subject, html, text };
    }
    case "commerce_rejected": {
      const subject = "Sobre tu solicitud de afiliación a Rapitrip";
      const text = `No pudimos aprobar la solicitud de ${data.business_name}. Motivo: ${data.reason}\nPuedes volver a solicitarla cuando lo hayas corregido.`;
      const html = layout(subject,
        `<p>No pudimos aprobar la solicitud de <strong>${escapeHtml(data.business_name)}</strong>.</p>`
        + `<p>Motivo: ${escapeHtml(data.reason)}</p>`
        + `<p>Puedes volver a solicitarla cuando lo hayas corregido.</p>`);
      return { subject, html, text };
    }
    case "incident_alert": {
      const subject = `Incidente de gravedad ${data.severity} en Rapitrip`;
      const text = `Se registró un incidente de gravedad ${data.severity}: ${data.description}`;
      const html = layout(subject, `<p>${escapeHtml(text)}</p>`);
      return { subject, html, text };
    }
    case "order_received": {
      const subject = `Recibimos tu pedido ${data.number} en ${data.store_name}`;
      const url = orderUrl(data);
      const text = `Tu pedido ${data.number} en ${data.store_name} (total ${money(data.total)}) está esperando la confirmación del comercio.${url ? ` Sigue su estado: ${url}` : ""}`;
      const html = layout(subject,
        `<p>Tu pedido <strong>${escapeHtml(data.number)}</strong> en <strong>${escapeHtml(data.store_name)}</strong> `
        + `(total ${escapeHtml(money(data.total))}) está esperando la confirmación del comercio.</p>`
        + (url ? `<p><a href="${escapeHtml(url)}">Seguir mi pedido</a></p>` : ""));
      return { subject, html, text };
    }
    case "order_cancelled": {
      const rejected = data.status === "rechazado";
      const subject = `Tu pedido ${data.number} fue ${rejected ? "rechazado" : "cancelado"}`;
      const reason = data.reason ? ` Motivo: ${data.reason}` : "";
      const text = `Tu pedido ${data.number} en ${data.store_name} fue ${rejected ? "rechazado" : "cancelado"}.${reason}`
        + (data.payment_method === "tarjeta" ? " Si ya habías pagado con tarjeta, el reembolso se procesa automáticamente." : "");
      const html = layout(subject,
        `<p>Tu pedido <strong>${escapeHtml(data.number)}</strong> en <strong>${escapeHtml(data.store_name)}</strong> `
        + `fue ${rejected ? "rechazado" : "cancelado"}.</p>`
        + (data.reason ? `<p>Motivo: ${escapeHtml(data.reason)}</p>` : "")
        + (data.payment_method === "tarjeta" ? `<p>Si ya habías pagado con tarjeta, el reembolso se procesa automáticamente.</p>` : ""));
      return { subject, html, text };
    }
    default:
      throw new Error(`plantilla desconocida: ${template}`);
  }
}