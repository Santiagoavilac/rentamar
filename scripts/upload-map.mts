/**
 * Carga una nueva imagen BORRADOR del mapa de Mar Adentro y crea/actualiza la fila
 * `maps` con slug `mar-adentro`. No modifica la imagen pública congelada.
 *
 * Usa la service role (bypassa RLS), igual que create-admin.mts. Convierte la imagen
 * a WebP y obtiene sus dimensiones con `sips` (nativo de macOS: sin dependencias npm
 * nuevas). Sube a `maps/mar-adentro/masterplan-v1.webp` en el bucket público `maps`
 * en una ruta versionada. La nueva versión solo se vuelve pública cuando el panel
 * copia image_* a published_image_* junto con el snapshot de marcadores.
 *
 * Las coordenadas de los marcadores son normalizadas, así que reemplazar la imagen
 * NO mueve ningún marcador ya colocado.
 *
 * Uso:
 *   npx tsx scripts/upload-map.mts
 *   MAP_IMAGE_PATH=/ruta/a/otra.png npx tsx scripts/upload-map.mts
 *
 * Requiere en el entorno: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SLUG = "mar-adentro";
const MAP_NAME = "Mar Adentro";
const EXPECTED_PROJECT_REF = "cxozsfrwyvncdfulkcbi";
const rawPath = process.env.MAP_IMAGE_PATH ?? join(homedir(), "Downloads", "mapa.png");
const inputPath = rawPath.startsWith("~") ? join(homedir(), rawPath.slice(1)) : rawPath;

function fail(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

if (!url || !serviceKey) fail("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
if (!url.includes(EXPECTED_PROJECT_REF)) {
  fail(`El SUPABASE_URL no corresponde al proyecto RentaMar (${EXPECTED_PROJECT_REF}).`);
}
if (!existsSync(inputPath)) fail(`No se encontró la imagen: ${inputPath}`);

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ¿Existe un binario en el PATH?
function has(bin: string): boolean {
  try {
    execFileSync("command", ["-v", bin], { shell: "/bin/bash", stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Convierte a WebP y devuelve la ruta temporal del WebP. Prefiere `cwebp` (webp-tools)
// porque `sips` en muchas versiones de macOS lee WebP pero no lo escribe. Ambos son
// binarios del sistema: sin dependencias npm nuevas.
function toWebp(src: string, version: number): string {
  const dir = mkdtempSync(join(tmpdir(), "rentamar-map-"));
  const out = join(dir, `masterplan-v${version}.webp`);
  if (has("cwebp")) {
    execFileSync("cwebp", ["-q", "82", src, "-o", out], { stdio: "ignore" });
    return out;
  }
  try {
    execFileSync("sips", ["-s", "format", "webp", src, "--out", out], { stdio: "ignore" });
    return out;
  } catch {
    fail(
      "No se pudo convertir a WebP: sips no lo soporta en este macOS y no se encontró cwebp.\n" +
        "  Instalá webp con: brew install webp",
    );
  }
}

// Lee ancho/alto en píxeles con sips.
function dimensions(file: string): { width: number; height: number } {
  const out = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file], {
    encoding: "utf8",
  });
  const width = Number(out.match(/pixelWidth:\s*(\d+)/)?.[1]);
  const height = Number(out.match(/pixelHeight:\s*(\d+)/)?.[1]);
  if (!width || !height) fail("No se pudieron leer las dimensiones con sips.");
  return { width, height };
}

async function main() {
  const { data: current, error: currentError } = await supabase
    .from("maps")
    .select("id, version")
    .eq("slug", SLUG)
    .maybeSingle();
  if (currentError) fail(`No se pudo consultar el mapa: ${currentError.message}`);
  const nextVersion = (current?.version ?? 0) + 1;

  console.log(`Convirtiendo ${inputPath} a WebP…`);
  const webpPath = toWebp(inputPath, nextVersion);
  const { width, height } = dimensions(webpPath);
  console.log(`Dimensiones: ${width}×${height}px`);

  const storagePath = `${SLUG}/masterplan-v${nextVersion}.webp`;
  const bytes = readFileSync(webpPath);
  console.log(`Subiendo a maps/${storagePath}…`);
  const { error: uploadErr } = await supabase.storage
    .from("maps")
    .upload(storagePath, bytes, { contentType: "image/webp", upsert: true });
  if (uploadErr) fail(`No se pudo subir la imagen: ${uploadErr.message}`);

  const {
    data: { publicUrl },
  } = supabase.storage.from("maps").getPublicUrl(storagePath);

  const draft = {
    name: MAP_NAME,
    image_url: publicUrl,
    image_width: width,
    image_height: height,
    version: nextVersion,
  };
  const writeResult = current
    ? await supabase.from("maps").update(draft).eq("id", current.id)
    : await supabase.from("maps").insert({ slug: SLUG, ...draft });
  if (writeResult.error) {
    await supabase.storage.from("maps").remove([storagePath]);
    fail(`No se pudo actualizar el borrador del mapa: ${writeResult.error.message}`);
  }

  console.log(
    `\n✔ Borrador "${SLUG}" actualizado a v${nextVersion}.\n` +
      `  Imagen: ${publicUrl}\n` +
      "  La imagen pública anterior no cambió.\n" +
      "  Editor: /admin/mapa\n",
  );
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
