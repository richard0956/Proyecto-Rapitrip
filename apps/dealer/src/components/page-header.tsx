import { Eyebrow } from "@rapitrip/ui";

/** Encabezado de cada pantalla: etiqueta pequeña, título y una línea de ayuda. Mismo orden que el resto de las aplicaciones. */
export function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <header className="flex flex-col items-start gap-2">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-tinta">{title}</h1>
      {description ? <p className="text-[13.5px] text-tinta-suave">{description}</p> : null}
    </header>
  );
}
