// Initials on a colour picked from the name, so everyone has their own.
const COLOURS = [
  "bg-coral text-white", "bg-sky text-white", "bg-violet text-white", "bg-sun text-amber-950",
  "bg-rose text-white", "bg-teal text-white", "bg-primary text-primary-foreground",
];

function colourFor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLOURS[h % COLOURS.length];
}

export function Avatar({ name, url, size = 36 }: { name: string; url?: string | null; size?: number }) {
  return url ? (
    <img src={url} alt="" className="shrink-0 rounded-full object-cover ring-2 ring-white" style={{ width: size, height: size }} />
  ) : (
    <div className={`flex shrink-0 items-center justify-center rounded-full text-xs font-bold ring-2 ring-white ${colourFor(name || "?")}`} style={{ width: size, height: size }}>
      {(name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
    </div>
  );
}
