# Content

Personal content pipeline for turning a topic or idea into ready-to-post LinkedIn content: researched posts, LinkedIn carousels (rendered as real PNG slides, not text outlines), standalone infographics, and Twitter/X thread repurposing — all generated with a consistent purple/white/black brand theme and your own brand logo composited onto the output.

## What it does

- **Research** (`/api/research`) — looks up current context/trend data for a topic via [Exa](https://exa.ai) so generated copy and stats are grounded in real information, not invented.
- **Post generation** (`/api/generate`) — writes a LinkedIn post draft for a topic + category, using your brand profile (`brand-assets/profile.md`) and accumulated feedback notes.
- **Carousel generation** (`/api/create-carousel`) — plans a 4-panel carousel (hook + consecutive content panels), turns the plan into an image-generation prompt, renders it as one wide image via [kie.ai](https://kie.ai) (nano-banana model), slices it into individual slide PNGs, and composites your brand logo onto each slide.
- **Infographic generation** (`/api/create-infographics`) — plans one infographic's content, then renders it in several different visual styles side by side so you can pick a favorite; only the brand logo is composited on, no per-slide branding.
- **Twitter/X repurposing** (`/api/repurpose-twitter`) — turns an existing post draft into a Twitter/X thread.
- **Carousel feedback** (`/api/carousel-feedback`) — records your notes on past carousels so future generations improve over time.

Generated images are written to `public/generated/<session-id>/` and served statically; brand assets (logo, profile notes, style references, feedback) live in `brand-assets/`.

## Setup

### 1. Prerequisites

- Node.js 20+
- API keys for:
  - **OpenAI** — content/copy generation
  - **Exa** — research/trend lookups
  - **kie.ai** — image generation (nano-banana model)

### 2. Install

```bash
npm install
```

### 3. Configure environment

Create a `.env` file in the project root (this file is gitignored, never commit it):

```bash
OPENAI_API_KEY=sk-...
EXA_API_KEY=...
KIE_API_KEY=...
```

### 4. Add your brand assets

In `brand-assets/`:
- `Brand logo.png` — your logo, composited onto generated slides/infographics.
- `profile.md` — a short description of your brand/voice used to steer content generation.
- `carousel_feedback.md` — running notes on what to improve (can start empty).

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other scripts

```bash
npm run build   # production build
npm run start   # run the production build
npm run lint    # eslint
```

## Pushing to GitHub

If you're setting this up from scratch (no existing remote):

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

If a remote is already configured (check with `git remote -v`), just commit and push:

```bash
git add .
git commit -m "Your commit message"
git push
```

**Never commit your `.env` file or API keys.** `.env*` is already gitignored — double check `git status` before pushing if you ever add secrets to a differently-named file.
