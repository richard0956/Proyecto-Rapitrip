import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

const texto = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-texto" });
const titulo = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-titulo" });

export const metadata: Metadata = {
  title: { default: "Rapitrip · Repartidor", template: "%s · Rapitrip" },
  description: "Aplicación del repartidor de Rapitrip.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Repartidor", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

// `viewportFit: cover` deja usar toda la pantalla en teléfonos con muesca (los márgenes seguros se aplican en el diseño).
export const viewport: Viewport = { themeColor: "#06362a", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${texto.variable} ${titulo.variable}`}>
      <body className="min-h-dvh overscroll-y-none">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
