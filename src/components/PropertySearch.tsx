import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getPropertyTypes } from "@/lib/queries";
import SearchBar, { type SearchDefaults } from "./SearchBar";

// Envoltorio de servidor: arma las opciones reales de "Tipo" y se las pasa al buscador.
export default async function PropertySearch({ defaults }: { defaults?: SearchDefaults }) {
  return <SearchBar types={await loadTypes()} defaults={defaults} />;
}

async function loadTypes(): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  try {
    return await getPropertyTypes();
  } catch (error) {
    console.error("[PropertySearch] no se pudieron cargar los tipos:", error);
    return [];
  }
}
