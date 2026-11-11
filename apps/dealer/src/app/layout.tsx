import { motionScript } from "@rapitrip/ui";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { ThemeSync } from "@/components/theme-picker";
import { themeScript } from "@/lib/theme";
import "./globals.css";

const texto = localFont({ src: "../../../../packages/ui/fonts/plus-jakarta-sans.woff2", weight: "400 800", style: "normal", display: "swap", variable: "--font-texto" });
const titulo = localFont({ src: "../../../../packages/ui/fonts/bricolage-grotesque.woff2", weight: "500 800", style: "normal", display: "swap", variable: "--font-titulo" });

export const metadata: Metadata = {
  title: { default: "Rapitrip · Repartidor", template: "%s · Rapitrip" },
  description: "Aplicación del repartidor de Rapitrip.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Repartidor", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

// `viewportFit: cover` deja usar toda la pantalla en teléfonos con muesca (los márgenes seguros se aplican en el diseño).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#06362a" },
    { media: "(prefers-color-scheme: dark)", color: "#060b14" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `data-theme` lo pone el script antes de hidratar: el servidor no lo conoce y React no debe quejarse por eso.
    <html lang="es" className={`${texto.variable} ${titulo.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: motionScript }} />
      </head>
      <body className="min-h-dvh overscroll-y-none">
        {children}
        <ThemeSync />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
