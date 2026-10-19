import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { publicSupabase } from "@/lib/catalog";
import { siteUrl } from "@/lib/site-url";

const base = siteUrl();
/** El sitemap lista hasta este número de tiendas y de productos por consulta; las páginas públicas llevan enlaces a todo lo demás. */
const LIMIT = 48;
const MAX_PAGES = 20;

const staticPaths = ["", "/tiendas", "/ingresar", "/registro", "/vende", "/terminos", "/privacidad"];

/** Tiendas y productos públicos, leídos de las mismas funciones del catálogo y guardados una hora. */
const catalogUrls = unstable_cache(
  async () => {
    const supabase = publicSupabase();
    const urls: MetadataRoute.Sitemap = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data } = await supabase.rpc("catalog_stores", { p_open_only: false, p_limit: LIMIT, p_offset: page * LIMIT });
      if (!data?.length) break;
      for (const store of data) {
        urls.push({ url: `${base}/tiendas/${store.id}`, changeFrequency: "daily", priority: 0.7 });
        for (let p = 0; p < MAX_PAGES; p++) {
          const { data: products } = await supabase.rpc("catalog_products", { p_store: store.id, p_limit: LIMIT, p_offset: p * LIMIT });
          if (!products?.length) break;
          for (const product of products) urls.push({ url: `${base}/productos/${product.id}`, changeFrequency: "daily", priority: 0.6 });
          if (products.length < LIMIT) break;
        }
      }
      if (data.length < LIMIT) break;
    }
    return urls;
  },
  ["sitemap-catalog"],
  { revalidate: 3600, tags: ["catalog"] },
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = staticPaths.map((path) => ({ url: `${base}${path}`, changeFrequency: "monthly", priority: path === "" ? 1 : 0.5 }));
  try {
    return [...pages, ...(await catalogUrls())];
  } catch {
    // Sin base de datos (por ejemplo, durante una compilación sin Supabase) el sitemap sigue listando las páginas fijas.
    return pages;
  }
}
