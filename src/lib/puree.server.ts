// Server-only Puree API client. Tokens never leave the server.
const BASE = "https://puree.app/api/public/v1";

export type Account = "relish" | "gingers";
export const ACTIVE_STATES = ["accepted", "confirmed", "live", "processing"];
export const PENDING_STATES = ["pending", "quote", "draft", "quoted"];
export const HIDDEN_STATES = ["declined", "expired"];

export function tokenFor(account: Account): string | undefined {
  return account === "relish" ? process.env["PUREE_TOKEN_RELISH"] : process.env["PUREE_TOKEN_GINGERS"];
}

type PureeOrder = {
  id: number | string;
  display_reference?: string;
  state?: string;
  date?: string;
  event_start_time?: string | null;
  event_name?: string | null;
  pax_total?: number | null;
  customer?: { name?: string } | null;
  contact?: { name?: string } | null;
  links?: { order_url?: string } | null;
  address?: { label?: string; [k: string]: unknown } | null;
};

async function get(token: string, path: string) {
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Puree ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export async function listOrders(token: string, from: string, to: string): Promise<PureeOrder[]> {
  const out: PureeOrder[] = [];
  const perPage = 100;
  for (let page = 1; page <= 20; page++) {
    const json = await get(token, `/orders?date_from=${from}&date_to=${to}&page=${page}&per_page=${perPage}`);
    out.push(...((json.data ?? []) as PureeOrder[]));
    const total = Number(json.meta?.total ?? 0);
    if (page * perPage >= total) break; // Puree repeats the last page past the end
  }
  return out;
}

export async function getOrder(token: string, id: string | number): Promise<PureeOrder & { deliveries?: { delivery_time?: string }[] }> {
  const json = await get(token, `/orders/${id}`);
  return json.data ?? json;
}

export function toHkTime(v?: string | null): string | null {
  if (!v) return null;
  if (v.includes("T")) {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Hong_Kong", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  }
  const m = v.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

export function venueOf(o: PureeOrder): string | null {
  const a = o.address;
  if (!a) return null;
  if (a.label) return String(a.label);
  const parts = ["line_1", "address_1", "street", "district", "city"].map((k) => a[k]).filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export function mapOrder(o: PureeOrder, account: Account) {
  return {
    source: "puree" as const,
    account,
    puree_id: String(o.id),
    reference: o.display_reference ?? null,
    title: o.event_name || o.customer?.name || "Event",
    client_name: o.customer?.name ?? null,
    contact_name: o.contact?.name ?? null,
    day: (o.date ?? "").slice(0, 10),
    start_time: toHkTime(o.event_start_time),
    pax: o.pax_total ?? null,
    state: o.state ?? null,
    order_url: o.links?.order_url ?? null,
  };
}
