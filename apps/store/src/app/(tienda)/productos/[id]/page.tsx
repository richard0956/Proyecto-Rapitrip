import { Alert, Badge } from "@rapitrip/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductImage } from "@/components/product-image";
import { getProduct, isUuid } from "@/lib/catalog";
import { kindLabel } from "@/lib/catalog-filters";
import { productImageUrl } from "@/lib/money";
import { siteUrl } from "@/lib/site-url";
import { AddToCart } from "./add-to-cart";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = isUuid(id) ? await getProduct(id) : null;
  if (!product) return { title: "Producto no encontrado", robots: { index: false } };
  const cover = productImageUrl(product.images[0]);
  return {
    title: `${product.name} · ${product.store.name}`,
    description: product.description?.slice(0, 160) || `${product.name} en ${product.store.name}, con entrega a domicilio por Rapitrip.`,
    alternates: { canonical: `/productos/${product.id}` },
    openGraph: cover ? { images: [cover] } : undefined,
  };
}

export default async function ProductoPage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const product = await getProduct(id);
  if (!product) notFound();

  const prices = product.variants.filter((v) => v.available).map((v) => v.price);
  const allSoldOut = product.variants.every((v) => !v.available);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    ...(product.images[0] ? { image: productImageUrl(product.images[0]) } : {}),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: process.env.NEXT_PUBLIC_CURRENCY || "NIO",
      lowPrice: prices.length ? Math.min(...prices) : undefined,
      highPrice: prices.length ? Math.max(...prices) : undefined,
      availability: allSoldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      url: `${siteUrl()}/productos/${product.id}`,
    },
  };

  return (
    <main className="mx-auto max-w-[1180px]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Ruta de navegación" className="text-[13px] text-tinta-suave">
        <Link href="/catalogo" className="font-bold text-hoja hover:underline">
          Catálogo
        </Link>{" "}
        /{" "}
        <Link href={`/tiendas/${product.store.id}`} className="font-bold text-hoja hover:underline">
          {product.store.name}
        </Link>{" "}
        / {product.name}
      </nav>

      <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section aria-label="Fotos del producto" className="flex flex-col gap-3">
          <ProductImage path={product.images[0]} alt={product.name} priority className="aspect-square w-full rounded-concha" />
          {product.images.length > 1 ? (
            <ul className="grid grid-cols-4 gap-3">
              {product.images.slice(1).map((path, index) => (
                <li key={path}>
                  <ProductImage path={path} alt={`${product.name}, foto ${index + 2}`} className="aspect-square w-full rounded-2xl" />
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <div className="flex flex-wrap gap-2">
              {product.category_name ? <Badge tone="neutral">{product.category_name}</Badge> : null}
              {product.brand_name ? <Badge tone="neutral">{product.brand_name}</Badge> : null}
              {product.store.commerce_kind ? <Badge tone={product.store.commerce_kind === "empresa" ? "positive" : "neutral"}>{kindLabel(product.store.commerce_kind)}</Badge> : null}
            </div>
            <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight text-tinta sm:text-[34px]">{product.name}</h1>
            <p className="mt-1 text-[13.5px] text-tinta-suave">
              Vendido por{" "}
              <Link href={`/tiendas/${product.store.id}`} className="font-bold text-hoja hover:underline">
                {product.store.name}
              </Link>
              {" · "}
              Envío según la distancia
            </p>
          </div>
          {product.description ? <p className="max-w-[60ch] whitespace-pre-line text-[15px] leading-relaxed text-tinta-suave">{product.description}</p> : null}
          {allSoldOut ? <Alert tone="warning">Este producto está agotado por ahora.</Alert> : null}
          <AddToCart storeId={product.store.id} storeName={product.store.name} storeOpen={product.store.open_now} variants={product.variants} />
        </section>
      </div>
    </main>
  );
}
