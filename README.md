# Stacks — Build Spec

A personal knowledge base you talk to. Not an AI companion, not a diary —
a place to drop links, notes, and half-formed ideas the moment they occur
to you, and pull them back out later by just asking. Human memory fades;
this doesn't.

---

## Running Locally

1. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` — Postgres connection string (`npm run db:push` creates the tables).
   - `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` — a Discord OAuth app ([discord.com/developers](https://discord.com/developers/applications)); set its callback to `http://localhost:3000/api/auth/callback/discord`.
   - `GOOGLE_GENERATIVE_AI_API_KEY` — free key from [Google AI Studio](https://aistudio.google.com/apikey). Powers save enrichment and recall.
2. `npm install`, then `npm run dev`.

**Without an AI key the app still works in a degraded mode:** saving files
cards with basic heuristic titles/tags (everything lands under `inbox`), but
asking questions returns an error telling you to configure the key.

---

## Why This Exists

The gap this fills: chat tools forget everything between sessions, and
bookmark managers require you to file things carefully at save-time — which
is exactly the moment you have the least patience for it. Stacks is meant
to sit between those two: as low-friction as a chat message to save
something, as structured and browsable as a real archive when you want to
look through it.

It is explicitly **not** a companion, a therapist, or a "best friend AI."
It's a tool. The relationship it builds is with your own accumulated
notes, not with the AI itself.

---

## Core Concept

One system, two jobs:

1. **Capture** — drop a link, a note, an idea. Zero friction, no forced
   categorization at save time.
2. **Recall** — ask a question in plain language and get an answer
   synthesized from everything you've saved, not just a keyword match.

Everything you save becomes a **card**. Cards are the unit of the whole
system — browsable, searchable, editable, deletable.

---

## Interface Layout

Two panels, not one chat window.

### 1. Board (main surface, centered — primary UI)
- A grid of cards, one per saved entry — title, one-line summary, tags,
  folder label.
- Search/filter bar at the top (matches title, note text, tags).
- Folder chips to filter the whole board to one folder, or view everything.
- A quick-add bar at the top of the board for capturing directly, without
  going through chat. Still passes through the same AI enrichment step
  before landing as a card.
- Clicking any card opens the **full detail view**.

### 2. Chat panel (docked to the side — secondary, always available)
- For: asking questions, open-ended searching, casual back-and-forth, and
  generative requests ("give me UI ideas based on what I've filed under
  Web Dev").
- **Ask-only:** nothing typed into the chat is ever filed as a card.
  Messages stay in the conversation (in-session memory) and answers are
  synthesized from the saved cards. **The board's quick-add bar is the
  only place that saves cards; the chat reads them.**
- When answering a question by pulling from saved entries, the reply
  references them by title and/or highlights the matching cards on the
  board — it doesn't need to re-render full card previews inline.

**Division of responsibility:** the board is for browsing/seeing
everything at a glance; the chat is for asking, searching, and talking.
Saving can happen from either surface, but always resolves to a card on
the board.

---

## Core Loop (step by step)

1. Person sends a message (via chat, or the board's quick-add bar).
2. The app decides: **save** it, or **answer** a question from what's
   already saved.
   - Contains a URL → save.
   - Ends in "?" or starts with a question word (what/who/how/do/does/
     is/can/find/show/tell/remind/recall/etc.) → answer.
   - Otherwise → save (default to capturing — that's the primary use).
   - Also give an explicit manual override: an Auto / File / Ask toggle,
     for when detection guesses wrong.
3. **Save path:** send the message (+ URL if present) to an AI. Get back:
   - a short descriptive title
   - a one-sentence summary grounded *only* in what the person actually
     wrote (never invent facts about a linked page — the app cannot
     browse links, and this is a real, stated limitation)
   - 2–4 short tags
   - a folder/category — reuse an existing one if it clearly fits,
     otherwise create a new one
   Store as a card. Reply confirming what was filed and where.
4. **Ask path:** send the question plus a compact list of all saved
   entries (title, summary, tags, category, url, raw note) to an AI.
   Ask it to answer conversationally, reference relevant entries by
   name, say plainly if nothing saved is relevant, and return which
   entry IDs it actually used (so the board can highlight them).

---

## Data Model

Per saved card:

| Field | Notes |
|---|---|
| `id` | unique |
| `url` | nullable |
| `note` | raw text the person wrote, unedited |
| `title` | AI-generated |
| `summary` | AI-generated, one sentence |
| `tags` | AI-generated, 2–4 |
| `category` / `folder` | AI-generated, reused-or-created |
| `saved_at` | timestamp |
| `status` | `active` / `archived` / `trashed` (see Recommended Features) |

---

## Detail View (per card)

Opened by clicking a card anywhere it appears (board or chat reference):

- Full title, folder, tags
- Exact raw saved text (not just the AI summary)
- Source link if any
- Exact timestamp
- Copy-to-clipboard action
- Delete action (see soft-delete below)

---

## Recommended Features

### Safety net
- **Soft delete:** "remove" moves a card to Trash instead of deleting
  outright; auto-purge after 30 days.
- **Duplicate detection:** if a URL already exists on the board, don't
  create a second card — surface the existing one and offer to merge
  the new note into it.

### Organization at scale
- **Bulk actions:** multi-select cards to move several into a folder or
  delete several at once.
- **Rename-folder-everywhere:** renaming a folder updates every card in
  it, rather than fixing cards one by one.
- **Archive vs. delete:** a lightweight "done looking at this, don't
  delete it" state, separate from Trash — keeps the active board focused
  without destroying anything.

### Proactive recall
- **Resurfacing:** occasionally surface an old card ("you saved this 3
  weeks ago, still relevant?") — passive recall, not dependent on
  remembering to ask.
- **Related cards:** in the detail view, show 2–3 other cards sharing
  tags or folder — turns isolated notes into a browsable web.
- **Scoped ask:** let a question optionally target one folder only
  ("just search my Web Dev folder"), so answers don't dilute as the
  board grows.

### Faster capture
- **Quick-tag shortcuts:** typing `#folder-name` inline assigns the
  folder directly, skipping the AI guess when the person already knows
  where it belongs.
- **Multi-save:** pasting several links in one message files them as
  separate cards, not one merged card.

### Explicit non-goals
- No reminders/notifications tied to specific times — that's a to-do
  app's job, not this one.
- No social or sharing features — this is single-person, not
  collaborative.
- No companion/emotional-support framing — Stacks is a tool, not a
  friend.

---

## Security Constraint (non-negotiable)

This is **not a secrets vault**. Never position or use it for passwords,
API keys, or other credentials:

- Saved note text gets sent to an AI for tagging/enrichment — a secret
  would be transmitted to a third-party processing step just to get
  labeled.
- Storage isn't built or encrypted for credential-grade sensitivity.

If a message looks like a credential (matches common API-key/password
patterns), the app should **decline to file it** and tell the person to
use a real password manager instead — not silently save it.

---

## System Architecture

**Components:**
- **Client** — renders the Board and Chat panel, calls the backend API.
- **Backend API** — handles CRUD on cards, folder rename-everywhere,
  bulk actions, trash/archive state, and the two AI-facing operations
  (enrich-on-save, answer-on-ask).
- **Database** — one table for cards (see Data Model), scoped per
  person/account so data never crosses between users.
- **AI provider** — two distinct calls:
  1. *Enrichment call* — takes raw text (+ url + existing folder list) →
     returns title/summary/tags/category as structured JSON.
  2. *Recall call* — takes a question + compact list of saved entries →
     returns a natural-language answer + the list of entry IDs it used.

**Data flow for a save:**
`client → backend → AI enrichment call → backend stores card → client
refetches/updates board`

**Data flow for a question:**
`client → backend → backend gathers entries → AI recall call → backend
returns answer + relevant IDs → client renders answer, highlights cards`

**Search/retrieval approach:**
- At small-to-medium scale: send the full (or recently-active) entry
  list as context to the AI recall call — simplest, no extra
  infrastructure.
- At larger scale (hundreds+ of cards): consider embeddings-based
  retrieval to pre-filter the most relevant entries before the recall
  call, to stay within reasonable prompt size and improve relevance.
  Treat this as a later optimization, not an MVP requirement.

**Auth:** single-account personal data isolation is sufficient — this
is not designed as a multi-tenant collaborative product.

---

## Build Phases

**Phase 1 — MVP**
Core loop (save/ask detection), Board with search + folder filter, Chat
panel, AI enrichment on save, AI recall on ask, detail view, basic
delete, security constraint (reject credential-like input).

**Phase 2 — Organization at scale**
Soft delete + Trash, duplicate detection, bulk actions, rename-folder-
everywhere, archive state.

**Phase 3 — Proactive & faster capture**
Resurfacing, related cards, scoped ask, quick-tag shortcuts, multi-save.

---

## Tone of AI Replies

- Confirms what got filed and where, briefly — no over-explaining.
- When answering questions, sounds like an assistant that actually
  remembers what was saved, not a generic search engine.
- Honest about its one real limitation: it can't browse the pages behind
  saved links, so tagging quality depends on the note the person adds
  alongside a URL.