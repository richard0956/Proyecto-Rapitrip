/** Emblema real de la marca, sin marco: va directo sobre la carrocería clara. */
function Emblema({ x, y, alto }: { x: number; y: number; alto: number }) {
  return <image href="/brand/emblema-768.webp" x={x} y={y} width={alto * (651 / 768)} height={alto} />;
}

function Rueda({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill="#0a0f18" />
      <circle cx={cx} cy={cy} r={r * 0.58} fill="#dfe7e3" />
      <circle cx={cx} cy={cy} r={r * 0.4} fill="#9fb0aa" />
      <circle cx={cx} cy={cy} r={r * 0.16} fill="#0a0f18" />
    </>
  );
}

/**
 * Moto de reparto y furgón de Rapitrip avanzando por la ruta, sin marco: el emblema real de la marca va sobre la caja de la moto
 * y el costado del furgón. Los colores son fijos (los de la marca) y sirven igual en claro y en oscuro; la ruta corre despacio
 * salvo que la persona prefiera menos movimiento.
 */
export function HeroDuo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 170 400 210" role="img" aria-label="Una moto y un furgón de Rapitrip en reparto" className={className}>
      <defs>
        {/* La ruta se desvanece a los lados para no terminar en un corte seco. */}
        <linearGradient id="hero-ruta-fade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="400" y2="0">
          <stop offset="0" stopColor="#0b4560" stopOpacity="0" />
          <stop offset="0.18" stopColor="#0b4560" stopOpacity="0.9" />
          <stop offset="0.82" stopColor="#0b4560" stopOpacity="0.9" />
          <stop offset="1" stopColor="#0b4560" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M-10 336 Q110 296 220 322 T410 300" stroke="url(#hero-ruta-fade)" strokeWidth="62" fill="none" />
      <path d="M-10 336 Q110 296 220 322 T410 300" stroke="#3ddc9f" strokeWidth="3" fill="none" strokeDasharray="14 12" strokeLinecap="round" className="hero-ruta" />

      {/* Furgón */}
      <g transform="translate(160 133) scale(1.15)">
        <ellipse cx="108" cy="160" rx="84" ry="7" fill="#000" opacity="0.4" />
        <path d="M-4 92 H22 M-12 110 H14 M0 128 H18" stroke="#3ddc9f" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
        <path d="M30 74 Q30 62 42 62 H122 Q130 62 130 72 V138 H30 Z" fill="#f4f8f6" />
        <path d="M30 74 Q30 62 42 62 H122 Q130 62 130 72 V78 H30 Z" fill="#dbe7e2" />
        <rect x="30" y="122" width="100" height="9" fill="#3ddc9f" />
        <rect x="30" y="131" width="100" height="7" fill="#0f5a7a" />
        <Emblema x={68} y={85} alto={28} />
        <path d="M130 74 H156 Q168 74 173 88 L182 110 Q184 114 184 120 V138 H130 Z" fill="#0f5a7a" />
        <path d="M139 83 H155 Q161 83 164 91 L168 103 H139 Z" fill="#bfeee0" />
        <path d="M139 83 H147 L143 103 H139 Z" fill="#ffffff" opacity="0.35" />
        <rect x="150" y="112" width="8" height="3" rx="1.5" fill="#3ddc9f" />
        <rect x="176" y="118" width="8" height="9" rx="2.5" fill="#ffe08a" />
        <rect x="128" y="132" width="60" height="8" rx="3" fill="#0a3a52" />
        <path d="M184 122 L250 106 V146 Z" fill="#ffe08a" opacity="0.16" />
        <path d="M46 138 a18 18 0 0 1 36 0z M134 138 a18 18 0 0 1 36 0z" fill="#07101b" />
        <Rueda cx={64} cy={140} r={16} />
        <Rueda cx={152} cy={140} r={16} />
      </g>

      {/* Moto de reparto: todas las piezas se tocan (parrilla, asiento, escudo, horquilla) para que se lea como una sola. */}
      <g transform="translate(-8 158) scale(1.15)">
        <ellipse cx="96" cy="160" rx="70" ry="6" fill="#000" opacity="0.45" />
        <path d="M-6 100 H14 M-14 118 H8 M-2 136 H12" stroke="#3ddc9f" strokeWidth="4" strokeLinecap="round" opacity="0.55" />

        <Rueda cx={52} cy={140} r={17} />
        <Rueda cx={150} cy={140} r={17} />

        {/* Escudo delantero y horquilla */}
        <path d="M112 134 L124 102 L132 88 L143 90 L145 102 L138 134 Z" fill="#26b985" />
        <path d="M150 140 L139 92" stroke="#cfd8d4" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M135 130 A18 18 0 0 1 168 128" stroke="#3ddc9f" strokeWidth="5" fill="none" strokeLinecap="round" />

        {/* Carrocería: cola sobre la rueda trasera, asiento y piso en una sola pieza */}
        <path d="M28 134 C28 112 44 100 68 100 L106 102 C114 103 118 108 120 116 L122 134 L76 134 A24 24 0 0 0 28 134 Z" fill="#3ddc9f" />
        <path d="M36 116 C41 107 52 103 68 103" stroke="#8ff5cb" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.7" />
        <rect x="78" y="128" width="44" height="6" rx="3" fill="#26b985" />
        <rect x="60" y="93" width="52" height="9" rx="4.5" fill="#0a3a52" />
        <rect x="26" y="108" width="5" height="9" rx="2" fill="#ff6b6b" />

        {/* Caja de reparto, apoyada en la parrilla */}
        <rect x="16" y="95" width="56" height="5" rx="2.5" fill="#0a3a52" />
        <rect x="20" y="52" width="48" height="44" rx="8" fill="#f4f8f6" stroke="#0f5a7a" strokeWidth="2.5" />
        <rect x="20" y="52" width="48" height="7" rx="3.5" fill="#0f5a7a" />
        <Emblema x={35.5} y={67.5} alto={20} />

        {/* Repartidor: pierna, torso, brazo y casco unidos */}
        <path d="M94 98 L116 102 L113 128" stroke="#0a3a52" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M86 98 L91 66 Q101 58 112 66 L110 98 Z" fill="#0f5a7a" />
        <path d="M106 70 L135 86" stroke="#0f5a7a" strokeWidth="8" strokeLinecap="round" />
        <rect x="92" y="40" width="27" height="24" rx="9" fill="#3ddc9f" />
        <rect x="103" y="46" width="17" height="10" rx="2" fill="#0a3a52" />
        <path d="M106 48 H117" stroke="#8ff5cb" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />

        {/* Manubrio y faro, pegados a la columna */}
        <rect x="130" y="83" width="17" height="6" rx="3" fill="#0a3a52" />
        <rect x="141" y="90" width="9" height="10" rx="3.5" fill="#ffe08a" />
        <path d="M150 94 L205 82 V112 Z" fill="#ffe08a" opacity="0.16" />
      </g>
    </svg>
  );
}
