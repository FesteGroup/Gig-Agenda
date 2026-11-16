export function Avatar({ name, url, size = 36 }: { name: string; url?: string | null; size?: number }) {
  return url ? (
    <img src={url} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="flex shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold" style={{ width: size, height: size }}>
      {(name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
    </div>
  );
}
