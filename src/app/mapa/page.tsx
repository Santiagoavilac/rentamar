import { redirect } from "next/navigation";

// El mapa ahora vive embebido en el landing (sección #mapa, debajo de las
// propiedades). Mantenemos la ruta antigua como redirección para no romper enlaces.
export default function MapaPage() {
  redirect("/#mapa");
}
