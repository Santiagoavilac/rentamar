// Supabase Auth exige un email para autenticar con contraseña, pero el módulo de
// copropietarios trabaja con usuario. El email se deriva del username de forma
// determinística: así el login no necesita consultar ninguna tabla antes de autenticar
// (no hay endpoint que permita enumerar usuarios) y el admin nunca tiene que inventar uno.
// Este dominio es interno y nunca se muestra ni se le envía correo.
const CO_OWNER_EMAIL_DOMAIN = "copropietarios.local";

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function coOwnerEmail(username: string): string {
  return `${normalizeUsername(username)}@${CO_OWNER_EMAIL_DOMAIN}`;
}
