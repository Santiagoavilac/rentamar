"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Refresco liviano de la pantalla de ingresos: recepción registra a alguien en su propia
// máquina y administración lo ve aparecer sin apretar nada. Es router.refresh(), así que
// vuelve a correr el server component y no pierde el scroll ni lo tipeado en los filtros.
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
