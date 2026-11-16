import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Me = {
  id: string;
  email: string | null;
  fullName: string;
  /** Office screens are shown (office user in office view). */
  isOffice: boolean;
  /** The account has office access, whatever the current view. */
  canOffice: boolean;
  view: AppView;
};

export type AppView = "office" | "staff";
const VIEW_KEY = "gig-agenda:view";
const listeners = new Set<() => void>();

export function getView(): AppView {
  if (typeof window === "undefined") return "office";
  return window.localStorage.getItem(VIEW_KEY) === "staff" ? "staff" : "office";
}

/** Office users can switch between the office and the staff (server) view. */
export function setView(v: AppView) {
  window.localStorage.setItem(VIEW_KEY, v);
  listeners.forEach((l) => l());
}

export function useView(): AppView {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getView,
    () => "office",
  );
}

export function useMe() {
  const view = useView();
  const q = useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Me | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("full_name,email").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      return {
        id: u.user.id,
        email: profile?.email ?? u.user.email ?? null,
        fullName: profile?.full_name || u.user.email || "",
        isOffice: !!roles?.some((r) => r.role === "office"),
        canOffice: !!roles?.some((r) => r.role === "office"),
        view: "office",
      };
    },
    staleTime: 60_000,
  });
  const me = q.data ? { ...q.data, view, isOffice: q.data.canOffice && view === "office" } : q.data;
  return { ...q, data: me } as typeof q;
}

export function usePositions() {
  return useQuery({
    queryKey: ["positions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("positions").select("*").order("sort");
      if (error) throw error;
      return data;
    },
  });
}
