// Server-only: checks a sign-in from the Calendar's AI assistant connector (Grok).
// The Calendar issued the token; it confirms which approved account it belongs to.
const ALLOWED_DOMAINS = ["feste-group.com", "relish.com.hk"];
const ALLOWED_EMAILS = ["francesco.lagorio01@icatt.it"];

const calendarUrl = () =>
  (process.env["CALENDAR_APP_URL"] || "https://calendar-billboard.lovable.app").replace(/\/+$/, "");

const seen = new Map<string, { email: string; until: number }>();

export async function assistantEmail(request: Request): Promise<string | null> {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const hit = seen.get(token);
  if (hit && hit.until > Date.now()) return hit.email;
  const res = await fetch(`${calendarUrl()}/oauth/introspect`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { active?: boolean; email?: string; exp?: number };
  const email = (body.email ?? "").trim().toLowerCase();
  if (!body.active || !email) return null;
  const domain = email.split("@")[1] ?? "";
  if (!ALLOWED_DOMAINS.includes(domain) && !ALLOWED_EMAILS.includes(email)) return null;
  if (seen.size > 200) seen.clear();
  seen.set(token, { email, until: Math.min(Date.now() + 5 * 60_000, (body.exp ?? 0) * 1000) });
  return email;
}

export function assistantJson(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
