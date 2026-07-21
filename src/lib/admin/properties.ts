import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, NotFoundError, SlugTakenError } from "@/lib/errors";
import { decimalStringToMinor } from "@/lib/money";
import type { PropertyInput } from "@/lib/validation";

// Columnas explícitas: nunca se hace select("*") ni se aceptan campos arbitrarios.
const PROPERTY_COLUMNS =
  "id, name, slug, short_description, description, property_type, zone, status, featured, base_price_minor, currency, bedrooms, bathrooms, beds, max_guests, minimum_nights, check_in_time, check_out_time, created_at, updated_at";

export type AdminPropertyRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  featured: boolean;
  base_price_minor: number;
  currency: string;
  zone: string | null;
  max_guests: number;
};

export type PropertyListResult = {
  rows: AdminPropertyRow[];
  total: number;
  page: number;
  pageSize: number;
};

export async function listProperties(params: {
  page: number;
  pageSize: number;
  status?: string;
  search?: string;
}): Promise<PropertyListResult> {
  const supabase = await createClient();
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  let query = supabase
    .from("properties")
    .select("id, name, slug, status, featured, base_price_minor, currency, zone, max_guests", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.status) query = query.eq("status", params.status as never);
  if (params.search) query = query.ilike("name", `%${params.search}%`);

  const { data, error, count } = await query;
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return {
    rows: (data ?? []) as AdminPropertyRow[],
    total: count ?? 0,
    page: params.page,
    pageSize: params.pageSize,
  };
}

export async function getProperty(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select(PROPERTY_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  if (!data) throw new NotFoundError("Propiedad no encontrada");
  return data;
}

export async function getPropertyImages(propertyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("property_images")
    .select("id, url, alt_text, is_cover, sort_order")
    .eq("property_id", propertyId)
    .order("sort_order", { ascending: true });
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return data ?? [];
}

export async function getPropertyAmenities(propertyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("property_amenities")
    .select("amenity_id")
    .eq("property_id", propertyId);
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return (data ?? []).map((r) => r.amenity_id);
}

export async function listAmenities() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("amenities")
    .select("id, name, slug, icon")
    .order("name", { ascending: true });
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return data ?? [];
}

// Mapea el input validado a columnas explícitas (anti mass-assignment).
function toRow(input: PropertyInput) {
  return {
    name: input.name,
    slug: input.slug,
    short_description: input.shortDescription || null,
    description: input.description || null,
    property_type: input.propertyType || null,
    zone: input.zone || null,
    status: input.status,
    featured: input.featured,
    base_price_minor: decimalStringToMinor(input.basePrice),
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    beds: input.beds,
    max_guests: input.maxGuests,
    minimum_nights: input.minimumNights,
    check_in_time: input.checkInTime,
    check_out_time: input.checkOutTime,
  };
}

function mapWriteError(message: string | undefined): never {
  if (message && /duplicate key|unique/i.test(message)) throw new SlugTakenError();
  throw new AppError("INTERNAL_ERROR", "Error interno", 500);
}

export async function createProperty(input: PropertyInput): Promise<{ id: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("properties")
    .insert(toRow(input))
    .select("id")
    .single();
  if (error) mapWriteError(error.message);
  return { id: data.id };
}

export async function updateProperty(
  id: string,
  input: PropertyInput,
): Promise<{ before: unknown; after: unknown }> {
  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("properties")
    .select(PROPERTY_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (!before) throw new NotFoundError("Propiedad no encontrada");

  // El precio base se cambia exclusivamente vía change_property_base_price para
  // preservar price_change_history. Esta actualización cubre los demás campos.
  const { base_price_minor, ...row } = toRow(input);
  void base_price_minor;
  const { data: after, error } = await supabase
    .from("properties")
    .update(row)
    .eq("id", id)
    .select(PROPERTY_COLUMNS)
    .single();
  if (error) mapWriteError(error.message);
  return { before, after };
}

// Alta de imagen: se guarda la URL pública del objeto ya subido a Storage.
export async function addPropertyImage(params: {
  propertyId: string;
  url: string;
  altText: string | null;
  isCover: boolean;
}) {
  const supabase = createAdminClient();
  if (params.isCover) {
    await supabase
      .from("property_images")
      .update({ is_cover: false })
      .eq("property_id", params.propertyId);
  }
  const { data: max } = await supabase
    .from("property_images")
    .select("sort_order")
    .eq("property_id", params.propertyId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (max?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("property_images")
    .insert({
      property_id: params.propertyId,
      url: params.url,
      alt_text: params.altText,
      is_cover: params.isCover,
      sort_order: nextOrder,
    })
    .select("id")
    .single();
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  return { id: data.id };
}

// La subida siempre ocurre del lado del servidor con service role. No se confía en
// el nombre ni en la extensión entregados por el navegador.
export async function uploadPropertyImage(params: {
  propertyId: string;
  file: File;
  altText: string | null;
  isCover: boolean;
}) {
  const allowed: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = allowed[params.file.type];
  if (!extension || params.file.size <= 0 || params.file.size > 8 * 1024 * 1024) {
    throw new AppError(
      "VALIDATION_ERROR",
      "La imagen debe ser JPG, PNG o WebP y pesar hasta 8 MB",
      422,
    );
  }
  const supabase = createAdminClient();
  const path = `${params.propertyId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("property-images")
    .upload(path, params.file, {
      contentType: params.file.type,
      upsert: false,
    });
  if (uploadError) throw new AppError("INTERNAL_ERROR", "No se pudo subir la imagen", 500);
  const { data: publicUrl } = supabase.storage.from("property-images").getPublicUrl(path);
  try {
    return await addPropertyImage({ ...params, url: publicUrl.publicUrl });
  } catch (error) {
    await supabase.storage.from("property-images").remove([path]);
    throw error;
  }
}

export async function setCoverImage(propertyId: string, imageId: string) {
  const supabase = createAdminClient();
  await supabase.from("property_images").update({ is_cover: false }).eq("property_id", propertyId);
  const { error } = await supabase
    .from("property_images")
    .update({ is_cover: true })
    .eq("id", imageId)
    .eq("property_id", propertyId);
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
}

export async function deletePropertyImage(propertyId: string, imageId: string) {
  const supabase = createAdminClient();
  const { data: img } = await supabase
    .from("property_images")
    .select("url")
    .eq("id", imageId)
    .eq("property_id", propertyId)
    .maybeSingle();

  const { error } = await supabase
    .from("property_images")
    .delete()
    .eq("id", imageId)
    .eq("property_id", propertyId);
  if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);

  // Best-effort: quitar el objeto del bucket si la URL apunta a él.
  if (img?.url) {
    const marker = "/property-images/";
    const idx = img.url.indexOf(marker);
    if (idx >= 0) {
      const path = img.url.slice(idx + marker.length);
      await supabase.storage.from("property-images").remove([path]);
    }
  }
}

export async function setPropertyAmenities(propertyId: string, amenityIds: string[]) {
  const supabase = createAdminClient();
  await supabase.from("property_amenities").delete().eq("property_id", propertyId);
  if (amenityIds.length > 0) {
    const { error } = await supabase
      .from("property_amenities")
      .insert(amenityIds.map((amenity_id) => ({ property_id: propertyId, amenity_id })));
    if (error) throw new AppError("INTERNAL_ERROR", "Error interno", 500);
  }
}
