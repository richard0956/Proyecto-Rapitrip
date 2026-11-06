/** Número de WhatsApp de Rapitrip para soporte (solo dígitos, con código de país). Sin configurar, no se muestra ningún botón. */
export const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(/\D/g, "");

/** Enlace `wa.me` al chat de Rapitrip, o `null` si no hay número válido configurado. */
export function whatsappLink(number: string = WHATSAPP_NUMBER, text?: string): string | null {
  const digits = number.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
