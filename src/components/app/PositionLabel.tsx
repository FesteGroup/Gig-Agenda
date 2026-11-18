import { isGingersPosition, shortPositionName, GINGERS_COLOR } from "@/lib/gingers";

/** Position name with its colour dot; Gingers positions also get a gold "Gingers" badge. */
export function PositionLabel({
  name,
  color,
  className,
}: {
  name: string | null | undefined;
  color?: string | null | undefined;
  className?: string | undefined;
}) {
  const g = isGingersPosition(name);
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: color ?? "#888" }}
      />
      {g && (
        <span
          className="rounded px-1 py-px text-[10px] font-bold uppercase tracking-wide text-white"
          style={{ background: GINGERS_COLOR }}
        >
          Gingers
        </span>
      )}
      <span>{g ? shortPositionName(name) : name}</span>
    </span>
  );
}
