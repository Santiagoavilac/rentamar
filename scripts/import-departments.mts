import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

const execFileAsync = promisify(execFile);
const expectedProjectRef = "cxozsfrwyvncdfulkcbi";
const bucket = "property-images";
const apply = process.argv.includes("--apply");
const validateImages = process.argv.includes("--validate-images");
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".heic"]);
const roots = [
  { bedrooms: 1, directory: "/Users/user/Downloads/deptos 1 dorm" },
  { bedrooms: 2, directory: "/Users/user/Downloads/deptos 2 dorms" },
  { bedrooms: 3, directory: "/Users/user/Downloads/deptos 3 dorms" },
  { bedrooms: 4, directory: "/Users/user/Downloads/deptos 4 dorms" },
];

type Department = {
  bedrooms: number;
  directory: string;
  name: string;
  slug: string;
  images: string[];
};

function cleanName(folderName: string) {
  return folderName
    .replace(/^(\d+)\s+Dormi\b/i, "$1 Dorm")
    .replace(/_+$/g, "")
    .trim();
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function inventory(): Promise<Department[]> {
  const departments: Department[] = [];
  for (const root of roots) {
    const entries = await readdir(root.directory, { withFileTypes: true });
    for (const entry of entries.filter((item) => item.isDirectory())) {
      const directory = path.join(root.directory, entry.name);
      const files = await readdir(directory, { withFileTypes: true });
      const candidates = files
        .filter(
          (file) => file.isFile() && allowedExtensions.has(path.extname(file.name).toLowerCase()),
        )
        .map((file) => path.join(directory, file.name))
        .sort((a, b) => path.basename(a).localeCompare(path.basename(b), "es", { numeric: true }));
      const images: string[] = [];
      for (const candidate of candidates) {
        const file = await stat(candidate);
        if (file.size > 0) images.push(candidate);
        else console.warn(`IGNORADO | Archivo vacío: ${candidate}`);
      }
      if (!images.length) throw new Error(`La carpeta no tiene imágenes compatibles: ${directory}`);
      const name = cleanName(entry.name);
      departments.push({ bedrooms: root.bedrooms, directory, name, slug: slugify(name), images });
    }
  }
  departments.sort((a, b) => a.bedrooms - b.bedrooms || a.name.localeCompare(b.name, "es"));
  const duplicateSlugs = departments.filter(
    (department, index) => departments.findIndex((item) => item.slug === department.slug) !== index,
  );
  if (duplicateSlugs.length) {
    throw new Error(`Slugs duplicados: ${duplicateSlugs.map((item) => item.slug).join(", ")}`);
  }
  return departments;
}

async function normalizeImage(source: string, destination: string) {
  await execFileAsync("sips", [
    "-s",
    "format",
    "jpeg",
    "-s",
    "formatOptions",
    "82",
    "--resampleHeightWidthMax",
    "2000",
    source,
    "--out",
    destination,
  ]);
  const normalized = await stat(destination);
  if (!normalized.size || normalized.size > 6 * 1024 * 1024) {
    throw new Error(`Imagen normalizada fuera del límite esperado: ${source}`);
  }
}

async function main() {
  const departments = await inventory();
  const totalImages = departments.reduce(
    (total, department) => total + department.images.length,
    0,
  );
  console.log(`Inventario: ${departments.length} departamentos, ${totalImages} imágenes.`);
  for (const bedrooms of [1, 2, 3, 4]) {
    const subset = departments.filter((department) => department.bedrooms === bedrooms);
    console.log(`  ${bedrooms} dormitorio(s): ${subset.length} departamentos.`);
  }

  if (validateImages) {
    const validationRoot = await mkdtemp(path.join(tmpdir(), "rentamar-image-validation-"));
    try {
      let validated = 0;
      for (const department of departments) {
        const departmentRoot = path.join(validationRoot, department.slug);
        await mkdir(departmentRoot, { recursive: true });
        for (const [index, source] of department.images.entries()) {
          await normalizeImage(source, path.join(departmentRoot, `${index + 1}.jpg`));
          validated += 1;
        }
        console.log(`VALIDADO | ${department.name} | ${department.images.length} imágenes.`);
      }
      console.log(`Validación de archivos terminada: ${validated} imágenes compatibles.`);
    } finally {
      await rm(validationRoot, { recursive: true, force: true });
    }
  }

  if (!apply) {
    for (const department of departments) {
      console.log(
        `DRY RUN | ${department.name} | ${department.bedrooms} dormitorio(s) | ${department.images.length} imágenes | ${department.slug}`,
      );
    }
    console.log("Validación terminada. Usa --apply para escribir en Supabase.");
    return;
  }

  if (process.env.IMPORT_CONFIRM !== "25-departments") {
    throw new Error("Falta IMPORT_CONFIRM=25-departments para autorizar la escritura.");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Faltan credenciales Supabase en el entorno.");
  if (!url.includes(expectedProjectRef)) {
    throw new Error(`Proyecto incorrecto. Se esperaba ${expectedProjectRef}.`);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const tempRoot = await mkdtemp(path.join(tmpdir(), "rentamar-departments-"));
  let created = 0;
  let skipped = 0;
  let uploaded = 0;

  try {
    for (const department of departments) {
      const { data: existing, error: existingError } = await supabase
        .from("properties")
        .select("id,name,bedrooms,property_images(id)")
        .eq("slug", department.slug)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        const imageCount = existing.property_images?.length ?? 0;
        if (
          existing.name !== department.name ||
          existing.bedrooms !== department.bedrooms ||
          imageCount !== department.images.length
        ) {
          throw new Error(
            `Ya existe ${department.slug}, pero no coincide con el inventario (${imageCount}/${department.images.length} imágenes).`,
          );
        }
        skipped += 1;
        console.log(`OMITIDO | ${department.name} ya está completo.`);
        continue;
      }

      const { data: property, error: propertyError } = await supabase
        .from("properties")
        .insert({
          name: department.name,
          slug: department.slug,
          status: "draft",
          bedrooms: department.bedrooms,
          base_price_minor: 0,
          max_guests: 1,
          beds: 0,
          bathrooms: 0,
          minimum_nights: 1,
          featured: false,
          short_description: null,
          description: null,
          property_type: null,
          zone: null,
          rules: null,
          location_reference: null,
          duration_pricing_enabled: false,
        })
        .select("id")
        .single();
      if (propertyError) throw propertyError;

      const storagePaths: string[] = [];
      try {
        const propertyTemp = path.join(tempRoot, property.id);
        await mkdir(propertyTemp, { recursive: true });
        const rows: Array<{
          property_id: string;
          url: string;
          alt_text: null;
          sort_order: number;
          is_cover: boolean;
        }> = [];
        for (const [index, source] of department.images.entries()) {
          const order = String(index + 1).padStart(3, "0");
          const normalizedPath = path.join(propertyTemp, `${order}.jpg`);
          await normalizeImage(source, normalizedPath);
          const storagePath = `${property.id}/import-20260728-${order}.jpg`;
          const bytes = await readFile(normalizedPath);
          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(storagePath, bytes, {
              contentType: "image/jpeg",
              cacheControl: "31536000",
              upsert: false,
            });
          if (uploadError) throw uploadError;
          storagePaths.push(storagePath);
          const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
          rows.push({
            property_id: property.id,
            url: publicData.publicUrl,
            alt_text: null,
            sort_order: index,
            is_cover: index === 0,
          });
          uploaded += 1;
        }
        const { error: imageRowsError } = await supabase.from("property_images").insert(rows);
        if (imageRowsError) throw imageRowsError;
        created += 1;
        console.log(`CREADO | ${department.name} | ${department.images.length} imágenes.`);
      } catch (error) {
        if (storagePaths.length) await supabase.storage.from(bucket).remove(storagePaths);
        await supabase.from("properties").delete().eq("id", property.id);
        throw error;
      }
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }

  console.log(
    `Importación terminada: ${created} creados, ${skipped} omitidos, ${uploaded} imágenes subidas.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
