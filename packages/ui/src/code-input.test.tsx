import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CodeInput } from "./code-input";

function Harness({ onChange }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <CodeInput
      label="Código"
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

describe("CodeInput", () => {
  it("muestra seis cajas accesibles", () => {
    render(<Harness />);
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
    expect(screen.getByLabelText("Código, dígito 1 de 6")).toBeInTheDocument();
  });

  it("avanza de caja al escribir y arma el código", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.setup().type(screen.getByLabelText("Código, dígito 1 de 6"), "482");
    expect(onChange).toHaveBeenLastCalledWith("482");
    expect(screen.getByLabelText("Código, dígito 4 de 6")).toHaveFocus();
  });

  it("al pegar deja solo dígitos y corta a seis", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.paste(screen.getByLabelText("Código, dígito 1 de 6"), { clipboardData: { getData: () => "12a34-5678" } });
    expect(onChange).toHaveBeenLastCalledWith("123456");
  });

  it("borra hacia atrás con Retroceso", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Código, dígito 1 de 6"), "12");
    await user.keyboard("{Backspace}");
    expect(onChange).toHaveBeenLastCalledWith("1");
  });
});
