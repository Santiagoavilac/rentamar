import { describe, expect, it } from "vitest";
import { checkinLabel, checkinState } from "./checkin-state";

describe("estado de registro de ingreso", () => {
  it("sin nadie registrado el registro está en rojo", () => {
    expect(checkinState(0, 4)).toBe("ninguno");
    expect(checkinLabel(0, 4)).toBe("No registrado");
  });

  it("con parte del grupo adentro queda en ámbar y dice cuántos faltan", () => {
    expect(checkinState(2, 5)).toBe("parcial");
    expect(checkinLabel(2, 5)).toBe("2 de 5");
  });

  it("con todos los declarados adentro pasa a verde", () => {
    expect(checkinState(3, 3)).toBe("completo");
    expect(checkinLabel(3, 3)).toBe("Registrado");
  });

  it("si recepción cargó un acompañante de más sigue en verde, no en ámbar", () => {
    expect(checkinState(4, 3)).toBe("completo");
  });

  it("una estadía sin personas declaradas no se queda en rojo para siempre", () => {
    // total 0 llegaría de un registro mal cargado; con alguien adentro tiene que dar verde.
    expect(checkinState(1, 0)).toBe("completo");
    expect(checkinState(0, 0)).toBe("ninguno");
  });
});
