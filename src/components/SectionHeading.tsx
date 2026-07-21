import type { ReactNode } from "react";

export default function SectionHeading({
  eyebrow,
  title,
  text,
  align = "left",
}: {
  eyebrow?: string;
  title: ReactNode;
  text?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={`flex flex-col gap-4 ${align === "center" ? "items-center text-center" : ""}`}>
      {eyebrow ? <span className="eyebrow text-turquoise">{eyebrow}</span> : null}
      <h2 className="text-balance text-3xl font-semibold tracking-tight text-night sm:text-4xl">
        {title}
      </h2>
      {text ? <p className="max-w-2xl text-pretty text-night/65">{text}</p> : null}
    </div>
  );
}
