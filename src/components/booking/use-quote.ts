"use client";

import { useEffect, useState } from "react";

// Cotización del servidor con debounce y cancelación. El cliente nunca calcula montos: el
// precio sale siempre de la RPC, así que esto solo pregunta y muestra.
//
// El debounce evita una consulta por cada clic mientras se arrastra el rango, y el
// AbortController evita que una respuesta vieja pise a una nueva.

const DEBOUNCE_MS = 250;

export function useQuote<T>(params: {
  endpoint: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  /** Si es false no se consulta nada y se limpia la cotización previa. */
  enabled: boolean;
}) {
  const { endpoint, propertyId, checkIn, checkOut, guestCount, enabled } = params;
  const [quote, setQuote] = useState<T | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setQuote(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setQuoting(true);
      setError(null);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ propertyId, checkIn, checkOut, guestCount }),
          signal: controller.signal,
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message ?? "No se pudo calcular el precio");
        setQuote(body as T);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setQuote(null);
        setError(
          requestError instanceof Error ? requestError.message : "No se pudo calcular el precio",
        );
      } finally {
        if (!controller.signal.aborted) setQuoting(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [endpoint, propertyId, checkIn, checkOut, guestCount, enabled]);

  return { quote, quoting, quoteError: error };
}
