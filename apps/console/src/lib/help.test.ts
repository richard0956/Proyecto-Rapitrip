import { describe, expect, it } from "vitest";
import { helpByArea, helpFor } from "./help";

const topicIds = (guide: ReturnType<typeof helpFor>) => guide.groups.flatMap((group) => group.topics.map((topic) => topic.id));

describe("manual de ayuda por rol", () => {
  it("cada área tiene su propio manual, con lo común de la cuenta al final", () => {
    for (const area of ["admin", "caja", "coordinacion", "comercio"] as const) {
      const guide = helpFor(area, false);
      expect(guide.groups.length).toBeGreaterThan(1);
      expect(guide.groups.at(-1)?.title).toBe("Tu cuenta y tu sesión");
      expect(guide.faq.length).toBeGreaterThan(0);
    }
    expect(topicIds(helpFor("caja", false))).toContain("cerrar");
    expect(topicIds(helpFor("caja", false))).not.toContain("usuarios");
  });

  it("lo reservado a la dirección solo lo ve el director", () => {
    expect(topicIds(helpFor("admin", false))).not.toContain("datos");
    const director = helpFor("admin", true);
    expect(topicIds(director)).toContain("datos");
    expect(director.role).toBe("Dirección");
  });

  it("los roles que reportan incidentes llevan a su propia pantalla; la administración no", () => {
    const href = (area: "caja" | "coordinacion" | "comercio") => helpFor(area, false).groups.flatMap((g) => g.topics).find((t) => t.id === "incidente")?.href;
    expect(href("caja")).toBe("/caja/incidentes");
    expect(href("coordinacion")).toBe("/coordinacion/incidentes");
    expect(href("comercio")).toBe("/comercio/incidentes");
    expect(topicIds(helpFor("admin", true))).not.toContain("incidente");
  });

  it("todos los enlaces son rutas internas y los temas no repiten id dentro de un manual", () => {
    for (const guide of Object.values(helpByArea)) {
      const topics = guide.groups.flatMap((group) => group.topics);
      for (const topic of topics) if (topic.href) expect(topic.href.startsWith("/")).toBe(true);
      expect(new Set(topics.map((topic) => topic.id)).size).toBe(topics.length);
    }
  });
});
