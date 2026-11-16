import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Gig Agenda" }, { name: "description", content: "Your notifications." }, { property: "og:title", content: "Notifications — Gig Agenda" }, { property: "og:description", content: "Your notifications." }] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  useEffect(() => {
    if (data.some((n) => !n.read_at)) {
      const t = setTimeout(async () => {
        await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
        qc.invalidateQueries({ queryKey: ["unread"] });
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [data, qc]);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-bold">Notifications</h1>
      {data.length === 0 && <p className="text-muted-foreground">Nothing yet.</p>}
      <div className="divide-y rounded-xl border bg-card">
        {data.map((n) => (
          <a key={n.id} href={n.link ?? "/home"} className={cn("block p-4 hover:bg-secondary", !n.read_at && "bg-accent/15")}>
            <div className="flex justify-between gap-2">
              <span className="font-semibold">{n.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("en-GB", { timeZone: "Asia/Hong_Kong", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
          </a>
        ))}
      </div>
    </div>
  );
}
