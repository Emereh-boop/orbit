# ORBIT — Full-Stack AI Resource Hub
## Express + Supabase backend · Deploy to Render · Host frontend on Netlify/Vercel

---

## Project Structure

```
orbit/
├── backend/
│   ├── server.js              ← Express entry point
│   ├── package.json
│   ├── .env.example           ← copy to .env and fill in
│   ├── supabase/
│   │   ├── client.js          ← Supabase admin client
│   │   └── schema.sql         ← Run this in Supabase SQL editor
│   ├── middleware/
│   │   └── auth.js            ← JWT auth + admin role check
│   └── routes/
│       ├── tools.js           ← CRUD for tools
│       ├── submissions.js     ← Community tool submissions
│       └── changelog.js       ← Weekly changelog entries
└── frontend/
    └── index.html             ← Single-file frontend (pure HTML/CSS/JS)
```

---

## Step 1 — Set up Supabase (5 min)

1. Go to [supabase.com](https://supabase.com) → New Project
2. Once created, go to **SQL Editor** and paste the entire contents of `backend/supabase/schema.sql` → **Run**
3. Go to **Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** (secret) → `SUPABASE_SERVICE_ROLE_KEY`
   - **anon/public key** → needed in `frontend/index.html`

---

## Step 2 — Run the backend locally

```bash
cd backend
cp .env.example .env
# Fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
npm install
npm run dev
# → running on http://localhost:4000
```

Test it:
```bash
curl http://localhost:4000/health
curl http://localhost:4000/api/tools
curl http://localhost:4000/api/changelog
```

---

## Step 3 — Update the frontend config

Open `frontend/index.html` and find the CONFIG block near the bottom:

```js
const API_BASE       = 'http://localhost:4000/api'; // → change to your Render URL in prod
const SUPABASE_URL   = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
```

Replace with your real values. The anon key is safe to put in frontend code.

---

## Step 4 — Deploy backend to Render (free tier)

1. Push your `backend/` folder to a GitHub repo
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your repo, set:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
4. Under **Environment Variables**, add:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-key
   FRONTEND_URL=https://your-frontend.netlify.app
   NODE_ENV=production
   ```
5. Deploy → Render gives you a URL like `https://orbit-api.onrender.com`
6. Update `API_BASE` in `frontend/index.html` to that URL

---

## Step 5 — Deploy frontend to Netlify (free)

1. Drag and drop your `frontend/` folder to [netlify.com/drop](https://app.netlify.com/drop)
   — OR —
   Push to GitHub and connect the repo in Netlify

That's it. Your site is live.

---

## Making yourself admin

After signing up through the UI, go to **Supabase Dashboard → Authentication → Users**, find your user, click it, and under **User Metadata** add:

```json
{ "role": "admin" }
```

Now when you sign in, you'll see the **Admin ⚙** tab with the pending submissions queue.

---

## API Reference

### Tools
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/tools` | Public | List published tools. Supports `?category=writing&q=notion` |
| GET | `/api/tools/:id` | Public | Single tool |
| POST | `/api/tools` | Admin | Create tool |
| PATCH | `/api/tools/:id` | Admin | Update tool |
| DELETE | `/api/tools/:id` | Admin | Soft-archive tool |

### Submissions
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/submissions` | Public | Submit a tool for review |
| GET | `/api/submissions` | Admin | List pending submissions |
| PATCH | `/api/submissions/:id` | Admin | Approve or reject |

### Changelog
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/changelog` | Public | Latest entries. Supports `?limit=10` |
| POST | `/api/changelog` | Admin | Publish weekly update |
| PATCH | `/api/changelog/:id` | Admin | Edit entry |
| DELETE | `/api/changelog/:id` | Admin | Delete entry |

---

## Adding affiliate links

When creating or editing a tool via the API, set `affiliate_url` to your referral link:

```bash
curl -X PATCH https://orbit-api.onrender.com/api/tools/<id> \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"affiliate_url": "https://elevenlabs.io?ref=orbit"}'
```

Cards with an affiliate URL will show an `aff` badge and the modal will display a dedicated "Affiliate Link ↗" button.

---

## Publishing a weekly changelog

```bash
curl -X POST https://orbit-api.onrender.com/api/changelog \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "week_of": "2026-05-26",
    "title": "Week of May 26 — 4 new tools",
    "summary": "This week we added tools for video, design, and automation.",
    "added": ["Runway ML", "Canva AI", "Make.com"],
    "updated": ["Perplexity"],
    "removed": []
  }'
```

---

## Tech Stack

| Layer | Tech | Cost |
|-------|------|------|
| Database + Auth | Supabase | Free (500MB, 50K MAU) |
| Backend API | Node.js + Express | — |
| Backend Host | Render | Free tier (spins down after inactivity) |
| Frontend Host | Netlify / Vercel | Free |
| **Total** | | **$0/month** |

For production with no cold starts, upgrade Render to the $7/mo Starter plan.
