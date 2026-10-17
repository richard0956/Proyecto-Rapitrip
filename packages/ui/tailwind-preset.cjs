/** Permite modificadores de opacidad (`bg-menta/50`) con colores definidos como variables CSS. */
const v = (name) => ({ opacityValue }) => {
  const alpha = Number(opacityValue);
  // Sin modificador, Tailwind entrega `var(--tw-*-opacity)` (no numérico): se usa el color tal cual.
  if (opacityValue === undefined || Number.isNaN(alpha) || alpha === 1) return `var(--${name})`;
  return `color-mix(in srgb, var(--${name}) ${Math.round(alpha * 100)}%, transparent)`;
};
const names = [
  "selva", "selva-panel", "hoja", "esmeralda", "exito", "menta", "menta-borde", "bruma", "nav-texto", "crema", "papel", "borde", "borde-campo",
  "tinta", "tinta-suave", "calido", "durazno", "durazno-texto", "lavanda", "rosa", "rojo", "naranja",
];

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: Object.fromEntries(names.map((name) => [name, v(name)])),
      borderRadius: { campo: "12px", boton: "14px", panel: "16px", tarjeta: "20px", concha: "1.75rem" },
      fontFamily: { texto: ["var(--font-texto)", "system-ui", "sans-serif"] },
      fontSize: { micro: ["10.5px", "1.4"], cuerpo: ["13px", "1.4"] },
      transitionTimingFunction: { fluido: "cubic-bezier(0.32, 0.72, 0, 1)" },
      boxShadow: {
        // Sombras difusas teñidas con el azul de la marca (nunca negro puro).
        suave: "0 28px 48px -32px rgb(7 43 59 / 0.28)",
        flota: "0 40px 70px -36px rgb(7 43 59 / 0.4)",
        pulsa: "0 12px 26px -14px rgb(12 78 103 / 0.6)",
      },
    },
  },
};
