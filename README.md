# Gig Agenda

Gig Agenda is an application for organizing gig schedules.

The project information does not specify its features or capabilities. It is built with TanStack Start and TypeScript.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/80af0e68-88e1-5d9a-8d67-7af4fc3ed007).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```


## Expenses

Workers send expenses (taxi, meals, parking…) with a receipt photo from **Expenses**; the office approves, rejects or marks them paid and can download a CSV. The page needs this one-time database setup in Lovable:

Add worker expenses (e.g. taxi) to Gig Agenda. The screens already exist in src/routes/_authenticated/expenses.tsx; only the database part is needed. Do not change that page's layout.

1. Create table public.expenses:
   - id uuid primary key default gen_random_uuid()
   - user_id uuid not null references public.profiles(id) on delete cascade
   - event_id uuid null references public.events(id) on delete set null
   - day date not null
   - category text not null (Taxi, Meal, Parking, Transport, Supplies, Other)
   - amount numeric(10,2) not null check (amount > 0)
   - note text null
   - receipt_path text null
   - status text not null default 'submitted' check (status in ('submitted','approved','rejected','paid'))
   - office_note text null
   - reviewed_at timestamptz null
   - created_at timestamptz not null default now()
2. RLS on expenses:
   - Staff can insert rows where user_id = auth.uid() and status = 'submitted'.
   - Staff can select their own rows.
   - Office (public.is_office()) can select and update all rows.
   - Nobody can delete except office.
3. Create a private storage bucket "receipts" (images and PDFs, 10 MB max).
   - Staff can upload and read files in the folder named after their own user id (receipts/<auth.uid()>/...).
   - Office can read all files.
4. Allow office users to insert notifications for any user (used to tell a worker their expense was approved, paid or rejected), if not already allowed.
5. Regenerate the Supabase types.
