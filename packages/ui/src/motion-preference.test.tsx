import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MOTION_KEY, motionScript, prefersLessMotion, scrollBehavior, setMotionReduced } from "./motion-preference";
import { useMotionReduced } from "./use-motion-reduced";

function Probe() {
  return <span>{useMotionReduced() ? "reducido" : "normal"}</span>;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  delete document.documentElement.dataset.motion;
});

describe("reducir animaciones", () => {
  it("se guarda, se aplica en <html> y avisa a los interruptores", () => {
    render(<Probe />);
    expect(screen.getByText("normal")).toBeInTheDocument();
    act(() => setMotionReduced(true));
    expect(screen.getByText("reducido")).toBeInTheDocument();
    expect(document.documentElement.dataset.motion).toBe("reducido");
    expect(localStorage.getItem(MOTION_KEY)).toBe("reducido");
    expect(prefersLessMotion()).toBe(true);
    expect(scrollBehavior()).toBe("auto");
    act(() => setMotionReduced(false));
    expect(screen.getByText("normal")).toBeInTheDocument();
    expect(document.documentElement.dataset.motion).toBeUndefined();
    expect(localStorage.getItem(MOTION_KEY)).toBeNull();
  });

  it("el script del <head> la aplica antes de pintar y apaga la introducción; también lee la clave vieja de la consola", () => {
    localStorage.setItem("rapitrip:consola:movimiento", "reducido");
    new Function(motionScript)();
    expect(document.documentElement.dataset.motion).toBe("reducido");
    expect(sessionStorage.getItem("rapitrip:intro")).toBe("1");
  });

  it("sin elección guardada, el script no toca nada", () => {
    new Function(motionScript)();
    expect(document.documentElement.dataset.motion).toBeUndefined();
    expect(sessionStorage.getItem("rapitrip:intro")).toBeNull();
  });
});
