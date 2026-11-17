// @vitest-environment node
// Run explicitly with a managed office session and backend environment present.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const session = JSON.parse(readFileSync(`${process.env['HOME']}/.cache/lovable-auth/session.json`, "utf8")).session;
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error("Expense integration tests require backend credentials");
  return value;
}
const base = requiredEnv('SUPABASE_URL');
const key = requiredEnv('SUPABASE_PUBLISHABLE_KEY');
const adminKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

async function request(path: string, method = "GET", body?: unknown, token = session.access_token) {
  return fetch(`${base}${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const expense = { user_id: session.user.id, day: "2026-11-17", category: "Taxi", amount: 42.5, note: "Automated expense permission check" };

describe("Expense database rules", () => {
  it("rejects zero and negative amounts", async () => {
    for (const amount of [0, -1]) {
      const response = await request("/rest/v1/expenses", "POST", { ...expense, amount });
      expect(response.ok).toBe(false);
      expect((await response.json()).code).toBe("23514");
    }
  });

  it("accepts only Taxi, Meal, Parking, Transport, Supplies and Other", async () => {
    const response = await request("/rest/v1/expenses", "POST", { ...expense, category: "Invalid" });
    expect(response.ok).toBe(false);
    expect((await response.json()).code).toBe("23514");
  });

  it("defaults to submitted and lets office approve, reject, pay and delete", async () => {
    const response = await request("/rest/v1/expenses", "POST", expense);
    expect(response.ok).toBe(true);
    const [row] = await response.json();
    try {
      expect(row.status).toBe("submitted");
      expect(Number(row.amount)).toBe(42.5);
      for (const status of ["approved", "rejected", "paid"]) {
        const review = await request(`/rest/v1/expenses?id=eq.${row.id}`, "PATCH", { status });
        expect(review.ok).toBe(true);
        expect((await review.json())[0].status).toBe(status);
      }
      const invalid = await request(`/rest/v1/expenses?id=eq.${row.id}`, "PATCH", { status: "invalid" });
      expect(invalid.ok).toBe(false);
    } finally {
      const cleanup = await request(`/rest/v1/expenses?id=eq.${row.id}`, "DELETE");
      expect(cleanup.ok).toBe(true);
    }
  });

  it("does not expose expense data to signed-out visitors", async () => {
    const response = await fetch(`${base}/rest/v1/expenses?select=id`, { headers: { apikey: key } });
    if (response.ok) expect(await response.json()).toEqual([]);
    else expect([401, 403]).toContain(response.status);
  });

  it("stores receipts privately with a 10 MB limit and image/PDF types", async () => {
    const response = await fetch(`${base}/storage/v1/bucket/receipts`, { headers: { apikey: adminKey, Authorization: `Bearer ${adminKey}` } });
    expect(response.ok).toBe(true);
    const bucket = await response.json();
    expect(bucket.public).toBe(false);
    expect(bucket.file_size_limit).toBe(10485760);
    expect(bucket.allowed_mime_types).toEqual(["image/*", "application/pdf"]);
  });
});