# ✦ Folio — Notes App

A clean, modern notes application built with React + Vite and Supabase. Create rich notes with text blocks and images, reorder them via drag-and-drop, and export to PDF.

---

## Features

- 📝 **Text blocks** — Write and save text content
- 🖼 **Image blocks** — Upload images stored in Supabase Storage
- 🔀 **Drag-and-drop reorder** — Reorder any item; position saved to Supabase
- 💾 **Persistent order** — Items always load in the saved position
- 📄 **PDF export** — Export the full note (text + images, in order) via jsPDF
- ✨ **Clean editorial UI** — Warm cream palette, Playfair Display typography

---

## Project Structure

```
notes-app/
├── index.html
├── vite.config.js
├── package.json
├── vercel.json
├── .env.example
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── lib/
    │   └── supabase.js          # Supabase client
    ├── components/
    │   ├── NotesApp.jsx         # Root + Toast context
    │   ├── NotesList.jsx        # Notes grid, create/delete
    │   ├── NoteEditor.jsx       # Editor, DnD, PDF export
    │   ├── NoteItem.jsx         # Sortable item (text/image)
    │   └── AddItemPanel.jsx     # Add text/image panel
    └── styles/
        └── index.css            # Global styles + design tokens
```

---

## Supabase Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a new project.

### 2. Run the database schema

In the **Supabase SQL Editor**, run:

```sql
-- Notes table
CREATE TABLE notes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID,
  title       TEXT NOT NULL DEFAULT 'Untitled',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Note items table
CREATE TABLE note_items (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id     UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('text', 'image')),
  content     TEXT,
  image_url   TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Index for fast ordered fetching
CREATE INDEX note_items_note_id_position ON note_items (note_id, position);

-- RLS policies (permissive for single-user / demo use)
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on notes" ON notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on note_items" ON note_items FOR ALL USING (true) WITH CHECK (true);
```

> **Note:** The RLS policies above allow all access (suitable for personal/demo use). For production with auth, scope them to `auth.uid() = user_id`.

### 3. Create Storage bucket

In the **Supabase Dashboard → Storage**, create a bucket named **`note-images`** and set it to **Public**.

Then add this storage policy in **SQL Editor**:

```sql
CREATE POLICY "Public read note-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'note-images');

CREATE POLICY "Allow upload note-images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'note-images');

CREATE POLICY "Allow delete note-images"
ON storage.objects FOR DELETE
USING (bucket_id = 'note-images');
```

### 4. Get your credentials

In **Project Settings → API**, copy:
- **Project URL** → `VITE_SUPABASE_URL`
- **anon / public key** → `VITE_SUPABASE_ANON_KEY`

---

## Running Locally

```bash
# 1. Clone / download the project
cd notes-app

# 2. Install dependencies
npm install

# 3. Create your .env file
cp .env.example .env
# Edit .env and add your Supabase URL and anon key

# 4. Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Deploying to Vercel

### Option A: Vercel CLI

```bash
npm install -g vercel
vercel

# Follow prompts, then add environment variables:
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY

# Redeploy with env vars:
vercel --prod
```

### Option B: Vercel Dashboard

1. Push your code to a GitHub / GitLab / Bitbucket repository
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import your repository
4. In **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
5. Set **Framework Preset** to **Vite**
6. Click **Deploy**

---

## Tech Stack

| Layer | Library |
|-------|---------|
| Framework | React 18 + Vite 5 |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| PDF Export | jsPDF |
| Fonts | Playfair Display + Lato (Google Fonts) |

---

## License

MIT
