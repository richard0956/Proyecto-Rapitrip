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
  repartidor: "Repartidor",
  comercio: "Comercio",
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

type DocRef = { kind: string; number: string };
const DOC_LABELS: Record<string, string> = {
  venta: "factura de venta",
  servicio: "factura de servicio",
  nota_credito_venta: "nota de crédito de venta",
  nota_credito_servicio: "nota de crédito de servicio",
};

/** Documentos que la base de datos agregó al correo (facturas o notas de crédito); ignora lo que no tenga la forma esperada. */
function docRefs(value: unknown): DocRef[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const doc = item as Partial<DocRef> | null;
    return doc && typeof doc.number === "string" && typeof doc.kind === "string" ? [{ kind: doc.kind, number: doc.number }] : [];
  });
}

const docLabel = (doc: DocRef) => DOC_LABELS[doc.kind] ?? "documento";
const FISCAL_NOTE = "Son comprobantes internos de Rapitrip, sin validez fiscal.";

function orderUrl(data: Record<string, unknown>): string {
  const base = String(data.store_url ?? "").replace(/\/$/, "");
  return base && data.order_id ? `${base}/pedidos/${data.order_id}` : "";
}

export function renderEmail(template: TemplateName, data: Record<string, unknown>): Rendered {
  switch (template) {
    case "invitation": {
      const role = ROLE_LABELS[String(data.role)] ?? String(data.role);
      const link = String(data.link);
      const subject = String(data.role) === "repartidor" ? "Te invitaron a Rapitrip como repartidor" : "Te invitaron a la consola de Rapitrip";
      const text = `Te invitaron como ${role}. Crea tu acceso aquí: ${link}\nEl enlace vence el ${data.expiresAt} y sirve una sola vez.`;
      const html = layout(subject,
        `<p>Te invitaron como <strong>${escapeHtml(role)}</strong>.</p>`
        + `<p><a href="${escapeHtml(link)}">Crear mi acceso</a></p>`
        + `<p>El enlace vence el ${escapeHtml(data.expiresAt)} y sirve una sola vez.</p>`);
      return { subject, html, text };
    }
    case "commerce_approved": {
      // Zero Trust: la cuenta de la tienda no entra a la consola; la invitación llega al correo que el negocio dio para eso.
      const subject = "Tu afiliación a Rapitrip fue aprobada";
      const consoleEmail = String(data.console_email ?? "");
      const text = `Aprobamos la afiliación de ${data.business_name}. Enviamos la invitación a la consola a ${consoleEmail}: ábrela desde ese correo para crear el acceso del negocio.
Tu cuenta de la tienda sigue siendo solo para comprar.`;
      const html = layout(subject,
        `<p>Aprobamos la afiliación de <strong>${escapeHtml(data.business_name)}</strong>.</p>`
        + `<p>Enviamos la invitación a la consola a <strong>${escapeHtml(consoleEmail)}</strong>: ábrela desde ese correo para crear el acceso del negocio, con su contraseña y el segundo factor.</p>`
        + `<p>Tu cuenta de la tienda sigue siendo solo para comprar.</p>`);
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
      const invoices = docRefs(data.invoices);
      const invoiceText = invoices.length > 0 ? ` Emitimos ${invoices.map((doc) => `${docLabel(doc)} ${doc.number}`).join(" y ")}${url ? "; las descargas en PDF desde tu pedido" : ""}. ${FISCAL_NOTE}` : "";
      const text = `Tu pedido ${data.number} en ${data.store_name} (total ${money(data.total)}) está esperando la confirmación del comercio.${url ? ` Sigue su estado: ${url}` : ""}${invoiceText}`;
      const html = layout(subject,
        `<p>Tu pedido <strong>${escapeHtml(data.number)}</strong> en <strong>${escapeHtml(data.store_name)}</strong> `
        + `(total ${escapeHtml(money(data.total))}) está esperando la confirmación del comercio.</p>`
        + (url ? `<p><a href="${escapeHtml(url)}">Seguir mi pedido</a></p>` : "")
        + (invoices.length > 0
          ? `<p>Emitimos:</p><ul>${invoices.map((doc) => `<li>${escapeHtml(docLabel(doc))} <strong>${escapeHtml(doc.number)}</strong></li>`).join("")}</ul>`
            + `<p style="color:#666;font-size:13px">${url ? "Puedes descargarlas en PDF desde tu pedido. " : ""}${escapeHtml(FISCAL_NOTE)}</p>`
          : ""));
      return { subject, html, text };
    }
    case "order_cancelled": {
      const rejected = data.status === "rechazado";
      const subject = `Tu pedido ${data.number} fue ${rejected ? "rechazado" : "cancelado"}`;
      const reason = data.reason ? ` Motivo: ${data.reason}` : "";
      const notes = docRefs(data.credit_notes);
      const notesText = notes.length > 0 ? ` Anulamos tus facturas con ${notes.map((doc) => `${docLabel(doc)} ${doc.number}`).join(" y ")}.` : "";
      const text = `Tu pedido ${data.number} en ${data.store_name} fue ${rejected ? "rechazado" : "cancelado"}.${reason}${notesText}`
        + (data.payment_method === "tarjeta" ? " Si ya habías pagado con tarjeta, el reembolso se procesa automáticamente." : "");
      const html = layout(subject,
        `<p>Tu pedido <strong>${escapeHtml(data.number)}</strong> en <strong>${escapeHtml(data.store_name)}</strong> `
        + `fue ${rejected ? "rechazado" : "cancelado"}.</p>`
        + (data.reason ? `<p>Motivo: ${escapeHtml(data.reason)}</p>` : "")
        + (notes.length > 0
          ? `<p>Anulamos tus facturas con:</p><ul>${notes.map((doc) => `<li>${escapeHtml(docLabel(doc))} <strong>${escapeHtml(doc.number)}</strong></li>`).join("")}</ul>`
          : "")
        + (data.payment_method === "tarjeta" ? `<p>Si ya habías pagado con tarjeta, el reembolso se procesa automáticamente.</p>` : ""));
      return { subject, html, text };
    }
    default:
      throw new Error(`plantilla desconocida: ${template}`);
  }
}