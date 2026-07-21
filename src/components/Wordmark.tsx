export default function Wordmark({
  className = "",
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  const main = tone === "dark" ? "text-night" : "text-cream";
  const accent = tone === "dark" ? "text-turquoise" : "text-turquoise-soft";

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true" className="shrink-0">
        <path
          d="M4 20c2.6-.5 3.6-2.6 6.2-2.6s3.6 2.1 6.2 2.1 3.6-2.1 6.2-2.1c1 0 1.6.2 2.2.5"
          fill="none"
          stroke="#2aa8b8"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M4 25c2.6-.5 3.6-2.6 6.2-2.6s3.6 2.1 6.2 2.1 3.6-2.1 6.2-2.1c1 0 1.6.2 2.2.5"
          fill="none"
          stroke="#d8c6a5"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.8"
        />
        <circle cx="16" cy="10" r="3" fill={tone === "dark" ? "#101820" : "#f6f4ef"} />
      </svg>
      <span className={`text-lg font-semibold tracking-tight ${main}`}>
        Renta<span className={accent}>Mar</span>
      </span>
    </span>
  );
}
