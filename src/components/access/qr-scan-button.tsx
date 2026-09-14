"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Atajo para no tener que tipear nombre o carnet: escanea el QR que administración le
// muestra al huésped al aprobarlo. No todos los teléfonos de portería van a tener cámara
// compatible con BarcodeDetector, así que hay un segundo camino (pegar el código a mano)
// y la búsqueda de siempre sigue ahí sin tocarse.

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
  }
}

function goToToken(router: ReturnType<typeof useRouter>, token: string) {
  const trimmed = token.trim();
  if (!trimmed) return;
  router.push(`/guardias?qr=${encodeURIComponent(trimmed)}`);
}

function CameraScanner({ onDetected, onError }: { onDetected: (value: string) => void; onError: (message: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;
    let stream: MediaStream | null = null;
    let frameId: number;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const Detector = window.BarcodeDetector;
        if (!Detector) return; // no debería pasar: el padre ya lo comprobó antes de montar esto.
        const detector = new Detector({ formats: ["qr_code"] });

        const tick = async () => {
          if (stoppedRef.current || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              stoppedRef.current = true;
              onDetected(codes[0].rawValue);
              return;
            }
          } catch {
            // Un frame ilegible no es un error real: se sigue intentando con el próximo.
          }
          frameId = requestAnimationFrame(tick);
        };
        frameId = requestAnimationFrame(tick);
      } catch {
        onError("No se pudo abrir la cámara. Probá pegando el código a mano.");
      }
    }

    start();

    return () => {
      stoppedRef.current = true;
      if (frameId) cancelAnimationFrame(frameId);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onDetected, onError]);

  return (
    <video
      ref={videoRef}
      muted
      playsInline
      className="aspect-square w-full max-w-xs rounded-xl border border-slate-300 bg-black object-cover"
    />
  );
}

function ManualTokenForm({ onSubmit }: { onSubmit: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
      }}
      className="flex gap-2"
    >
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Pegá el código del QR"
        aria-label="Código del QR"
        className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5"
      />
      <button className="rounded-xl bg-deep px-4 py-2.5 font-semibold text-cream">Ir</button>
    </form>
  );
}

export function QrScanButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [supportsCamera, setSupportsCamera] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupportsCamera(typeof window !== "undefined" && "BarcodeDetector" in window);
  }, []);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold"
      >
        Escanear QR
      </button>
    );
  }

  return (
    <div className="mb-5 rounded-2xl border border-slate-300 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Escanear QR</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-slate-600 underline"
        >
          Cancelar
        </button>
      </div>

      {supportsCamera ? (
        <CameraScanner onDetected={(value) => goToToken(router, value)} onError={setError} />
      ) : (
        <p className="mb-2 text-sm text-slate-600">
          Este teléfono no puede leer el QR con la cámara. Pedile al huésped el código de abajo del
          QR y pegalo acá.
        </p>
      )}

      <div className="mt-3">
        <ManualTokenForm onSubmit={(value) => goToToken(router, value)} />
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
