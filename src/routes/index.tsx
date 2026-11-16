import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users, BellRing } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gig Agenda — Relish & Gingers staffing" },
      { name: "description", content: "Plan event staffing, collect availability and call out servers, chefs and bartenders." },
      { property: "og:title", content: "Gig Agenda — Relish & Gingers staffing" },
      { property: "og:description", content: "Plan event staffing, collect availability and call out servers, chefs and bartenders." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Relish · Gingers</p>
        <h1 className="mt-3 text-5xl font-bold leading-[1.05] text-foreground">Gig Agenda</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Every event, every shift, every person — from Puree order to a full team on the night.
        </p>
        <ul className="mt-8 space-y-3 text-foreground">
          <li className="flex gap-3"><CalendarDays className="h-5 w-5 text-primary" /> Live event calendar from Puree</li>
          <li className="flex gap-3"><Users className="h-5 w-5 text-primary" /> Availability from the whole team</li>
          <li className="flex gap-3"><BellRing className="h-5 w-5 text-primary" /> Call-outs answered from the phone</li>
        </ul>
        <Button asChild size="lg" className="mt-10 w-full sm:w-auto">
          <Link to="/auth">Sign in</Link>
        </Button>
      </div>
    </main>
  );
}
