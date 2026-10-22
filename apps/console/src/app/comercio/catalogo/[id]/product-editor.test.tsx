import { defaultExpressLimits } from "@rapitrip/validation";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace: vi.fn() }) }));
vi.mock("@rapitrip/supabase/browser", () => ({ createBrowserSupabase: () => ({}) }));

import { ProductEditor } from "./product-editor";

const ok = { ok: true } as const;
const actions = {
  setProductDelivery: vi.fn(),
  removeVariantDiscount: vi.fn(),
  updateProduct: vi.fn(),
  setProductStatus: vi.fn(),
  createVariant: vi.fn(),
  updateVariant: vi.fn(),
  setVariantStatus: vi.fn(),
  addProductImage: vi.fn(),
  removeProductImage: vi.fn(),
};

const delivery = { id: "p1", expressEligible: true, weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10, validationDays: null, expressOk: true, categoryOnly: false };
const product = { id: "p1", storeId: "s1", name: "Café", description: null, categoryId: null, brandId: null, typeId: null, status: "borrador" as const };

function setup(variants: { id: string; name: string; sku: string; price: number; compareAt: number | null; discountPct: number; active: boolean }[]) {
  render(<ProductEditor product={product} delivery={delivery} limits={defaultExpressLimits} variants={variants} images={[]} master={[]} disabled={false} actions={actions} />);
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of Object.values(actions)) fn.mockResolvedValue(ok);
});

describe("variantes con descuento", () => {
  it("muestra el precio anterior, el porcentaje y permite quitar el descuento", async () => {
    const user = setup([{ id: "v1", name: "500 g", sku: "CAFE-500", price: 80, compareAt: 100, discountPct: 20, active: true }]);
    expect(screen.getByText("-20 %")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar descuento" }));
    await waitFor(() => expect(actions.removeVariantDiscount).toHaveBeenCalledWith("p1", "v1"));
  });

  it("una variante sin descuento no ofrece quitarlo", () => {
    setup([{ id: "v1", name: "500 g", sku: "CAFE-500", price: 100, compareAt: null, discountPct: 0, active: true }]);
    expect(screen.queryByRole("button", { name: "Quitar descuento" })).not.toBeInTheDocument();
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });

  it("avisa antes de guardar que un precio más bajo activa el descuento", async () => {
    const user = setup([{ id: "v1", name: "500 g", sku: "CAFE-500", price: 100, compareAt: null, discountPct: 0, active: true }]);
    await user.click(screen.getByRole("button", { name: "Editar 500 g" }));
    const form = screen.getByRole("button", { name: "Guardar" }).closest("form")!;
    const price = within(form).getByLabelText("Precio");
    await user.clear(price);
    await user.type(price, "96");
    expect(screen.queryByText(/queda en descuento/)).not.toBeInTheDocument();
    await user.clear(price);
    await user.type(price, "80");
    expect(screen.getByText(/queda en descuento: -20 %/)).toBeInTheDocument();
  });

  it("avisa que subir el precio quita el descuento", async () => {
    const user = setup([{ id: "v1", name: "500 g", sku: "CAFE-500", price: 80, compareAt: 100, discountPct: 20, active: true }]);
    await user.click(screen.getByRole("button", { name: "Editar 500 g" }));
    const form = screen.getByRole("button", { name: "Guardar" }).closest("form")!;
    const price = within(form).getByLabelText("Precio");
    await user.clear(price);
    await user.type(price, "99");
    expect(screen.getByText(/se quita el descuento/)).toBeInTheDocument();
  });
});
