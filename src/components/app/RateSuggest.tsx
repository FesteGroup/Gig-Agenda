import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const STEP = 10;

/** Lets a worker suggest a higher or lower hourly rate (in HK$10 steps); the office gets a notification. */
export function RateSuggest({ userId, name, positionId }: { userId: string; name: string; positionId: string | null }) {
  const { data: current = null } = useQuery({
    queryKey: ["my-rate", positionId],
    enabled: !!positionId,
    queryFn: async () => (await supabase.rpc("my_rate", { _position: positionId! })).data ?? null,
  });
  const [value, setValue] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (current != null) setValue(Number(current)); }, [current]);
  if (!positionId || current == null || value == null) return null;
  const now = Number(current);
  const diff = value - now;

  async function send() {
    setBusy(true);
    const { error } = await supabase.rpc("notify_office", {
      _title: `Rate suggestion: ${name} asks HK$${value}/h`,
      _body: `Now HK$${now}/h (${diff > 0 ? "+" : ""}HK$${diff}). Change it on the Rates page or in the profile.`,
      _link: `/staff/${userId}`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Suggestion sent to the office");
  }

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-sm font-semibold">My hourly rate</div>
      <p className="text-xs text-muted-foreground">Now HK${now}/h. Use the arrows to suggest a new rate to the office.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant="outline" onClick={() => setValue((v) => Math.max(0, (v ?? now) - STEP))} aria-label="HK$10 less"><ChevronDown className="h-4 w-4" /></Button>
          <span className="w-24 text-center font-display text-xl font-bold tabular-nums">HK${value}</span>
          <Button type="button" size="icon" variant="outline" onClick={() => setValue((v) => (v ?? now) + STEP)} aria-label="HK$10 more"><ChevronUp className="h-4 w-4" /></Button>
        </div>
        {diff !== 0 && <span className="text-xs text-muted-foreground">{diff > 0 ? "+" : "−"}HK${Math.abs(diff)}</span>}
        <Button type="button" className="ml-auto" disabled={busy || diff === 0} onClick={send}>{busy ? "Sending…" : "Suggest this rate"}</Button>
      </div>
    </div>
  );
}
