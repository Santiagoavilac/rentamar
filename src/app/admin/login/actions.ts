"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
  redirectTo: z.string().optional(),
});

export type LoginState = { error: string | null };

// Solo un destino interno del panel es válido como redirect (anti open-redirect).
function safeRedirect(target: string | undefined): string {
  if (target && target.startsWith("/admin") && !target.startsWith("/admin/login")) {
    return target;
  }
  return "/admin";
}

export async function signInStaffAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo") ?? undefined,
  });
  if (!parsed.success) {
    return { error: "Ingresá un email y una contraseña válidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return { error: "Credenciales inválidas." };
  }

  // Solo staff puede entrar al panel. Si el perfil no es admin/operator, se cierra
  // la sesión inmediatamente (no auto-registro, no acceso de invitados).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "admin" && profile.role !== "operator")) {
    await supabase.auth.signOut();
    return { error: "Esta cuenta no tiene acceso al panel." };
  }

  redirect(safeRedirect(parsed.data.redirectTo));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
