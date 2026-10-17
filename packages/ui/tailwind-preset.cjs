/** Permite modificadores de opacidad (`bg-menta/50`) con colores definidos como variables CSS. */
const v = (name) => ({ opacityValue }) => {
  const alpha = Number(opacityValue);
  // Sin modificador, Tailwind entrega `var(--tw-*-opacity)` (no numérico): se usa el color tal cual.
  if (opacityValue === undefined || Number.isNaN(alpha) || alpha === 1) return `var(--${name})`;
  return `color-mix(in srgb, var(--${name}) ${Math.round(alpha * 100)}%, transparent)`;
};
const names = [
  "selva", "selva-panel", "hoja", "menta", "menta-borde", "nav-texto", "crema", "papel", "borde", "borde-campo",
  "tinta", "tinta-suave", "calido", "durazno", "durazno-texto", "lavanda", "rosa", "rojo", "naranja",
];

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: Object.fromEntries(names.map((name) => [name, v(name)])),
      borderRadius: { campo: "12px", boton: "14px", panel: "16px", tarjeta: "20px" },
      fontFamily: { texto: ["var(--font-texto)", "system-ui", "sans-serif"] },
      fontSize: { micro: ["10.5px", "1.4"], cuerpo: ["13px", "1.4"] },
    },
  },
};
