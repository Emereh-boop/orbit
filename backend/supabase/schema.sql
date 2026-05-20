-- ═══════════════════════════════════════════════════════════
--  ORBIT — Supabase Schema
--  Run this entire file in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ── 1. TOOLS ─────────────────────────────────────────────────────
create table if not exists public.tools (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  icon         text not null default '🔧',
  category     text not null check (category in ('writing','image','code','audio','research','productivity','other')),
  pricing      text not null default 'freemium' check (pricing in ('free','freemium','paid','open')),
  description  text,
  url          text not null,
  affiliate_url text,               -- your affiliate/referral link (optional)
  tags         text[] default '{}',
  accent_color text default '#7b5cf0',
  is_new       boolean default true,
  status       text default 'published' check (status in ('published','draft','archived')),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ── 2. SUBMISSIONS ────────────────────────────────────────────────
create table if not exists public.submissions (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  url             text not null,
  category        text default 'other',
  pricing         text default 'freemium',
  description     text,
  submitter_email text,
  status          text default 'pending' check (status in ('pending','approved','rejected')),
  created_at      timestamptz default now()
);

-- ── 3. CHANGELOG ─────────────────────────────────────────────────
create table if not exists public.changelog (
  id        uuid primary key default gen_random_uuid(),
  week_of   date not null unique,   -- e.g. 2026-05-19
  title     text not null,          -- e.g. "Week of May 19 — 3 new tools"
  summary   text,
  added     text[] default '{}',    -- tool names added
  updated   text[] default '{}',    -- tool names updated
  removed   text[] default '{}',    -- tool names removed
  created_at timestamptz default now()
);

-- ── 4. ROW LEVEL SECURITY ─────────────────────────────────────────
--  Public read on tools & changelog; submissions write-only for anon

alter table public.tools       enable row level security;
alter table public.submissions enable row level security;
alter table public.changelog   enable row level security;

-- Tools: anyone can read published tools
create policy "Public read tools"
  on public.tools for select
  using (status = 'published');

-- Changelog: anyone can read
create policy "Public read changelog"
  on public.changelog for select
  using (true);

-- Submissions: anyone can insert (submit), no read for anon
create policy "Public insert submissions"
  on public.submissions for insert
  with check (true);

-- Note: All admin writes go through the backend using the
-- SERVICE ROLE key, which bypasses RLS entirely. ✓

-- ── 5. SEED DATA (optional — remove in production) ───────────────
insert into public.tools
  (name, icon, category, pricing, description, url, tags, accent_color, is_new)
values
  ('ChatGPT',    '✍️', 'writing',     'freemium', 'OpenAI''s flagship conversational AI. Write, edit, brainstorm, and summarize with GPT-4o. The freemium tier is generous for everyday writing tasks.',       'https://chat.openai.com',        array['LLM','Chat','GPT-4o','Summarize'],                '#7b5cf0', false),
  ('Claude',     '🧠', 'writing',     'freemium', 'Anthropic''s AI assistant known for nuanced writing, long-document analysis, and following complex instructions.',                                           'https://claude.ai',              array['LLM','Long Context','Analysis'],                  '#c8f542', false),
  ('Notion AI',  '✨', 'writing',     'freemium', 'AI writing built directly into Notion. Ideal for summarizing notes, drafting docs, and auto-filling databases.',                                             'https://notion.so/product/ai',   array['Notes','Docs','Workspace','Drafting'],            '#7b5cf0', false),
  ('Hemingway',  '📝', 'writing',     'free',     'Highlights complex sentences, passive voice, and adverb overuse. The web version is completely free.',                                                       'https://hemingwayapp.com',        array['Editing','Readability','Clarity'],                '#f04f7b', false),
  ('QuillBot',   '🔤', 'writing',     'freemium', 'AI paraphrasing and grammar checking. The free tier covers rewriting, summarizing, and citation generation.',                                               'https://quillbot.com',           array['Paraphrase','Grammar','Summarize'],               '#34d399', false),
  ('Firefly',    '🎨', 'image',       'freemium', 'Adobe''s generative AI. Text-to-image, generative fill, and style transfer.',                                                                               'https://firefly.adobe.com',      array['Text-to-Image','Generative Fill','Adobe'],        '#f04f7b', false),
  ('Ideogram',   '🖼️', 'image',       'freemium', 'Exceptional at generating images with accurate, legible text. Great for posters, logos, and mockups.',                                                      'https://ideogram.ai',            array['Text in Images','Posters','Mockups'],             '#c8f542', true),
  ('Codeium',    '🤖', 'code',        'free',     'Completely free AI coding assistant. Supports 70+ languages and integrates with all major IDEs.',                                                           'https://codeium.com',            array['Free Forever','70+ Languages','IDE Plugin'],      '#c8f542', false),
  ('v0 by Vercel','🧩','code',        'freemium', 'Generate React/Tailwind UI components from text prompts. Export clean, production-ready code.',                                                             'https://v0.dev',                 array['React','Tailwind','UI Gen'],                      '#f04f7b', false),
  ('ElevenLabs', '🎤', 'audio',       'freemium', 'Hyper-realistic AI voice generation and cloning. Free tier includes 10K characters/month.',                                                                 'https://elevenlabs.io',          array['Voice Clone','TTS','Dubbing'],                    '#f04f7b', false),
  ('Suno',       '🎵', 'audio',       'freemium', 'Generate full songs with vocals and instruments from a text prompt. Free tier: 10 songs/day.',                                                              'https://suno.ai',                array['Music Gen','Lyrics','Songs'],                     '#c8f542', false),
  ('Perplexity', '🔬', 'research',    'freemium', 'An AI search engine that cites its sources. Ask complex questions and get synthesized, referenced answers.',                                                 'https://perplexity.ai',          array['Search','Citations','Real-time'],                 '#c8f542', false),
  ('Elicit',     '📚', 'research',    'freemium', 'AI research assistant trained on academic papers. Essential for literature reviews.',                                                                        'https://elicit.org',             array['Academic','Papers','Literature Review'],          '#7b5cf0', false),
  ('Otter.ai',   '📋', 'productivity','freemium', 'Real-time meeting transcription with speaker identification. Free tier: 300 min/month.',                                                                    'https://otter.ai',               array['Meeting Notes','Transcription','Zoom'],           '#f04f7b', false),
  ('Zapier AI',  '⚡', 'productivity','freemium', 'Build AI-powered automation workflows without code. Connect 5,000+ apps.',                                                                                   'https://zapier.com/ai',          array['Automation','No-code','5000+ Apps'],              '#c8f542', false)
on conflict do nothing;

insert into public.changelog (week_of, title, summary, added, updated)
values
  ('2026-05-19', 'Week of May 19 — ORBIT launches 🚀', 'Initial launch with 15 curated AI tools across 6 categories. Supabase backend, admin dashboard, and community submissions are now live.', array['ChatGPT','Claude','Codeium','ElevenLabs','Suno'], array[]),
  ('2026-05-12', 'Week of May 12 — Research & Productivity', 'Added Perplexity, Elicit, Otter.ai and Zapier AI. Research category is now live.', array['Perplexity','Elicit','Otter.ai','Zapier AI'], array[])
on conflict do nothing;
