import { EmptyState, pillStyles } from "@rapitrip/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { Pager } from "@/components/pager";
import { StoreCard } from "@/components/store-card";
import { getStores, PAGE_SIZE } from "@/lib/catalog";
import { buildQuery, parsePage } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Tiendas",
  description: "Explora los comercios afiliados a Rapitrip, mira su catálogo y pide a tu puerta.",
  alternates: { canonical: "/tiendas" },
};

export default async function TiendasPage({ searchParams }: { searchParams: Promise<{ abiertas?: string; pagina?: string }> }) {
  const params = await searchParams;
  const openOnly = params.abiertas === "1";
  const page = parsePage(params.pagina);
  const stores = await getStores(openOnly, page);
  const href = (p: number) => `/tiendas${buildQuery({ abiertas: openOnly ? 1 : null, pagina: p })}`;

  return (
    <main className="mx-auto max-w-[1176px] px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-tinta sm:text-[34px]">Tiendas</h1>
      <p className="mt-1 text-[14px] text-tinta-suave">Elige un comercio, arma tu carrito y recíbelo en tu puerta.</p>

      <nav aria-label="Filtro de tiendas" className="mt-5 flex flex-wrap gap-2">
        <Link href="/tiendas" aria-current={!openOnly ? "page" : undefined} className={pillStyles(!openOnly)}>
          Todas
        </Link>
        <Link href="/tiendas?abiertas=1" aria-current={openOnly ? "page" : undefined} className={pillStyles(openOnly)}>
          Abiertas ahora
        </Link>
      </nav>

      {stores.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={openOnly ? "No hay tiendas abiertas en este momento" : "Todavía no hay tiendas"}>
            {openOnly ? "Vuelve más tarde o mira todas las tiendas para ver sus horarios." : "Estamos sumando comercios. Vuelve pronto."}
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((store) => (
            <StoreCard key={store.id} store={store} />
          ))}
        </ul>
      )}
      <Pager page={page} hasNext={stores.length === PAGE_SIZE} href={href} />
    </main>
  );
}
