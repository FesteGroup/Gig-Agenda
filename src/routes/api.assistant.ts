import { createFileRoute } from "@tanstack/react-router";
import { assistantEmail, assistantJson } from "@/lib/assistant-auth.server";
import { answerGigAgenda, isOfficeEmail } from "@/lib/assistant.server";

// Read-only Gig Agenda answers for the Calendar's AI assistant connector (Grok). Office accounts only.
export const Route = createFileRoute("/api/assistant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const email = await assistantEmail(request);
        if (!email) return assistantJson(401, { error: "sign-in not recognised" });
        const body = (await request.json().catch(() => ({}))) as { tool?: string; args?: Record<string, unknown> };
        try {
          if (!(await isOfficeEmail(email))) return assistantJson(403, { error: `${email} has no office access in Gig Agenda` });
          return assistantJson(200, await answerGigAgenda(String(body.tool ?? ""), body.args ?? {}));
        } catch (error) {
          return assistantJson(200, { error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
  },
});
