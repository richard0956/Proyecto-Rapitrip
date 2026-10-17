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
      <img className="intro-word h-6 w-auto" src="/brand/wordmark-blanco.webp" width={720} height={189} alt="" />
      <img className="intro-tag h-[18px] w-auto" src="/brand/lema-blanco.webp" width={720} height={65} alt="" />
      <div className="intro-line" />
    </div>
  );
}

/** Va en el <head>. Marca la sesión para no repetir la introducción y retira el atributo cuando termina. */
export const introScript = `try{var d=document.documentElement,s=sessionStorage;if(!s.getItem("rapitrip:intro")&&!matchMedia("(prefers-reduced-motion: reduce)").matches){s.setItem("rapitrip:intro","1");d.dataset.intro="playing";setTimeout(function(){d.dataset.intro="off"},2800)}}catch(e){}`;
