import { IntroSplash, introScript } from "@rapitrip/ui";
import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const texto = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-texto" });

export const metadata: Metadata = { title: { default: "Rapitrip · Consola", template: "%s · Rapitrip" }, description: "Consola de operación de Rapitrip.", robots: { index: false, follow: false } };

export const viewport: Viewport = { themeColor: "#072b3b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={texto.variable} suppressHydrationWarning>
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
