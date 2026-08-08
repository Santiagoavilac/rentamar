import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// El fixture crea sus propias cuentas para no depender de datos semilla. La propiedad y las
// habitaciones son atributos de la cuenta, así que no hay tablas aparte que preparar.
const OWNER = "fixture.coowner.a";
const OTHER = "fixture.coowner.b";
const PASSWORD = "fixture-password-1";
const PROPERTY_NAME = "Fixture Copropietarios";
const email = (username: string) => `${username}@copropietarios.local`;

describe.runIf(Boolean(url && anonKey && serviceKey))("register_co_owner_stay", () => {
  let admin: SupabaseClient;
  let ownerId: string;

  // Cliente autenticado como el copropietario: la RPC deriva la cuenta de auth.uid(),
  // así que el test tiene que pasar por el login real.
  const signIn = async (username: string) => {
    const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
    const { error } = await client.auth.signInWithPassword({
      email: email(username),
      password: PASSWORD,
    });
    if (error) throw error;
    return client;
  };

  const register = (client: SupabaseClient, overrides: Record<string, unknown> = {}) =>
    client.rpc("register_co_owner_stay", {
      p_full_name: "Ana Fixture",
      p_document_id: "CI-FIX-1",
      p_phone: "70011223",
      p_check_in_at: "2031-05-01T14:00:00-04:00",
      p_check_out_at: "2031-05-03T10:00:00-04:00",
      p_adults: 2,
      p_minors: 1,
      ...overrides,
    });

  const createAccount = async (username: string, propertyName: string, roomCount: number) => {
    const { data, error } = await admin.auth.admin.createUser({
      email: email(username),
      password: PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error("no user");
    const { error: roleErr } = await admin.rpc("change_user_role", {
      p_user_id: data.user.id,
      p_new_role: "co_owner",
      p_reason: "Fixture de integración",
      p_actor_id: data.user.id,
    });
    if (roleErr) throw roleErr;
    const { error: insertErr } = await admin.from("co_owner_accounts").insert({
      id: data.user.id,
      username,
      property_name: propertyName,
      room_count: roomCount,
    });
    if (insertErr) throw insertErr;
    return data.user.id;
  };

  // Las estadías tienen on delete restrict sobre la cuenta, así que la purga arranca por las
  // filas hijas. Sin esto una corrida fallida deja el fixture vivo.
  const purgeFixture = async () => {
    for (const username of [OWNER, OTHER]) {
      const { data } = await admin
        .from("co_owner_accounts")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (!data) continue;
      await admin.from("co_owner_stays").delete().eq("account_id", data.id);
      await admin.auth.admin.deleteUser(data.id);
    }
  };

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
    await purgeFixture();
    ownerId = await createAccount(OWNER, PROPERTY_NAME, 3);
    await createAccount(OTHER, "Fixture Otra Propiedad", 2);
  }, 30_000);

  afterAll(purgeFixture);

  it("guarda la copia congelada del usuario, la propiedad y las habitaciones", async () => {
    const client = await signIn(OWNER);
    const { data, error } = await register(client);
    expect(error).toBeNull();
    const stayId = (data as { stayId: string }).stayId;

    const { data: stay } = await admin
      .from("co_owner_stays")
      .select("username, property_name, room_count, account_id, adults, minors")
      .eq("id", stayId)
      .single();
    expect(stay).toMatchObject({
      username: OWNER,
      property_name: PROPERTY_NAME,
      room_count: 3,
      account_id: ownerId,
      adults: 2,
      minors: 1,
    });

    // Renombrar la propiedad después no altera lo ya declarado.
    await admin
      .from("co_owner_accounts")
      .update({ property_name: "Fixture Renombrada" })
      .eq("id", ownerId);
    const { data: after } = await admin
      .from("co_owner_stays")
      .select("property_name")
      .eq("id", stayId)
      .single();
    expect(after?.property_name).toBe(PROPERTY_NAME);
    await admin
      .from("co_owner_accounts")
      .update({ property_name: PROPERTY_NAME })
      .eq("id", ownerId);
  });

  it("rechaza una salida anterior o igual a la entrada", async () => {
    const client = await signIn(OWNER);
    const { error } = await register(client, {
      p_check_out_at: "2031-05-01T14:00:00-04:00",
    });
    expect(error?.message).toContain("INVALID_STAY_RANGE");
  });

  it("rechaza un conteo de huéspedes inválido", async () => {
    const client = await signIn(OWNER);
    const { error } = await register(client, { p_adults: 0 });
    expect(error?.message).toContain("INVALID_GUEST_COUNT");
  });

  it("rechaza una cuenta desactivada", async () => {
    await admin.from("co_owner_accounts").update({ is_active: false }).eq("id", ownerId);
    const client = await signIn(OWNER);
    const { error } = await register(client);
    expect(error?.message).toContain("CO_OWNER_INACTIVE");
    await admin.from("co_owner_accounts").update({ is_active: true }).eq("id", ownerId);
  });

  it("la RLS no deja ver las estadías de otra cuenta", async () => {
    const owner = await signIn(OWNER);
    const { data: created } = await register(owner);
    const stayId = (created as { stayId: string }).stayId;

    const other = await signIn(OTHER);
    const { data: visible } = await other.from("co_owner_stays").select("id").eq("id", stayId);
    expect(visible).toEqual([]);

    const { data: own } = await owner.from("co_owner_stays").select("id").eq("id", stayId);
    expect(own).toHaveLength(1);
  });
});
