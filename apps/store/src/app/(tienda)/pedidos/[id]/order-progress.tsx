import { Check } from "lucide-react";
import { orderStatusLabel, progressSteps } from "@/lib/orders";

/** Moto de reparto de lado, mirando a la derecha: la que lleva los pedidos Express. */
function Moto() {
  return (
    <svg viewBox="0 0 56 34" className="h-9 w-auto" data-vehiculo="moto">
      <rect x="3" y="5" width="17" height="13" rx="3" fill="#f4f8f6" stroke="#0f5a7a" strokeWidth="1" />
      <rect x="3" y="5" width="17" height="3" rx="1.5" fill="#0f5a7a" />
      <image href="/brand/emblema-768.webp" x="8.6" y="9" width="5.9" height="7" />
      <path d="M26 20 L28 10 Q32 7 35 10 L34 20 Z" fill="#0f5a7a" />
      <path d="M32 12 L40 15.5" stroke="#0f5a7a" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M29 21 L35 22 L34 27" stroke="#0a3a52" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="27.5" y="2" width="9.5" height="8.5" rx="3" fill="#3ddc9f" />
      <rect x="32" y="4.2" width="5.5" height="3.6" rx="1" fill="#0a3a52" />
      <path d="M44 28 L40.5 14" stroke="#cfd8d4" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 28 C8 22 12 19 19 19 L33 20 C37 20 39 23 40 28 L36 28 L16 28 Z" fill="#3ddc9f" />
      <rect x="15" y="17" width="17" height="3.2" rx="1.6" fill="#0a3a52" />
      <rect x="38" y="12.3" width="7" height="2.2" rx="1.1" fill="#0a3a52" />
      <rect x="43" y="15" width="3.2" height="3.4" rx="1.2" fill="#ffe08a" />
      <circle cx="12" cy="28" r="5" fill="#0a0f18" />
      <circle cx="12" cy="28" r="2.3" fill="#dfe7e3" />
      <circle cx="44" cy="28" r="5" fill="#0a0f18" />
      <circle cx="44" cy="28" r="2.3" fill="#dfe7e3" />
    </svg>
  );
}

/** Furgón de lado, mirando a la derecha: el mismo del héroe de la portada, para los pedidos programados. */
function Camion() {
  return (
    <svg viewBox="26 58 164 100" className="h-9 w-auto" data-vehiculo="camion">
      <path d="M30 74 Q30 62 42 62 H122 Q130 62 130 72 V138 H30 Z" fill="#f4f8f6" />
      <path d="M30 74 Q30 62 42 62 H122 Q130 62 130 72 V78 H30 Z" fill="#dbe7e2" />
      <rect x="30" y="122" width="100" height="9" fill="#3ddc9f" />
      <rect x="30" y="131" width="100" height="7" fill="#0f5a7a" />
      <image href="/brand/emblema-768.webp" x="68" y="85" width="23.7" height="28" />
      <path d="M130 74 H156 Q168 74 173 88 L182 110 Q184 114 184 120 V138 H130 Z" fill="#0f5a7a" />
      <path d="M139 83 H155 Q161 83 164 91 L168 103 H139 Z" fill="#bfeee0" />
      <path d="M139 83 H147 L143 103 H139 Z" fill="#ffffff" opacity="0.35" />
      <rect x="150" y="112" width="8" height="3" rx="1.5" fill="#3ddc9f" />
      <rect x="176" y="118" width="8" height="9" rx="2.5" fill="#ffe08a" />
      <rect x="128" y="132" width="60" height="8" rx="3" fill="#0a3a52" />
      <path d="M46 138 a18 18 0 0 1 36 0z M134 138 a18 18 0 0 1 36 0z" fill="#07101b" />
      <circle cx="64" cy="140" r="16" fill="#0a0f18" />
      <circle cx="64" cy="140" r="8" fill="#cfd8d4" />
      <circle cx="64" cy="140" r="3" fill="#0a0f18" />
      <circle cx="152" cy="140" r="16" fill="#0a0f18" />
      <circle cx="152" cy="140" r="8" fill="#cfd8d4" />
      <circle cx="152" cy="140" r="3" fill="#0a0f18" />
    </svg>
  );
}

/**
 * Avance del pedido: una línea continua que une los puntos y se va llenando, con la moto (Express) o el camión (Programado)
 * recorriéndola hasta el paso actual. Los puntos cambian según el estado: hecho (con visto), actual (con aro que late) y pendiente
 * (hueco). El vehículo se queda quieto cuando el pedido ya terminó; con «menos movimiento» no hay animaciones.
 */
export function OrderProgress({ step, deliveryClass, finished }: { step: number; deliveryClass: "express" | "programado"; finished: boolean }) {
  const last = progressSteps.length - 1;
  const position = Math.min(Math.max(step, 0), last);
  const fraction = position / last;
  const pct = `${(fraction * 100).toFixed(2)}%`;

  return (
    <div className="relative mt-6 max-w-3xl">
      {/* La línea ocupa de un punto al otro: el primero y el último quedan a 1/12 del borde (las columnas son iguales). */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[8.333%] top-0 h-full">
        <div className="absolute inset-x-0 top-[58px] h-1 rounded-full bg-menta/70" />
        <div className="progreso-relleno absolute left-0 top-[58px] h-1 rounded-full bg-gradient-to-r from-hoja to-esmeralda transition-[width] duration-1000 ease-fluido" style={{ width: pct }} />
        <div className="progreso-vehiculo absolute top-0 -translate-x-1/2 transition-[left] duration-1000 ease-fluido" style={{ left: pct, opacity: step < 0 ? 0.55 : 1 }}>
          <div className={finished ? "" : "progreso-bob"}>{deliveryClass === "express" ? <Moto /> : <Camion />}</div>
        </div>
      </div>

      <ol aria-label="Avance del pedido" className="relative z-10 grid grid-cols-6 pt-11">
        {progressSteps.map((s, index) => {
          const done = index <= step;
          const current = index === step && !finished;
          return (
            <li key={s} aria-current={index === step ? "step" : undefined} className={`flex flex-col items-center gap-2 text-center text-[11px] font-bold leading-tight sm:text-[11.5px] ${done ? (index === step ? "text-tinta" : "text-hoja") : "text-tinta-suave"}`}>
              <span aria-hidden="true" className="relative flex size-8 items-center justify-center">
                {current ? <span className="progreso-late absolute inset-0 rounded-full bg-hoja/30" /> : null}
                <span
                  className={`relative flex size-8 items-center justify-center rounded-full transition-colors duration-700 ${
                    done ? "bg-hoja text-sobre-acento shadow-[0_6px_14px_-6px_rgb(6_54_42/0.6)]" : "border-2 border-dashed border-borde-campo bg-superficie"
                  } ${current ? "ring-4 ring-hoja/25" : ""}`}
                >
                  {done ? <Check className="size-4" strokeWidth={3} /> : <span className="size-1.5 rounded-full bg-borde-campo" />}
                </span>
              </span>
              <span className="max-w-[5.5rem] px-0.5">{orderStatusLabel[s]}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
