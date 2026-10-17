import { Card } from "@rapitrip/ui";
import Link from "next/link";
import { LEGAL_UPDATED, type LegalSection } from "@/lib/legal";

/** Correo de contacto para derechos de los titulares; solo se muestra si está configurado. */
const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "";

export function LegalPage({ title, intro, sections, other }: { title: string; intro: string; sections: LegalSection[]; other: { href: string; label: string } }) {
  return (
    <main className="mx-auto max-w-[760px] px-4 pb-8 sm:px-8">
      <p className="text-[13px] font-bold uppercase tracking-wider text-exito">Legal</p>
      <h1 className="mt-2 text-balance text-[34px] font-extrabold leading-tight text-tinta sm:text-[42px]">{title}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-tinta-suave">{intro}</p>
      <p className="mt-2 text-[13px] text-tinta-suave">Última actualización: {LEGAL_UPDATED}</p>

      <Card className="mt-8 p-6 sm:p-8">
        <nav aria-label="Contenido" className="mb-8 border-b border-selva/10 pb-6">
          <ul className="grid gap-1.5 text-[14px] font-semibold text-hoja sm:grid-cols-2">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="underline-offset-4 hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-col gap-8">
          {sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-t`} className="scroll-mt-28">
              <h2 id={`${s.id}-t`} className="text-[19px] font-extrabold text-tinta">
                {s.title}
              </h2>
              {s.body.map((p) => (
                <p key={p} className="mt-2 text-[15px] leading-relaxed text-tinta">
                  {p}
                </p>
              ))}
              {s.items ? (
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-tinta marker:text-hoja">
                  {s.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
        {contactEmail ? (
          <p className="mt-8 border-t border-selva/10 pt-6 text-[15px] text-tinta">
            Contacto: <a href={`mailto:${contactEmail}`} className="font-bold text-hoja underline-offset-4 hover:underline">{contactEmail}</a>
          </p>
        ) : null}
      </Card>
      <p className="mt-6 text-center text-[14px]">
        <Link href={other.href} className="font-bold text-hoja underline-offset-4 hover:underline">
          {other.label}
        </Link>
      </p>
    </main>
  );
}
