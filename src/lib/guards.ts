import { normalizeUsername } from "./co-owners";

// Mismo mecanismo que limpieza y copropietarios: Supabase Auth exige un email, pero acá se
// trabaja con usuario, así que el email se deriva del username de forma determinística.
// Dominio interno, nunca se muestra ni se le envía correo.
const GUARD_EMAIL_DOMAIN = "guardias.local";

export function guardEmail(username: string): string {
  return `${normalizeUsername(username)}@${GUARD_EMAIL_DOMAIN}`;
}
