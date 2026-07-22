/**
 * Carga (o recarga) la imagen base del mapa de Mar Adentro y crea/actualiza la fila
 * `maps` con slug `mar-adentro`.
 *
 * Usa la service role (bypassa RLS), igual que create-admin.mts. Convierte la imagen
 * a WebP y obtiene sus dimensiones con `sips` (nativo de macOS: sin dependencias npm
 * nuevas). Sube a `maps/mar-adentro/masterplan-v1.webp` en el bucket público `maps`
 * (URL pública única, compartible con la futura app Flutter) y hace upsert de la fila.
 * Es idempotente: re-ejecutarlo sobreescribe la imagen y refresca la fila.
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
const rawPath = process.env.MAP_IMAGE_PATH ?? join(homedir(), "Downloads", "Mapamaradentro.png");
const inputPath = rawPath.startsWith("~") ? join(homedir(), rawPath.slice(1)) : rawPath;

function fail(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

if (!url || !serviceKey) fail("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
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
function toWebp(src: string): string {
  const dir = mkdtempSync(join(tmpdir(), "rentamar-map-"));
  const out = join(dir, "masterplan-v1.webp");
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
  console.log(`Convirtiendo ${inputPath} a WebP…`);
  const webpPath = toWebp(inputPath);
  const { width, height } = dimensions(webpPath);
  console.log(`Dimensiones: ${width}×${height}px`);

  const storagePath = `${SLUG}/masterplan-v1.webp`;
  const bytes = readFileSync(webpPath);
  console.log(`Subiendo a maps/${storagePath}…`);
  const { error: uploadErr } = await supabase.storage
    .from("maps")
    .upload(storagePath, bytes, { contentType: "image/webp", upsert: true });
  if (uploadErr) fail(`No se pudo subir la imagen: ${uploadErr.message}`);

  const {
    data: { publicUrl },
  } = supabase.storage.from("maps").getPublicUrl(storagePath);

  const { error: upsertErr } = await supabase.from("maps").upsert(
    {
      slug: SLUG,
      name: MAP_NAME,
      image_url: publicUrl,
      image_width: width,
      image_height: height,
    },
    { onConflict: "slug" },
  );
  if (upsertErr) fail(`No se pudo crear/actualizar el mapa: ${upsertErr.message}`);

  console.log(`\n✔ Mapa "${SLUG}" listo.\n  Imagen: ${publicUrl}\n  Editor: /admin/mapa\n`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
