-- ═══════════════════════════════════════════════════════════════
--  ORBIT v2 — Full Schema  (run in Supabase SQL Editor)
-- ═══════════════════════════════════════════════════════════════

-- ── 1. TOOLS (richer metadata) ───────────────────────────────────
create table if not exists public.tools (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  icon           text not null default '🔧',
  category       text not null check (category in (
                   'writing','image','code','audio','research',
                   'productivity','video','data','other')),
  pricing        text not null default 'freemium' check (pricing in (
                   'free','freemium','paid','open')),
  price_detail   text,             -- e.g. "Free up to 10K chars/mo, then $5/mo"
  description    text,
  why_choose     text,             -- 1-sentence "best for X" reason
  solves         text[],          -- ["Removes filler words","Auto-formats"]
  integrations   text[],          -- ["Slack","Notion","Zapier","VS Code"]
  use_cases      text[],          -- ["copywriting","seo","email","social"]
  maturity       text default 'stable' check (maturity in (
                   'beta','stable','mature','deprecated')),
  url            text not null,
  affiliate_url  text,
  tags           text[] default '{}',
  accent_color   text default '#7b5cf0',
  is_new         boolean default true,
  launched_at    date,            -- for "new this week" detection
  status         text default 'published' check (status in (
                   'published','draft','archived')),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
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
  status          text default 'pending' check (status in (
                    'pending','approved','rejected')),
  created_at      timestamptz default now()
);

-- ── 3. CHANGELOG ─────────────────────────────────────────────────
create table if not exists public.changelog (
  id          uuid primary key default gen_random_uuid(),
  week_of     date not null unique,
  title       text not null,
  summary     text,
  added       text[] default '{}',
  updated     text[] default '{}',
  removed     text[] default '{}',
  created_at  timestamptz default now()
);

-- ── 4. COLLECTIONS ────────────────────────────────────────────────
create table if not exists public.collections (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  slug        text not null unique,
  description text,
  emoji       text default '📦',
  sort_order  int default 0,
  published   boolean default true,
  created_at  timestamptz default now()
);

create table if not exists public.collection_tools (
  collection_id uuid references public.collections(id) on delete cascade,
  tool_id       uuid references public.tools(id) on delete cascade,
  sort_order    int default 0,
  primary key (collection_id, tool_id)
);

-- ── 5. ROW LEVEL SECURITY ─────────────────────────────────────────
alter table public.tools            enable row level security;
alter table public.submissions      enable row level security;
alter table public.changelog        enable row level security;
alter table public.collections      enable row level security;
alter table public.collection_tools enable row level security;

drop policy if exists "Public read tools"       on public.tools;
drop policy if exists "Public read changelog"   on public.changelog;
drop policy if exists "Public insert submissions" on public.submissions;
drop policy if exists "Public read collections"   on public.collections;
drop policy if exists "Public read coll_tools"    on public.collection_tools;

create policy "Public read tools"
  on public.tools for select using (status = 'published');
create policy "Public read changelog"
  on public.changelog for select using (true);
create policy "Public insert submissions"
  on public.submissions for insert with check (true);
create policy "Public read collections"
  on public.collections for select using (published = true);
create policy "Public read coll_tools"
  on public.collection_tools for select using (true);

-- ── 6. SEED TOOLS ────────────────────────────────────────────────
insert into public.tools
  (name,icon,category,pricing,price_detail,description,why_choose,solves,integrations,use_cases,maturity,url,affiliate_url,tags,accent_color,is_new,launched_at)
