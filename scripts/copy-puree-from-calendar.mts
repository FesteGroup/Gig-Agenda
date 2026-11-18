// Refreshes src/lib/puree-copy.server.ts from the Calendar app's Puree copy (event-invoice-link repo).
// Usage: npx tsx scripts/copy-puree-from-calendar.mts /path/to/event-invoice-link
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
const calendar = resolve(process.argv[2] ?? "../event-invoice-link");
const { PUREE_ORDERS, PUREE_SNAPSHOT_AT } = await import(resolve(calendar, "src/lib/puree-orders.server.ts"));
const rows = (PUREE_ORDERS as any[]).map((o) => ({
  account: String(o.account).toLowerCase(),
  puree_id: String(o.id),
  reference: o.ref ?? null,
  title: o.eventName || o.customer || "Event",
  client_name: o.customer ?? null,
  contact_name: o.contact ?? null,
  day: o.date,
  start_time: o.start ?? null,
  pax: o.pax ?? null,
  state: o.state ?? null,
  order_url: o.url ?? null,
})).filter((r) => r.day).sort((a, b) => a.day.localeCompare(b.day));
writeFileSync(resolve(import.meta.dirname, "../src/lib/puree-copy.server.ts"), `// Copy of the Relish and Gingers Puree orders from the Calendar app (all states), copied ${PUREE_SNAPSHOT_AT}.
// Server-only. Used by syncPuree when Puree can't be read live (no token / Calendar link). Refreshed daily
// with scripts/copy-puree-from-calendar.mts.
export const PUREE_COPY_AT = "${PUREE_SNAPSHOT_AT}";

export interface PureeCopyRow { account: "relish" | "gingers"; puree_id: string; reference: string | null; title: string; client_name: string | null; contact_name: string | null; day: string; start_time: string | null; pax: number | null; state: string | null; order_url: string | null }

export const PUREE_COPY: PureeCopyRow[] = ${JSON.stringify(rows, null, 1)};
`);
console.log(rows.length, "orders copied", PUREE_SNAPSHOT_AT);
