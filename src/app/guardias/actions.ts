"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireGuard } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/admin/context";
import { AppError } from "@/lib/errors";
import { setVehiclePlate } from "@/lib/access";

export type PlateFormState = { ok: boolean; error: string | null };

const plateFormSchema = z
  .object({
    bookingId: z.string().trim().optional(),
    stayId: z.string().trim().optional(),
    plate: z.string().trim().min(1, "Escribí la placa").max(20, "Placa demasiado larga"),
  })
  .refine((value) => Boolean(value.bookingId) !== Boolean(value.stayId), {
    message: "Reserva o estadía, no las dos",
  });

// Único dato que el guardia puede escribir (todo lo demás en /guardias es de solo
// lectura): la placa del vehículo del grupo que está entrando.
export async function setVehiclePlateAction(
  _prev: PlateFormState,
  formData: FormData,
): Promise<PlateFormState> {
  try {
    await requireGuard();
    await assertSameOrigin();

    const parsed = plateFormSchema.safeParse({
      bookingId: (formData.get("bookingId") as string) || undefined,
      stayId: (formData.get("stayId") as string) || undefined,
      plate: formData.get("plate"),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
    }

    await setVehiclePlate(
      { bookingId: parsed.data.bookingId ?? null, stayId: parsed.data.stayId ?? null },
      parsed.data.plate,
    );
  } catch (error) {
    if (error instanceof AppError && error.code !== "INTERNAL_ERROR") {
      return { ok: false, error: error.message };
    }
    if (error instanceof Error && error.message === "ORIGIN_MISMATCH") {
      return { ok: false, error: "Solicitud rechazada (origen inválido)." };
    }
    console.error("[guardias-plate]", error instanceof Error ? error.message : "unknown");
    return { ok: false, error: "Ocurrió un error. Intentá de nuevo." };
  }

  revalidatePath("/guardias");
  revalidatePath("/admin/accesos");
  return { ok: true, error: null };
}
