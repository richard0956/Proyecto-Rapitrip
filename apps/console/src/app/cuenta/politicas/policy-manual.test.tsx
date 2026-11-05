import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { itPolicyManual } from "@/content/it-policies";
import { PolicyManual } from "./policy-manual";

const policyTitles = () => screen.queryAllByText(/^Política \d+\./).map((el) => el.textContent);

describe("Políticas de TI", () => {
  it("un comercio ve primero lo que le aplica y puede abrir todo el manual", async () => {
    const user = userEvent.setup();
    render(<PolicyManual manual={itPolicyManual} area="comercio" roleLabel="comercio" />);
    expect(policyTitles()).toHaveLength(5);
    expect(screen.queryByText("Política 9. Pagos, Cobros y Liquidación con los Comercios Afiliados")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Todo el manual/ }));
    expect(policyTitles()).toHaveLength(9);
  });

  it("el buscador encuentra una regla y abre la política", async () => {
    const user = userEvent.setup();
    render(<PolicyManual manual={itPolicyManual} area="admin" roleLabel="la administración" />);
    await user.type(screen.getByRole("searchbox", { name: "Buscar en el manual" }), "Wi-Fi");
    expect(screen.getByRole("status")).toHaveTextContent("1 política");
    expect(screen.getByText(/Política 4\./).closest("details")).toHaveAttribute("open");
  });

  it("muestra los procedimientos con sus pasos", async () => {
    const user = userEvent.setup();
    render(<PolicyManual manual={itPolicyManual} area="admin" roleLabel="la administración" />);
    await user.click(screen.getByRole("button", { name: /Procedimientos/ }));
    expect(screen.getAllByText(/^Procedimiento \d+\./)).toHaveLength(13);
  });
});
