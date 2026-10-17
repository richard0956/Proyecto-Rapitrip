import { IntroSplash, introScript } from "@rapitrip/ui";
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const texto = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-texto" });
const titulo = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-titulo" });

export const metadata: Metadata = { title: { default: "Rapitrip · Consola", template: "%s · Rapitrip" }, description: "Consola de operación de Rapitrip.", robots: { index: false, follow: false } };

export const viewport: Viewport = { themeColor: "#06362a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${texto.variable} ${titulo.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: introScript }} />
      </head>
      <body>
        <IntroSplash />
        {children}
      </body>
    </html>
  );
}
