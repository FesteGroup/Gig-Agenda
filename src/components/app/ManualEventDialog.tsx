import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ManualEventDialog({ open, onOpenChange, defaultDay }: { open: boolean; onOpenChange: (o: boolean) => void; defaultDay: string }) {
  const navigate = useNavigate();
  const [f, setF] = useState({ title: "", client_name: "", day: defaultDay, start_time: "18:00", end_time: "", venue: "", pax: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase
      .from("events")
      .insert({ source: "manual", title: f.title, client_name: f.client_name || null, day: f.day, start_time: f.start_time || null, end_time: f.end_time || null, venue: f.venue || null, pax: f.pax ? Number(f.pax) : null, state: "confirmed" })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    onOpenChange(false);
    navigate({ to: "/events/$id", params: { id: data.id } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add an event not in Puree</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-3">
          <div className="grid gap-1.5"><Label>Event name</Label><Input value={f.title} onChange={set("title")} required /></div>
          <div className="grid gap-1.5"><Label>Client</Label><Input value={f.client_name} onChange={set("client_name")} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div className="grid gap-1.5"><Label>Date</Label><Input type="date" value={f.day} onChange={set("day")} required /></div>
            <div className="grid gap-1.5"><Label>Start</Label><Input type="time" value={f.start_time} onChange={set("start_time")} /></div>
            <div className="grid gap-1.5"><Label>End</Label><Input type="time" value={f.end_time} onChange={set("end_time")} /></div>
          </div>
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <div className="grid gap-1.5"><Label>Venue</Label><Input value={f.venue} onChange={set("venue")} /></div>
            <div className="grid gap-1.5"><Label>Guests</Label><Input type="number" value={f.pax} onChange={set("pax")} /></div>
          </div>
          <DialogFooter><Button type="submit">Create event</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
