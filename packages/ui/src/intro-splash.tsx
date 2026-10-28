/**
 * Introducción de marca: una cortina azul con el emblema, el nombre y el lema que sube y revela la página.
 *
 * Es solo marcado y CSS (`motion.css`), así que no depende de que la hidratación termine. El script de `introScript` decide antes del
 * primer pintado si se reproduce: una vez por sesión y nunca con "reducir movimiento" ni sin JavaScript.
 */
export function IntroSplash() {
  return (
    <div className="intro-root" aria-hidden="true">
      <div className="intro-glow" />
      <div className="intro-tile">
        <img src="/brand/emblema-192.webp" width={163} height={192} alt="" className="h-16 w-auto" />
      </div>
      <p className="intro-word font-titulo text-[28px] font-bold leading-none tracking-tight text-white">Rapitrip</p>
      <p className="intro-tag text-[10.5px] font-bold uppercase tracking-[0.22em] text-bruma dark:text-nav-texto/70">Seguridad y Confianza</p>
      <div className="intro-line" />
    </div>
  );
}

/** Va en el <head>. Marca la sesión para no repetir la introducción y retira el atributo cuando termina. */
export const introScript = `try{var d=document.documentElement,s=sessionStorage;if(!s.getItem("rapitrip:intro")&&!matchMedia("(prefers-reduced-motion: reduce)").matches){s.setItem("rapitrip:intro","1");d.dataset.intro="playing";setTimeout(function(){d.dataset.intro="off"},2800)}}catch(e){}`;
