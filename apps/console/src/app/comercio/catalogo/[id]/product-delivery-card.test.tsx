import { defaultExpressLimits } from "@rapitrip/validation";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace: vi.fn() }) }));

import { ProductDeliveryCard, type DeliveryProduct } from "./product-delivery-card";

const small: DeliveryProduct = { id: "p1", expressEligible: true, weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10, validationDays: null, expressOk: true, categoryOnly: false };
const legacy: DeliveryProduct = { ...small, weightKg: null, lengthCm: null, widthCm: null, heightCm: null };
const save = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  save.mockResolvedValue({ ok: true });
});

describe("ProductDeliveryCard", () => {
  it("explica los dos tipos con los límites vigentes y muestra la clase actual", () => {
    render(<ProductDeliveryCard product={small} limits={defaultExpressLimits} locked={false} save={save} />);
    expect(screen.getByText(/hasta 5 kg y 45 cm de lado/)).toBeInTheDocument();
    expect(screen.getByText(/Lo lleva un repartidor con carro o camión/)).toBeInTheDocument();
    expect(screen.getByText("Express")).toBeInTheDocument();
  });

  it("guarda un producto express con su peso y medidas", async () => {
    render(<ProductDeliveryCard product={small} limits={defaultExpressLimits} locked={false} save={save} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Guardar tipo de entrega" }));
    expect(save).toHaveBeenCalledWith("p1", { express_eligible: true, weight_kg: 1, length_cm: 10, width_cm: 10, height_cm: 10, validation_days: null });
    expect(await screen.findByText("Tipo de entrega guardado.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("no deja guardar como express un producto que no cabe en una moto", async () => {
    render(<ProductDeliveryCard product={small} limits={defaultExpressLimits} locked={false} save={save} />);
    const user = userEvent.setup();
    const weight = screen.getByLabelText("Peso (kg)");
    await user.clear(weight);
    await user.type(weight, "8");
    expect(screen.getByText(/pesa hasta 5 kg/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar tipo de entrega" })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Tipo de entrega"), "programado");
    expect(screen.queryByText(/pesa hasta 5 kg/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar tipo de entrega" })).toBeEnabled();
  });

  it("un producto programado puede guardarse sin medidas y con días de validación", async () => {
    render(<ProductDeliveryCard product={{ ...legacy, expressEligible: false, expressOk: false }} limits={defaultExpressLimits} locked={false} save={save} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Días de validación (opcional)"), "7");
    await user.click(screen.getByRole("button", { name: "Guardar tipo de entrega" }));
    expect(save).toHaveBeenCalledWith("p1", { express_eligible: false, weight_kg: null, length_cm: null, width_cm: null, height_cm: null, validation_days: 7 });
  });

  it("avisa y exige medidas a un producto anterior que se entrega como express sin ellas", () => {
    render(<ProductDeliveryCard product={legacy} limits={defaultExpressLimits} locked={false} save={save} />);
    expect(screen.getByText(/sin peso ni medidas registrados/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar tipo de entrega" })).toBeDisabled();
  });

  it("en una categoría solo programado no se puede elegir express", () => {
    render(<ProductDeliveryCard product={{ ...small, expressOk: false, categoryOnly: true }} limits={defaultExpressLimits} locked={false} save={save} />);
    expect(screen.getByText(/solo se entrega de forma programada/)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Express/ })).toBeDisabled();
    expect(screen.getByLabelText("Tipo de entrega")).toHaveValue("programado");
  });

  it("muestra el motivo si la base de datos rechaza el cambio", async () => {
    save.mockResolvedValue({ ok: false, error: "un producto express pesa hasta 5 kg" });
    render(<ProductDeliveryCard product={small} limits={defaultExpressLimits} locked={false} save={save} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Guardar tipo de entrega" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("un producto express pesa hasta 5 kg");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("bloqueado (producto archivado) no deja editar", () => {
    render(<ProductDeliveryCard product={small} limits={defaultExpressLimits} locked save={save} />);
    expect(screen.getByLabelText("Peso (kg)")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Guardar tipo de entrega" })).toBeDisabled();
  });
});
