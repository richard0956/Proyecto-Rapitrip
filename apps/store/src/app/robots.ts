import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

const base = siteUrl();

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/perfil", "/recuperar", "/auth/", "/carrito", "/checkout", "/pedidos"] }, sitemap: `${base}/sitemap.xml` };
}
