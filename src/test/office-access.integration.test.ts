// @vitest-environment node
// Read-only checks against the managed database; no account impersonation required.
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function query(sql: string): Record<string, unknown>[] {
  const output = execFileSync("lovable", ["supabase", "query", sql, "--json"], { encoding: "utf8" });
  const result = JSON.parse(output) as { rows: Record<string, unknown>[] };
  return result.rows;
}

describe("company office access", () => {
  it("allows @gingers.com.hk accounts", () => {
    expect(query("select public.office_signup_allowed('office@gingers.com.hk', false) as allowed")[0]?.["allowed"]).toBe(true);
  });

  it("does not grant office access to Gingers lookalike or staff subdomains", () => {
    const rows = query("select email, public.office_signup_allowed(email, false) as allowed from unnest(array['server@staff.gingers.com.hk', 'server@gingers.com.hk.evil.example', 'server@notgingers.com.hk']) as email");
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row["allowed"]).toBe(false);
  });

  it("allows @relish.com accounts", () => {
    expect(query("select public.office_signup_allowed('office@relish.com', false) as allowed")[0]?.["allowed"]).toBe(true);
  });

  it("allows @relish.com.hk accounts", () => {
    expect(query("select public.office_signup_allowed('office@relish.com.hk', false) as allowed")[0]?.["allowed"]).toBe(true);
  });

  it("preserves @feste-group.com office access", () => {
    expect(query("select public.office_signup_allowed('office@feste-group.com', false) as allowed")[0]?.["allowed"]).toBe(true);
  });

  it("does not grant office access to staff or lookalike domains", () => {
    const rows = query("select email, public.office_signup_allowed(email, false) as allowed from unnest(array['server@staff.relish.com.hk', 'server@gmail.com', 'server@relish.com.evil.example', 'server@notrelish.com']) as email");
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(row["allowed"]).toBe(false);
  });

  it("keeps Bianca's explicitly requested office access", () => {
    const rows = query("select r.role from public.user_roles r join public.profiles p on p.id = r.user_id where p.email = 'bianca@relish.com.hk' order by r.role");
    expect(rows.map((row) => row["role"])).toContain("office");
    expect(rows.map((row) => row["role"])).toContain("staff");
  });
});