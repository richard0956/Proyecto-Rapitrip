const v = (name) => `var(--${name})`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        selva: v("selva"),
        hoja: v("hoja"),
        menta: v("menta"),
        "menta-borde": v("menta-borde"),
        crema: v("crema"),
        papel: v("papel"),
        borde: v("borde"),
        "borde-campo": v("borde-campo"),
        tinta: v("tinta"),
        "tinta-suave": v("tinta-suave"),
        mango: v("mango"),
        guayaba: v("guayaba"),
        calido: v("calido"),
      },
      borderRadius: { campo: "12px", tarjeta: "22px" },
      fontFamily: {
        titulo: ["var(--font-titulo)", "system-ui", "sans-serif"],
        texto: ["var(--font-texto)", "system-ui", "sans-serif"],
      },
    },
  },
};
