import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

const base = siteUrl();

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/ingresar", "/registro", "/vende", "/terminos", "/privacidad"].map((path) => ({ url: `${base}${path}`, changeFrequency: "monthly", priority: path === "" ? 1 : 0.5 }));
}
