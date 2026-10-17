import { IntroSplash, introScript } from "@rapitrip/ui";
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

const texto = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-texto" });
const titulo = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-titulo" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Rapitrip · Seguridad y confianza", template: "%s · Rapitrip" },
  description: "Compra en comercios afiliados y recibe en tu puerta. Crea tu cuenta o afilia tu negocio en Rapitrip.",
  openGraph: { title: "Rapitrip", description: "Compra en comercios afiliados y recibe en tu puerta.", type: "website", locale: "es" },
  appleWebApp: { capable: true, title: "Rapitrip", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#06362a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${texto.variable} ${titulo.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: introScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <IntroSplash />
        {children}
      </body>
    </html>
  );
}
