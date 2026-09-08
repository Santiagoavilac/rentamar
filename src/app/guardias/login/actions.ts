"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { normalizeUsername } from "@/lib/co-owners";
import { guardEmail } from "@/lib/guards";

// Login del guardia con usuario y contraseña. El email que Supabase Auth exige se deriva del
// usuario (guardEmail), así que nunca se le pide ni se le muestra. No hay registro público ni
// recuperación: las cuentas las crea administración.

const loginSchema = z.object({
  username: z.string().trim().min(1).max(40),
  password: z.string().min(1).max(200),
});

export type GuardLoginState = { error: string | null };

export async function signInGuardAction(
  _prev: GuardLoginState,
  formData: FormData,
): Promise<GuardLoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Ingresá tu usuario y contraseña." };

  const username = normalizeUsername(parsed.data.username);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: guardEmail(username),
    password: parsed.data.password,
  });
  // Mensaje genérico a propósito: no revela si el usuario existe.
  if (error || !data.user) return { error: "Credenciales inválidas." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile?.role !== "guard") {
    await supabase.auth.signOut();
    return { error: "Credenciales inválidas." };
  }

  const { data: account } = await supabase
    .from("guard_accounts")
    .select("is_active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!account?.is_active) {
    await supabase.auth.signOut();
    return { error: "Tu cuenta está desactivada. Contactá a administración." };
  }

  redirect("/guardias");
}

export async function signOutGuardAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/guardias/login");
}
