export type WhatsAppTemplate = "commerce_request_received";

/** Texto plano (WhatsApp no interpreta HTML). Solo afiliación y soporte; nada de pedidos. */
export function renderWhatsApp(template: WhatsAppTemplate, data: Record<string, unknown>): string {
  switch (template) {
    case "commerce_request_received": {
      const contact = String(data.contact_name ?? "").trim();
      const business = String(data.business_name ?? "").trim();
      const greeting = contact ? `Estimado(a) ${contact}:` : "Estimado(a) solicitante:";
      const about = business ? ` para ${business}` : "";
      return [
        greeting,
        "",
        "Gracias por confiar en Rapitrip para comercializar sus productos.",
        `Hemos recibido su solicitud de afiliación${about}. Un administrador la revisará y se pondrá en contacto con usted para avanzar con el proceso.`,
        "",
        "Atentamente,",
        "Equipo de Rapitrip",
      ].join("\n");
    }
    default:
      throw new Error(`plantilla de WhatsApp desconocida: ${template as string}`);
  }
}
