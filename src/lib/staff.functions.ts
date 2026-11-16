import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      email: z.string().email().max(255),
      full_name: z.string().min(1).max(120),
      phone: z.string().max(30).optional(),
      main_position_id: z.string().uuid().optional(),
      redirectTo: z.string().url(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: office } = await context.supabase.rpc("is_office");
    if (!office) throw new Error("Office only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.full_name },
      redirectTo: data.redirectTo,
    });
    if (error) throw new Error(error.message);
    const id = res.user.id;
    await supabaseAdmin.from("profiles").update({ full_name: data.full_name, phone: data.phone ?? null, main_position_id: data.main_position_id ?? null }).eq("id", id);
    return { id };
  });
