# Optional · Supabase sync (you + your friend)

The site works fully offline by default — everything's in `localStorage`. Add Supabase if you want shared progress across devices, or if you want you and your friend to each have your own progress.

## 1. Create the project

1. Go to https://supabase.com → New project (free tier is plenty).
2. Note the project URL and the **anon public** key (Settings → API).
3. In the SQL editor, run:

```sql
-- One row per attempted test, per user
create table attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  test_id     text not null,
  data        jsonb not null,           -- the full attempt object
  completed_at timestamptz,
  updated_at  timestamptz default now(),
  unique (user_id, test_id)
);
create index on attempts (user_id, updated_at desc);

-- Bookmarked questions
create table bookmarks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  test_id     text not null,
  q_num       int not null,
  created_at  timestamptz default now(),
  unique (user_id, test_id, q_num)
);

-- Row-Level Security: each user sees only their own data
alter table attempts  enable row level security;
alter table bookmarks enable row level security;

create policy "own attempts"  on attempts  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own bookmarks" on bookmarks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## 2. Enable email magic-link auth

Auth → Providers → Email → enable **magic link**. (No passwords to manage; you and your friend just enter your email and click the link.)

## 3. Wire it into the site

Create `site/js/supabase-config.js` with:

```js
window.SUPABASE_CONFIG = {
  url: 'https://YOUR-PROJECT.supabase.co',
  anonKey: 'eyJ...your-anon-key...',
};
```

Add to `index.html` BEFORE `js/app.js`:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/supabase-config.js"></script>
```

Then replace the `Storage` object in `js/storage.js` with a Supabase-backed one (see template below).

## 4. Storage shim (drop-in replacement)

```js
// js/storage.js — Supabase variant
(function () {
  const { url, anonKey } = window.SUPABASE_CONFIG;
  const sb = window.supabase.createClient(url, anonKey);

  // Cache to keep things responsive — write-through
  const cache = { attempts: {}, bookmarks: {}, history: [] };

  async function ensureSession() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      const email = prompt('Email for magic-link login:');
      await sb.auth.signInWithOtp({ email });
      alert('Check your email for the magic link.');
    }
  }
  ensureSession();
  // ... see README for full implementation
})();
```

Full snippet lives in `js/storage.supabase.js.example` (in the repo).

## 5. Restrict to two emails

In Supabase → Authentication → Settings, set **Site URL** to your GitHub Pages URL and add an **Allow-list** for just your two emails. That keeps strangers out even though the site is publicly viewable.

## Free-tier limits

- 500 MB database, 1 GB file storage, 50K monthly active users — way more than you'll need.
- The two of you generate maybe 100KB of attempt data over a year of practice.

## Or skip it

If you don't care about cross-device sync, don't bother — `localStorage` works fine for a single browser per user. The site notices when the URL is shared between two browsers and just keeps separate state.
