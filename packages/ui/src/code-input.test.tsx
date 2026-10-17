import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CodeInput } from "./code-input";

describe("CodeInput", () => {
  it("deja solo dígitos y corta a seis", () => {
    const onChange = vi.fn();
    render(<CodeInput label="Código" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Código"), { target: { value: "12a34-5678" } });
    expect(onChange).toHaveBeenCalledWith("123456");
  });
});
