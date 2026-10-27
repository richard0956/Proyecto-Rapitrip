import {
  Armchair,
  Baby,
  BookOpen,
  Car,
  Dog,
  Dumbbell,
  Footprints,
  Gamepad2,
  Gift,
  Hammer,
  Headphones,
  Lamp,
  Laptop,
  Music,
  Pill,
  Refrigerator,
  Shirt,
  Smartphone,
  Sparkles,
  Sprout,
  Tag,
  Watch,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { createElement } from "react";
import type { Category } from "@/lib/catalog";

/**
 * Ícono por palabras clave del nombre de la categoría. Rapitrip es un comercio de productos variados (tecnología, hogar,
 * herramientas, moda…), no un supermercado; las categorías vienen del catálogo maestro y cambian, así que lo que no se
 * reconoce cae en la etiqueta.
 */
const icons: [RegExp, LucideIcon][] = [
  [/celular|tel[eé]fono|m[oó]vil/i, Smartphone],
  [/tecnolog|electr[oó]nic|computa|laptop|inform[aá]tic/i, Laptop],
  [/audio|aud[ií]fono|sonido/i, Headphones],
  [/electrodom|l[ií]nea blanca/i, Refrigerator],
  [/mueble|sof[aá]|silla/i, Armchair],
  [/hogar|decoraci|ilumina/i, Lamp],
  [/herramient/i, Wrench],
  [/ferreter|construc/i, Hammer],
  [/calzad|zapat/i, Footprints],
  [/ropa|moda|vestir/i, Shirt],
  [/reloj|accesorio|joyer/i, Watch],
  [/deporte|fitness|gimnas/i, Dumbbell],
  [/juguet|juego|videojueg/i, Gamepad2],
  [/belleza|cuidado|cosm[eé]t/i, Sparkles],
  [/librer|papeler|libro|oficina/i, BookOpen],
  [/mascot/i, Dog],
  [/auto|moto|veh[ií]cul|repuest/i, Car],
  [/beb[eé]|infant/i, Baby],
  [/jard[ií]n|planta/i, Sprout],
  [/salud|farmac/i, Pill],
  [/m[uú]sica|instrument/i, Music],
  [/regalo/i, Gift],
];

/** Fondos pastel que se repiten en orden, como las fotos sobre colores suaves de la referencia. */
const tones = ["from-menta to-white text-hoja", "from-durazno to-white text-durazno-texto", "from-lavanda to-white text-marino", "from-calido to-white text-naranja", "from-rosa to-white text-rojo"];

export function categoryIcon(name: string): LucideIcon {
  return icons.find(([pattern]) => pattern.test(name))?.[1] ?? Tag;
}

/** Tarjeta de categoría de la portada: ícono grande sobre un fondo pastel, nombre y cuántos productos tiene. */
export function CategoryTile({ category, index }: { category: Category; index: number }) {
  return (
    <li>
      <Link
        href={`/catalogo?categoria=${category.id}`}
        className="group flex h-full flex-col items-center rounded-tarjeta bg-white p-3 text-center shadow-[0_18px_40px_-30px_rgb(6_54_42/0.35)] ring-1 ring-selva/[0.05] transition-[transform,box-shadow] duration-500 ease-fluido hover:-translate-y-1 hover:shadow-[0_24px_48px_-24px_rgb(6_54_42/0.35)] focus-visible:outline-2 focus-visible:outline-hoja motion-reduce:hover:translate-y-0"
      >
        <span aria-hidden="true" className={`flex aspect-square w-full items-center justify-center rounded-2xl bg-gradient-to-br ${tones[index % tones.length]}`}>
          {createElement(categoryIcon(category.name), { className: "size-10 transition-transform duration-500 ease-fluido group-hover:scale-110 sm:size-12", strokeWidth: 1.6 })}
        </span>
        <span className="mt-3 line-clamp-2 text-[14px] font-semibold leading-snug text-tinta">{category.name}</span>
        <span className="mt-0.5 text-[11.5px] text-tinta-suave">
          {category.product_count} {category.product_count === 1 ? "producto" : "productos"}
        </span>
      </Link>
    </li>
  );
}