values
  ('ChatGPT','✍️','writing','freemium','Free (GPT-4o mini); $20/mo Plus','OpenAI''s flagship AI. Write, edit, brainstorm, and summarize across any topic. The free tier now runs GPT-4o mini; Plus gets you GPT-4o with image gen.','Best all-rounder — if you only pick one AI writing tool, start here.',array['Drafts long-form content','Edits and rewrites','Summarizes documents'],array['Zapier','Make','Slack','Notion'],array['copywriting','email','blogging','summarization','chat'],'mature','https://chat.openai.com',null,array['LLM','Chat','GPT-4o'],'#7b5cf0',false,'2022-11-30'),

  ('Claude','🧠','writing','freemium','Free (Sonnet); $20/mo Pro','Anthropic''s AI — best for long-document analysis, nuanced writing, and following complex multi-step instructions. 200K token context window.','Best for long documents and instructions that need to be followed precisely.',array['Analyzes 200-page PDFs','Follows complex instructions','Writes in consistent tone'],array['Slack','VS Code','API'],array['research','summarization','copywriting','coding','analysis'],'mature','https://claude.ai',null,array['LLM','Long Context','200K tokens'],'#c8f542',false,'2023-03-14'),

  ('Notion AI','✨','writing','freemium','Free add-on (limited); $8/mo unlimited','AI writing assistant embedded in Notion. Summarize notes, draft docs, auto-fill databases. No context-switching — it lives where your work is.','Best if you already use Notion — zero setup, zero tab switching.',array['Summarizes meeting notes','Drafts SOPs','Auto-tags database entries'],array['Notion','Slack','Jira'],array['notes','docs','summarization','project management'],'stable','https://notion.so/product/ai',null,array['Notes','Workspace','Drafting'],'#7b5cf0',false,'2023-02-22'),

  ('Hemingway Editor','📝','writing','free','Free web; $19.99 desktop app','Brutally honest readability grader. Highlights passive voice, adverbs, complex sentences. If your writing scores Grade 6, non-experts can read it.','Best free tool for making writing clearer and more confident.',array['Removes passive voice','Flags complex sentences','Grades readability'],array[],array['copywriting','blogging','email','editing'],'stable','https://hemingwayapp.com',null,array['Editing','Readability','Clarity'],'#f04f7b',false,'2014-01-01'),

  ('QuillBot','🔤','writing','freemium','Free (paraphrase only); $9.95/mo Premium','AI paraphrasing, grammar checking, and citation generator. Rewrites sentences while keeping meaning. Free tier handles 125 words per request.','Best free paraphrasing tool — especially useful for academic writing.',array['Rewrites without plagiarism','Checks grammar','Generates citations (APA/MLA)'],array['Google Docs','Microsoft Word','Chrome'],array['academic','copywriting','email','seo'],'stable','https://quillbot.com',null,array['Paraphrase','Grammar','Citations'],'#34d399',false,'2017-10-01'),

  ('Ideogram','🖼️','image','freemium','Free (10/day); $7/mo Basic','Text-to-image model that finally gets typography right. Unmatched at rendering readable, stylized text inside images — great for posters, thumbnails, and mockups.','Best for any image that needs readable text — nobody else is close.',array['Renders legible text in images','Creates posters and thumbnails','Typography-forward designs'],array[],array['social media','marketing','design','thumbnails'],'stable','https://ideogram.ai',null,array['Text in Images','Posters','Typography'],'#c8f542',true,'2023-08-01'),

  ('Adobe Firefly','🎨','image','freemium','Free (25 credits/mo); included in CC plans','Adobe''s generative AI. Text-to-image, generative fill in Photoshop, style transfer. Trained on licensed content — commercially safe by design.','Best image AI for professional/commercial work where IP safety matters.',array['Generates commercially-safe images','Generative fill in Photoshop','Style transfer'],array['Photoshop','Illustrator','Adobe Express'],array['design','marketing','social media','advertising'],'stable','https://firefly.adobe.com',null,array['Generative Fill','Commercial Safe','Adobe CC'],'#f04f7b',false,'2023-03-21'),

  ('GitHub Copilot','💻','code','freemium','Free (2k completions/mo); $10/mo Pro','AI pair programmer inside VS Code, JetBrains, Neovim, and more. Inline autocomplete, explain code, write tests. The de-facto standard for AI coding.','Best IDE integration — if you live in VS Code, this is a no-brainer.',array['Inline code autocomplete','Explains code blocks','Generates unit tests'],array['VS Code','JetBrains','Neovim','GitHub'],array['coding','testing','debugging','documentation'],'mature','https://github.com/features/copilot',null,array['Autocomplete','IDE Plugin','Multi-lang'],'#7b5cf0',false,'2021-06-29'),

  ('Codeium','🤖','code','free','Free forever for individuals','Completely free AI coding assistant — no monthly limits. Supports 70+ languages and every major IDE. Privacy-first: no code retention.','Best free Copilot alternative — genuinely unlimited, no credit cards.',array['Unlimited autocomplete','Explains and refactors code','Chat in IDE'],array['VS Code','JetBrains','Vim','Emacs','Neovim'],array['coding','refactoring','debugging','documentation'],'stable','https://codeium.com',null,array['Free Forever','70+ Languages','Privacy-first'],'#c8f542',false,'2022-12-07'),

  ('v0 by Vercel','🧩','code','freemium','Free (200 credits/mo); $20/mo Pro','Generate React + Tailwind UI from a text prompt. Iterate in chat. Export clean code. Connects directly to your Next.js project.','Best for spinning up polished React UI without writing CSS from scratch.',array['Generates React/Tailwind components','Iterates via chat','Exports to Next.js'],array['Vercel','Next.js','GitHub','Figma'],array['coding','ui design','prototyping','web dev'],'stable','https://v0.dev',null,array['React','Tailwind','UI Gen'],'#f04f7b',false,'2023-09-27'),

  ('ElevenLabs','🎤','audio','freemium','Free (10K chars/mo); $5/mo Starter','Hyper-realistic AI voice synthesis and cloning. Dub videos, create podcasts, build voiceovers. Voice cloning from 60 seconds of audio.','Best voice quality available — nothing else sounds as natural.',array['Clones voices from short samples','Generates natural narration','Dubs videos into other languages'],array['Zapier','Make','API'],array['podcast','video','narration','voice clone','dubbing'],'stable','https://elevenlabs.io',null,array['Voice Clone','TTS','Dubbing','60s clone'],'#f04f7b',false,'2022-01-01'),

  ('Suno','🎵','audio','freemium','Free (10 songs/day); $8/mo Pro','Full AI song generation — vocals, instruments, and lyrics from a single text prompt. Eerily good for 30-second social clips.','Best for AI-generated background music and social audio snippets.',array['Generates complete songs with vocals','Creates instrumentals on demand','Produces 30s social clips fast'],array[],array['social media','podcast','video','music'],'stable','https://suno.ai',null,array['Music Gen','Vocals','AI Songs'],'#c8f542',false,'2023-05-16'),

  ('Adobe Podcast','🎧','audio','free','Free','AI audio enhancement. Upload any recording and it removes background noise and room echo, making any mic sound like a studio setup in seconds.','Best free audio cleanup — turns a bad mic into a studio mic.',array['Removes background noise','Eliminates room echo','Enhances voice clarity'],array['Adobe Creative Cloud'],array['podcast','video','recording','audio cleanup'],'stable','https://podcast.adobe.com',null,array['Noise Removal','Free','Podcast'],'#f04f7b',false,'2022-10-01'),

  ('Perplexity AI','🔬','research','freemium','Free; $20/mo Pro','AI search engine that cites every claim. Ask complex questions, get synthesized answers with sources. Pro adds GPT-4o, Claude, and deep research mode.','Best for fact-finding where you need to verify sources — not just vibes.',array['Cites every claim with source links','Searches the live web','Synthesizes multiple sources'],array['Slack','API'],array['research','fact-checking','market research','news','analysis'],'stable','https://perplexity.ai',null,array['Search','Citations','Real-time Web'],'#c8f542',false,'2022-08-01'),

  ('Elicit','📚','research','freemium','Free (limited); $10/mo Plus','AI research assistant for academic literature. Find, summarize, and extract data from research papers. Essential for any evidence-based work.','Best for academic research — does literature reviews in hours not weeks.',array['Finds relevant research papers','Extracts key findings','Compares studies side-by-side'],array['Zotero','API'],array['academic','research','literature review','science'],'stable','https://elicit.org',null,array['Academic','Papers','Literature Review','Evidence'],'#7b5cf0',false,'2021-09-01'),

  ('Otter.ai','📋','productivity','freemium','Free (300 min/mo); $10/mo Pro','Real-time meeting transcription with speaker ID. Integrates with Zoom, Meet, Teams. Auto-generates action items and summaries post-call.','Best meeting recorder — the action items feature alone saves hours.',array['Transcribes meetings in real-time','Identifies who said what','Generates action items automatically'],array['Zoom','Google Meet','Teams','Slack','Notion'],array['meetings','notes','productivity','async'],'stable','https://otter.ai',null,array['Meeting Notes','Transcription','Speaker ID'],'#f04f7b',false,'2016-02-01'),

  ('Zapier AI','⚡','productivity','freemium','Free (100 tasks/mo); $19.99/mo Starter','Build AI-powered automations without code. Add AI steps to classify, summarize, or route data mid-flow. Connects 7,000+ apps.','Best no-code automation with AI — connects everything to everything.',array['Automates repetitive tasks without code','Adds AI classification to workflows','Connects 7000+ apps'],array['Slack','Gmail','Notion','Airtable','HubSpot','Salesforce'],array['automation','productivity','no-code','operations'],'stable','https://zapier.com/ai',null,array['Automation','No-code','7000+ Apps'],'#c8f542',false,'2011-10-01'),

  ('Mem.ai','🗂️','productivity','freemium','Free (limited); $14.99/mo Pro','AI-powered personal knowledge base. Notes auto-organize; ask questions about your own content in natural language.','Best for building a second brain — your notes become searchable knowledge.',array['Auto-organizes notes by topic','Answers questions from your notes','Surfaces related content automatically'],array['Slack','Email','API'],array['notes','pkm','research','knowledge management'],'stable','https://mem.ai',null,array['PKM','Notes','Knowledge Base','Second Brain'],'#7b5cf0',true,'2020-06-01')
