// Verde / ámbar / rojo del registro de ingreso. Módulo puro (sin server-only) porque lo
// consumen tanto las páginas del panel como el badge, que es un componente cliente.
//
// Es una derivación, no un estado guardado: la verdad son las filas de access_checkins, y
// contarlas evita que dos columnas terminen contradiciéndose.

export type CheckinState = "ninguno" | "parcial" | "completo";

export function checkinState(checkedIn: number, total: number): CheckinState {
  if (checkedIn <= 0) return "ninguno";
  // El grupo puede presentarse con menos gente de la declarada, o con alguien de más si
  // recepción cargó un acompañante extra: con cubrir a los declarados alcanza para el verde.
  return checkedIn >= total ? "completo" : "parcial";
}

export function checkinLabel(checkedIn: number, total: number): string {
  const state = checkinState(checkedIn, total);
  if (state === "ninguno") return "No registrado";
  if (state === "completo") return "Registrado";
  return `${checkedIn} de ${total}`;
}
