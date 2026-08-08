import { normalizeUsername } from "./co-owners";

// Mismo mecanismo que copropietarios: Supabase Auth exige un email, pero acá se trabaja con
// usuario, así que el email se deriva del username de forma determinística. Dominio interno,
// nunca se muestra ni se le envía correo.
const CLEANER_EMAIL_DOMAIN = "limpieza.local";

export function cleanerEmail(username: string): string {
  return `${normalizeUsername(username)}@${CLEANER_EMAIL_DOMAIN}`;
}