on conflict do nothing;

-- ── 7. SEED COLLECTIONS ──────────────────────────────────────────
with tools_by_name as (
  select id, name from public.tools
)
insert into public.collections (title, slug, description, emoji, sort_order) values
  ('Best for Copywriting',     'copywriting',  'Write better copy faster — ads, emails, landing pages, social posts.',          '✍️', 1),
  ('Best Free AI Tools',       'free-only',    'Zero cost, no credit card. Every tool here has a genuinely useful free tier.',   '🆓', 2),
  ('Best for Developers',      'developers',   'Tools that live in your IDE or make coding faster.',                             '👨‍💻', 3),
  ('Best for Content Creators','content',      'Podcast, video, thumbnail, caption — the full creator stack.',                  '🎬', 4),
  ('New This Week',            'new-launches', 'Fresh tools launched or significantly updated in the last 7 days.',              '🚀', 5)
on conflict (slug) do nothing;

-- ── 8. SEED CHANGELOG ────────────────────────────────────────────
insert into public.changelog (week_of, title, summary, added, updated)
values
  ('2026-05-19', 'Week of May 19 — ORBIT v2 launches 🚀',
   'Major upgrade: richer tool metadata, comparison mode, "what to use for..." guide, curated collections, and hardened backend. 17 tools across 6 categories.',
   array['ChatGPT','Claude','Ideogram','Codeium','ElevenLabs','Suno','Perplexity'],
   array[]),
  ('2026-05-12', 'Week of May 12 — Productivity & Research',
   'Added Otter.ai, Zapier AI, Mem.ai, Elicit. New Research category is live.',
   array['Otter.ai','Zapier AI','Mem.ai','Elicit'],
   array[])
on conflict do nothing;
