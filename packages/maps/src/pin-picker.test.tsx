import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapView } from "./map-view";
import { PinPicker } from "./pin-picker";

// En jsdom no hay WebGL: el selector cae a su alternativa sin mapa, que es justo lo que hay que garantizar que funcione.
function mockGeolocation(result: { lat: number; lng: number } | { code: number }) {
  const getCurrentPosition = vi.fn((ok: (p: unknown) => void, fail: (e: unknown) => void) => {
    if ("lat" in result) ok({ coords: { latitude: result.lat, longitude: result.lng } });
    else fail({ code: result.code });
  });
  Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
  return getCurrentPosition;
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "geolocation");
});

describe("PinPicker", () => {
  it("sin mapa avisa y deja continuar con la dirección escrita", async () => {
    render(<PinPicker value={null} onChange={() => {}} token="" />);
    expect(await screen.findByText(/El mapa no está disponible/)).toBeInTheDocument();
    expect(screen.getByText(/Todavía no marcas el punto/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Mapa para marcar/ })).not.toBeInTheDocument();
  });

  it("«Usar mi ubicación» entrega el punto redondeado", async () => {
    const onChange = vi.fn();
    mockGeolocation({ lat: 12.13641234567, lng: -86.25149999 });
    render(<PinPicker value={null} onChange={onChange} token="" />);
    await userEvent.click(await screen.findByRole("button", { name: "Usar mi ubicación" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ lat: 12.136412, lng: -86.2515 }));
  });

  it("rechaza una ubicación fuera de Nicaragua", async () => {
    const onChange = vi.fn();
    mockGeolocation({ lat: 40.7, lng: -74.0 });
    render(<PinPicker value={null} onChange={onChange} token="" />);
    await userEvent.click(await screen.findByRole("button", { name: "Usar mi ubicación" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("fuera de Nicaragua");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("explica qué hacer si no se da permiso de ubicación", async () => {
    mockGeolocation({ code: 1 });
    render(<PinPicker value={null} onChange={() => {}} token="" />);
    await userEvent.click(await screen.findByRole("button", { name: "Usar mi ubicación" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No diste permiso");
  });

  it("muestra el punto marcado y permite quitarlo", async () => {
    const onChange = vi.fn();
    render(<PinPicker value={{ lat: 12.1364, lng: -86.2514 }} onChange={onChange} token="" />);
    expect(await screen.findByText(/Punto marcado: 12.13640, -86.25140/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Quitar el pin" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("deshabilitado no deja cambiar el pin", async () => {
    render(<PinPicker value={{ lat: 12.1364, lng: -86.2514 }} onChange={() => {}} token="" disabled />);
    expect(await screen.findByRole("button", { name: "Usar mi ubicación" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Quitar el pin" })).toBeDisabled();
  });
});

describe("dirección sugerida", () => {
  it("sugiere la dirección del punto y la entrega cuando se acepta", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [{ properties: { full_address: "Villa Fontana, Managua, Nicaragua" } }] }) }));
    const onUseAddress = vi.fn();
    render(<PinPicker value={{ lat: 12.1034, lng: -86.2671 }} onChange={() => {}} token="pk.test" onUseAddress={onUseAddress} />);
    expect(await screen.findByText("Villa Fontana, Managua")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Usar como dirección" }));
    expect(onUseAddress).toHaveBeenCalledWith("Villa Fontana, Managua");
    vi.unstubAllGlobals();
  });

  it("no pide ni muestra sugerencias si la pantalla no las usa", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<PinPicker value={{ lat: 12.1034, lng: -86.2671 }} onChange={() => {}} token="pk.test" />);
    await screen.findByText(/Punto marcado/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Usar como dirección")).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

describe("MapView", () => {
  it("lista los puntos aunque no haya mapa", async () => {
    render(
      <MapView
        token=""
        markers={[
          { id: "t", label: "Tienda", tone: "tienda", point: { lat: 12.128, lng: -86.2649 } },
          { id: "c", label: "Destino", point: { lat: 12.1364, lng: -86.2514 } },
        ]}
      />,
    );
    expect(await screen.findByText(/12.12800, -86.26490/)).toBeInTheDocument();
    expect(screen.getByText(/12.13640, -86.25140/)).toBeInTheDocument();
  });
});
