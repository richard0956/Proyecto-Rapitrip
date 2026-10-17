import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const texto = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-texto" });

export const metadata: Metadata = { title: { default: "Rapitrip · Consola", template: "%s · Rapitrip" }, description: "Consola de operación de Rapitrip." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={texto.variable}>
      <body>{children}</body>
    </html>
  );
}
