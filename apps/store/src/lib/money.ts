/** Moneda de la tienda; configurable con NEXT_PUBLIC_CURRENCY (por defecto, córdobas de Nicaragua). */
const currency = process.env.NEXT_PUBLIC_CURRENCY || "NIO";
const formatter = new Intl.NumberFormat("es", { style: "currency", currency, maximumFractionDigits: 2 });

export const formatMoney = (value: number | string | null | undefined) => (value === null || value === undefined ? "—" : formatter.format(Number(value)));

/** URL pública de una imagen de producto (el bucket es público: el catálogo se muestra sin sesión). */
export function productImageUrl(path: string | null | undefined) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return path && base ? `${base}/storage/v1/object/public/product-images/${path}` : null;
}
