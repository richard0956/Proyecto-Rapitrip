import { Store, Truck } from "lucide-react";

function FloatingNote({ icon, title, text, className }: { icon: React.ReactNode; title: string; text: string; className: string }) {
  return (
    <div className={`absolute flex items-center gap-3 rounded-2xl bg-papel p-3 pr-5 shadow-flota ring-1 ring-selva/10 ${className}`}>
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-menta text-hoja">
        {icon}
      </span>
      <div className="leading-tight">
        <p className="text-[13px] font-bold text-tinta">{title}</p>
        <p className="mt-0.5 text-[11.5px] text-tinta-suave">{text}</p>
      </div>
    </div>
  );
}

/** Composición de la portada: el emblema sobre una baldosa, dentro de una bandeja de doble bisel, con notas que lo cruzan. */
export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[470px]">
      <div className="rounded-[2.5rem] bg-selva/[0.04] p-2 shadow-flota ring-1 ring-selva/10">
        <div className="relative aspect-[4/4.4] overflow-hidden rounded-[calc(2.5rem-0.5rem)] bg-selva">
          <div aria-hidden="true" className="absolute -right-24 -top-24 size-80 rounded-full bg-esmeralda/20" />
          <div aria-hidden="true" className="absolute -bottom-32 -left-20 size-96 rounded-full bg-hoja" />
          <div aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex size-44 items-center justify-center rounded-[2.75rem] bg-papel shadow-[inset_0_1px_1px_rgb(255_255_255/0.95),0_40px_70px_-24px_rgb(0_0_0/0.55)]">
              <img src="/brand/emblema-768.webp" width={651} height={768} alt="" className="h-28 w-auto" />
            </div>
          </div>
          <img src="/brand/lema-blanco.webp" width={720} height={65} alt="" aria-hidden="true" className="absolute inset-x-0 bottom-6 mx-auto h-4 w-auto opacity-80" />
        </div>
      </div>
      <FloatingNote icon={<Store className="size-5" />} title="Comercios afiliados" text="Revisados por el equipo" className="left-3 top-3 md:-left-10 md:top-14 md:-rotate-2" />
      <FloatingNote icon={<Truck className="size-5" />} title="Entrega a tu puerta" text="Con repartidor asignado" className="bottom-14 right-3 md:-right-8 md:bottom-24 md:rotate-2" />
    </div>
  );
}
