import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Alert, Badge, Button, Card, Checkbox, EmptyState, SelectField, StatCard, Switch, TextField } from "..";

describe("Button", () => {
  it("es type=button por defecto y dispara onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);
    const btn = screen.getByRole("button", { name: "Guardar" });
    expect(btn).toHaveAttribute("type", "button");
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("loading deshabilita y marca aria-busy", async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Enviar</Button>);
    const btn = screen.getByRole("button", { name: "Enviar" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("aplica la variante peligro con borde guayaba y texto tinta", () => {
    render(<Button variant="danger">Revocar</Button>);
    const cls = screen.getByRole("button").className;
    expect(cls).toContain("border-guayaba");
    expect(cls).toContain("text-tinta");
  });
});

describe("TextField", () => {
  it("asocia etiqueta y campo", async () => {
    render(<TextField label="Correo" />);
    await userEvent.type(screen.getByLabelText("Correo"), "a@b.co");
    expect(screen.getByLabelText("Correo")).toHaveValue("a@b.co");
  });

  it("con error marca aria-invalid y describe el campo con un alert", () => {
    render(<TextField label="Correo" error="correo inválido" />);
    const input = screen.getByLabelText("Correo");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("correo inválido");
    expect(input.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
  });

  it("muestra la ayuda cuando no hay error", () => {
    render(<TextField label="Teléfono" hint="Con indicativo" />);
    expect(screen.getByText("Con indicativo")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("SelectField", () => {
  it("permite elegir una opción", async () => {
    render(
      <SelectField label="Rol" defaultValue="admin">
        <option value="admin">Administrador</option>
        <option value="cajero">Cajero</option>
      </SelectField>,
    );
    await userEvent.selectOptions(screen.getByLabelText("Rol"), "cajero");
    expect(screen.getByLabelText("Rol")).toHaveValue("cajero");
  });
});

describe("Checkbox y Switch", () => {
  it("la casilla se marca al pulsar su etiqueta", async () => {
    render(<Checkbox label="Acepto" />);
    await userEvent.click(screen.getByText("Acepto"));
    expect(screen.getByRole("checkbox", { name: "Acepto" })).toBeChecked();
  });

  it("el interruptor expone role=switch y alterna", async () => {
    render(<Switch label="Activo" />);
    const sw = screen.getByRole("switch", { name: "Activo" });
    await userEvent.click(sw);
    expect(sw).toBeChecked();
  });
});

describe("Feedback y contenedores", () => {
  it("Alert de error usa role=alert; la informativa usa status", () => {
    render(
      <>
        <Alert tone="error">Falló</Alert>
        <Alert>Listo</Alert>
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Falló");
    expect(screen.getByRole("status")).toHaveTextContent("Listo");
  });

  it("Badge, Card, StatCard y EmptyState renderizan su contenido", () => {
    render(
      <>
        <Badge tone="positive">Activo</Badge>
        <Card>Contenido</Card>
        <StatCard label="Pendientes" value={4} note="solicitudes" />
        <EmptyState title="Sin datos" description="Aún no hay nada" action={<Button>Crear</Button>} />
      </>,
    );
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("Contenido")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sin datos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear" })).toBeInTheDocument();
  });
});
