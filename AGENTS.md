<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- The root auth subscriber cancels and clears private query caches before refreshing routes on sign-in/sign-out, so a new account cannot inherit the previous account's roles or dashboard.
- Roles live in `user_roles` (office/staff); never on profiles. Sensitive data (position_rates, staff_notes) are separate office-only tables so RLS, not UI, hides them.
- Staff reply to invitations only via the `respond_invitation` RPC, which enforces slot limits and notifies office.
- Puree is called only from server functions (`src/lib/puree.functions.ts`); events are cached in `events` keyed by (account, puree_id).
- Cost/overtime and availability rules live in pure functions in `src/lib/costs.ts` and `src/lib/availability.ts` with tests beside them.
- Profile photos are stored as small data URLs because public storage buckets are blocked in this workspace.
- Expenses use database-enforced ownership and office-only review; receipt files use a private bucket with user-ID folders so access is enforced independently of page views.
