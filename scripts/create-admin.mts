/**
 * Bootstrap del primer administrador de RentaMar.
 *
 * Usa la service role (bypassa RLS). Crea el usuario en Supabase Auth con el email
 * ya confirmado y fija su rol a `admin` en profiles. Es el ÚNICO camino para el
 * primer admin: el trigger enforce_profile_role_immutable exige un admin previo o
 * `auth.uid() is null` (que es el caso bajo service role) para cambiar un rol.
 *
 * Uso:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME="..." npx tsx scripts/create-admin.mts
 *
 * Requiere en el entorno (.env.local se puede exportar a mano):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const fullName = process.env.ADMIN_NAME ?? "Administrador";

function fail(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

if (!url || !serviceKey) fail("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
if (!email || !password) fail("Definí ADMIN_EMAIL y ADMIN_PASSWORD en el entorno.");
if (password.length < 10) fail("La contraseña debe tener al menos 10 caracteres.");

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log(`Creando administrador ${email}…`);

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  let userId = created?.user?.id;

  if (createErr) {
    // Si ya existe, lo buscamos para promoverlo igual (idempotencia operativa).
    if (/registered|exists/i.test(createErr.message)) {
      const { data: list } = await supabase.auth.admin.listUsers();
      userId = list?.users.find((u) => u.email?.toLowerCase() === email!.toLowerCase())?.id;
      if (!userId) fail(`El usuario existe pero no se pudo localizar: ${createErr.message}`);
      console.log("El usuario ya existía; se promoverá a admin.");
    } else {
      fail(`No se pudo crear el usuario: ${createErr.message}`);
    }
  }

  if (!userId) fail("No se obtuvo el id del usuario.");

  // El trigger handle_new_user crea el profile; nos aseguramos de email/nombre y rol.
  const { error: upsertErr } = await supabase
    .from("profiles")
    .upsert({ id: userId, email, full_name: fullName, role: "admin" }, { onConflict: "id" });

  if (upsertErr) fail(`No se pudo fijar el rol admin: ${upsertErr.message}`);

  console.log(`\n✔ Administrador listo: ${email}\n  Ingresá en /admin/login\n`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
