import { Card } from "./card";

/** Una sección de un texto legal: título, párrafos y, si hace falta, una lista. */
export type LegalSection = { id: string; title: string; body: string[]; items?: string[] };

/**
 * Texto legal completo (Términos o Privacidad) con índice, secciones con ancla y enlace al otro documento. Lo usan la consola y
 * la app del repartidor; cada app pone su propio contenido.
 */
export function LegalDocument({
  eyebrow,
  title,
  intro,
  updated,
  basis,
  sections,
  other,
  contactEmail,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  /** De dónde salen estas reglas (el manual de políticas de TI). */
  basis?: string;
  sections: LegalSection[];
  other: { href: string; label: string };
  contactEmail?: string;
}) {
  return (
    <main className="mx-auto w-full max-w-[780px] px-4 pb-12 pt-8 sm:px-6">
      <p className="text-[12.5px] font-bold uppercase tracking-wider text-hoja">{eyebrow}</p>
      <h1 className="mt-2 text-balance text-[30px] font-extrabold leading-tight text-tinta sm:text-[38px]">{title}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-tinta-suave">{intro}</p>
      <p className="mt-2 text-[13px] text-tinta-suave">Última actualización: {updated}</p>
      {basis ? <p className="mt-1 text-[13px] text-tinta-suave">{basis}</p> : null}

      <Card outerClassName="mt-7" className="p-6 sm:p-8">
        <nav aria-label="Contenido" className="mb-8 border-b border-borde pb-6">
          <ul className="grid gap-1.5 text-[14px] font-semibold text-hoja sm:grid-cols-2">
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="underline-offset-4 hover:underline">
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-col gap-8">
          {sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-t`} className="scroll-mt-6">
              <h2 id={`${section.id}-t`} className="text-[18px] font-extrabold text-tinta">
                {section.title}
              </h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="mt-2 text-[15px] leading-relaxed text-tinta">
                  {paragraph}
                </p>
              ))}
              {section.items ? (
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-tinta marker:text-hoja">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
        {contactEmail ? (
          <p className="mt-8 border-t border-borde pt-6 text-[15px] text-tinta">
            Contacto:{" "}
            <a href={`mailto:${contactEmail}`} className="font-bold text-hoja underline-offset-4 hover:underline">
              {contactEmail}
            </a>
          </p>
        ) : null}
      </Card>
      <p className="mt-6 text-center text-[14px]">
        <a href={other.href} className="font-bold text-hoja underline-offset-4 hover:underline">
          {other.label}
        </a>
      </p>
    </main>
  );
}
