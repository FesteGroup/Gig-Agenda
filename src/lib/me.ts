import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Me = {
  id: string;
  email: string | null;
  fullName: string;
  isOffice: boolean;
};

export function useMe() {
  return useQuery({
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
      };
    },
    staleTime: 60_000,
  });
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
