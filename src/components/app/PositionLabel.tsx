import { isGingersPosition, shortPositionName } from "@/lib/gingers";

/** Position name with its colour dot; Gingers positions are followed by the word "Gingers". */
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
      <span>{g ? shortPositionName(name) : name}</span>
      {g && <span className="text-xs font-normal text-muted-foreground">Gingers</span>}
    </span>
  );
}
