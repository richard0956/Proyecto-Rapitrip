import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { introScript, IntroSplash } from "./intro-splash";
import { Reveal } from "./reveal";

describe("IntroSplash", () => {
  it("es decorativa: oculta para tecnología asistiva y sin texto alternativo en las imágenes", () => {
    const { container } = render(<IntroSplash />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    container.querySelectorAll("img").forEach((img) => expect(img).toHaveAttribute("alt", ""));
  });
});

describe("introScript", () => {
  const run = () => new Function(introScript)();

  it("reproduce la introducción una sola vez por sesión", () => {
    sessionStorage.clear();
    delete document.documentElement.dataset.intro;
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    run();
    expect(document.documentElement.dataset.intro).toBe("playing");

    delete document.documentElement.dataset.intro;
    run();
    expect(document.documentElement.dataset.intro).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it("no se reproduce con «reducir movimiento»", () => {
    sessionStorage.clear();
    delete document.documentElement.dataset.intro;
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    run();
    expect(document.documentElement.dataset.intro).toBeUndefined();
    vi.unstubAllGlobals();
  });
});

describe("Reveal", () => {
  it("se muestra al entrar en pantalla", () => {
    let callback: IntersectionObserverCallback = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: IntersectionObserverCallback) {
          callback = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    const { container } = render(<Reveal index={2}>contenido</Reveal>);
    const node = container.firstElementChild as HTMLElement;
    expect(node).not.toHaveAttribute("data-visible");
    callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(node).toHaveAttribute("data-visible", "true");
    expect(node.style.getPropertyValue("--i")).toBe("2");
    vi.unstubAllGlobals();
  });

  it("sin IntersectionObserver deja el contenido visible", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(<Reveal>contenido</Reveal>);
    expect(container.firstElementChild).toHaveAttribute("data-visible", "true");
    vi.unstubAllGlobals();
  });
});
