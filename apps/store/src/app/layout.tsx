import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const texto = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-texto" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Rapitrip · Tu tienda cerca de ti", template: "%s · Rapitrip" },
  description: "Compra en comercios afiliados y recibe en tu puerta. Crea tu cuenta o afilia tu negocio en Rapitrip.",
  openGraph: { title: "Rapitrip", description: "Compra en comercios afiliados y recibe en tu puerta.", type: "website", locale: "es" },
  appleWebApp: { capable: true, title: "Rapitrip", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#006c5f", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={texto.variable}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
