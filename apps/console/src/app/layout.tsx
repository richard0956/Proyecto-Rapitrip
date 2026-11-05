import { IntroSplash, introScript, motionScript } from "@rapitrip/ui";
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import { ThemeSync } from "@/components/theme-picker";
import { themeScript } from "@/lib/theme";
import "./globals.css";

const texto = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-texto" });
const titulo = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-titulo" });

export const metadata: Metadata = { title: { default: "Rapitrip · Consola", template: "%s · Rapitrip" }, description: "Consola de operación de Rapitrip.", robots: { index: false, follow: false } };

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#06362a" },
    { media: "(prefers-color-scheme: dark)", color: "#060b14" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${texto.variable} ${titulo.variable}`} suppressHydrationWarning>
      <head>
        {/* El tema va antes que todo: sin destello claro al cargar en oscuro. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Primero la preferencia «Reducir animaciones»: si está, la introducción ya no se programa. */}
        <script dangerouslySetInnerHTML={{ __html: motionScript }} />
        <script dangerouslySetInnerHTML={{ __html: introScript }} />
      </head>
      <body>
        <ThemeSync />
        <IntroSplash />
        {children}
      </body>
    </html>
  );
}
