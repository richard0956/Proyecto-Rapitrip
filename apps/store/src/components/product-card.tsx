import Link from "next/link";
import type { ProductSummary } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { ProductImage } from "./product-image";

export function ProductCard({ product, showStore = false }: { product: ProductSummary; showStore?: boolean }) {
  return (
    <li className="group relative flex flex-col overflow-hidden rounded-concha bg-papel shadow-suave ring-1 ring-selva/[0.07]">
      <ProductImage path={product.cover_path} alt={product.name} className="aspect-square w-full transition-transform duration-700 ease-fluido group-hover:scale-[1.03]" />
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="text-[15px] font-bold leading-snug text-tinta">
          <Link href={`/productos/${product.id}`} className="rounded after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-hoja">
            {product.name}
          </Link>
        </h3>
        {showStore ? <p className="text-xs text-tinta-suave">{product.store_name}</p> : null}
        {product.category_name ? <p className="text-xs text-tinta-suave">{product.category_name}</p> : null}
        <p className="mt-auto pt-2 text-[15px] font-extrabold text-hoja">{product.min_price !== null ? `Desde ${formatMoney(product.min_price)}` : "—"}</p>
      </div>
    </li>
  );
}
