import { ImageResponse } from "next/og";

export const alt = "RentaMar | Alojamientos en Mar Adentro";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px",
        background: "linear-gradient(135deg, #0b141a 0%, #101820 55%, #0e2b30 100%)",
        color: "#f6f4ef",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <svg width="52" height="52" viewBox="0 0 32 32">
          <path
            d="M4 20c2.6-.5 3.6-2.6 6.2-2.6s3.6 2.1 6.2 2.1 3.6-2.1 6.2-2.1c1 0 1.6.2 2.2.5"
            fill="none"
            stroke="#2aa8b8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M4 25c2.6-.5 3.6-2.6 6.2-2.6s3.6 2.1 6.2 2.1 3.6-2.1 6.2-2.1c1 0 1.6.2 2.2.5"
            fill="none"
            stroke="#d8c6a5"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="16" cy="10" r="3.4" fill="#f6f4ef" />
        </svg>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em" }}>
          <span>Renta</span>
          <span style={{ color: "#3fbccb" }}>Mar</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div
          style={{
            fontSize: 22,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "#3fbccb",
          }}
        >
          Estadías en Mar Adentro
        </div>
        <div
          style={{
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            maxWidth: "900px",
          }}
        >
          Tu próxima estadía comienza frente al agua
        </div>
        <div style={{ fontSize: 28, color: "rgba(246,244,239,0.72)", maxWidth: "820px" }}>
          Departamentos y casas para disfrutar Mar Adentro, Santa Cruz.
        </div>
      </div>
    </div>,
    { ...size },
  );
}
