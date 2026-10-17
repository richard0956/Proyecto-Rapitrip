import type { Metadata } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const titulo = Bricolage_Grotesque({ subsets: ["latin"], weight: "800", variable: "--font-titulo" });
const texto = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "700", "800"], variable: "--font-texto" });

export const metadata: Metadata = { title: "Rapitrip" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${titulo.variable} ${texto.variable}`}>
      <body>{children}</body>
    </html>
  );
}
