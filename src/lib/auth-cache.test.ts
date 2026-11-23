import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { refreshAuthCache } from "./auth-cache";

describe("account switching", () => {
  it("removes the office account's roles and private data when a server signs in", async () => {
    const client = new QueryClient();
    client.setQueryData(["me"], { id: "office-user", isOffice: true, canOffice: true });
    client.setQueryData(["position-rates"], [{ hourly_cost: 190 }]);

    expect(refreshAuthCache(client, "SIGNED_IN")).toBe(true);
    expect(client.getQueryData(["me"])).toBeUndefined();
    expect(client.getQueryData(["position-rates"])).toBeUndefined();

    const server = await client.fetchQuery({
      queryKey: ["me"],
      queryFn: async () => ({ id: "server-user", isOffice: false, canOffice: false }),
    });
    expect(server.id).toBe("server-user");
    expect(server.isOffice).toBe(false);
    expect(server.canOffice).toBe(false);
    client.clear();
  });

  it("cancels old office requests so they cannot restore office access after switching", async () => {
    const client = new QueryClient();
    let resolveOffice: ((value: { isOffice: boolean }) => void) | undefined;
    const pending = client.fetchQuery({
      queryKey: ["me"],
      queryFn: () => new Promise<{ isOffice: boolean }>((resolve) => { resolveOffice = resolve; }),
    }).catch(() => null);

    refreshAuthCache(client, "SIGNED_IN");
    if (!resolveOffice) throw new Error("Office request was not started");
    resolveOffice({ isOffice: true });
    await pending;
    expect(client.getQueryData(["me"])).toBeUndefined();
    client.clear();
  });

  it("clears private data on sign-out", () => {
    const client = new QueryClient();
    client.setQueryData(["me"], { isOffice: true });
    expect(refreshAuthCache(client, "SIGNED_OUT")).toBe(true);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it("keeps the current account's data during token refresh", () => {
    const client = new QueryClient();
    client.setQueryData(["me"], { id: "server-user", isOffice: false });
    expect(refreshAuthCache(client, "TOKEN_REFRESHED")).toBe(false);
    expect(client.getQueryData(["me"])).toEqual({ id: "server-user", isOffice: false });
    client.clear();
  });
});