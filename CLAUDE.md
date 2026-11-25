# ⚡ CLAUDE: READ THIS FIRST — Cover Generator Source of Truth

> If you are a new Claude session, this card tells you everything. Do not search around for "the real backend" — it is this directory. Do not look at `ai-cover-generator/`, `hf-spaces-deployment/`, or any LoRA/RunPod file — they are dead.

## 📍 Canonical Locations (memorize these)

| Thing | Path / URL |
|---|---|
| **Backend repo (local)** | `/Users/valorkopeny/crypto-news-curator-backend` |
| **Backend repo (GitHub)** | `https://github.com/Genfinityllc/crypto-news-curator-backend` branch `main` |
| **Backend live URL** | `https://crypto-news-curator-backend-production.up.railway.app` |
| **Backend deploy** | **Git auto** — `git push origin main` → Railway rebuilds in ~2 min (confirmed 2026-06-16, Settings → Source is connected to `main` with auto-deploy ON). Do NOT use `railway up` — the CLI hangs on "Indexing" indefinitely on this Mac. |
| **Frontend repo (local)** | `/Users/valorkopeny/crypto-news-frontend` |
| **Frontend repo (GitHub)** | `https://github.com/Genfinityllc/crypto-news-frontend` branch `main` |
| **Frontend live URL** | `https://crypto-news-frontend-ruddy.vercel.app` |
| **Frontend deploy** | **Git auto** — `git push origin main` → Vercel deploys in ~2 min |
| **Frontend Vercel team** | `team_kYZ8yndpCmXg5hf3sDSUQ6tZ` (NOT `valors-projects-e78ccc5f` — that's stale) |
| **Image API** | Wavespeed Nano-Banana-Pro (`api.wavespeed.ai/api/v3/google/nano-banana-pro/edit`) |
| **Logo storage** | Supabase (project `daqxnvcfmepjzcgfdrdf`) |
| **Railway project** | `intelligent-contentment` (ID `8979a89d-75ee-40f7-a47f-7a5d7ecaa2b2`), service `crypto-news-curator-backend` (ID `d20f230c-6855-4641-a026-57f81e649875`), account `support@genfinity.io` |
| **GitHub auth on this Mac** | `gh auth` is logged in as `ValtronXRP` — has Write access to both Genfinityllc repos (granted 2026-06-15). `git push origin main` just works. |

## 🔑 Accounts & Connections (current, verified 2026-06-17)

| Service | Account / Owner | Identity used on this Mac | Notes |
|---|---|---|---|
| **GitHub (both repos)** | `Genfinityllc` org | `ValtronXRP` (PAT in macOS keychain via `gh auth`) | Write access granted 2026-06-15. `git push origin main` works with no token juggling. Do NOT switch to `valor-cmd` — that's a separate identity used for other repos (trading-platform, pod-etsy-system, hedera-ecosystem-map). |
| **Railway** | `support@genfinity.io` | `RAILWAY_API_TOKEN` env var in shell | Project `intelligent-contentment` (ID `8979a89d-75ee-40f7-a47f-7a5d7ecaa2b2`), service `crypto-news-curator-backend` (ID `d20f230c-6855-4641-a026-57f81e649875`). CLI binary at `/Users/valorkopeny/.local/bin/railway`. Auth via env token. **DO NOT use `railway up`** — hangs forever on this Mac. Only use it for `variables`, `logs`, `status`. Real deploys happen via GitHub auto-deploy. |
| **Vercel** | `team_kYZ8yndpCmXg5hf3sDSUQ6tZ` (the Genfinity team) | `vercel` CLI logged in | Project `crypto-news-frontend` connected to GitHub `Genfinityllc/crypto-news-frontend` `main` with auto-deploy ON. There is a **stale duplicate project** under personal scope `valors-projects-e78ccc5f` — IGNORE IT. The live URL `crypto-news-frontend-ruddy.vercel.app` is served by the team-scoped project. |
| **Supabase** | Project `daqxnvcfmepjzcgfdrdf` (region depends on dashboard) | Service-role key in Railway env `SUPABASE_SERVICE_KEY` + public anon key in `SUPABASE_URL` | Dashboard: https://supabase.com/dashboard/project/daqxnvcfmepjzcgfdrdf. Single bucket `logos` serves both `logos/*.png` (brand PNGs) and `logos/references/*.png` (uploaded ref images). The service role **cannot** create new buckets on this project — reuse `logos` + folder prefixes for any new asset type. |
| **Wavespeed (Nano-Banana-Pro)** | Account tied to `WAVESPEED_API_KEY` env var on Railway | Server-side only — never exposed to frontend | Current valid key starts with `wsk_live_9Nw8s-...` (set 2026-06-15). Endpoint: `https://api.wavespeed.ai/api/v3/google/nano-banana-pro/edit`. Hard cap of **14 input images** per request (see Phase 4-ext3). |
| **Firebase (auth)** | Tied to `FIREBASE_*` env vars on Railway | Server-side only | Powers the frontend login flow. Not used by the cover generator itself, but the generator endpoints check `authHeader`. |
| **OpenAI** | `OPENAI_API_KEY` on Railway | Server-side only | **Legacy paths only** — the live Wavespeed flow does NOT use it. Safe to leave set; do not build new features against it. |

### Quick "where do I change X" cheat sheet

| I want to… | Do this |
|---|---|
| Deploy backend code | `git push origin main` from `/Users/valorkopeny/crypto-news-curator-backend` → Railway rebuilds in ~2 min |
| Deploy frontend code | `git push origin main` from `/Users/valorkopeny/crypto-news-frontend` → Vercel rebuilds in ~2 min |
| Set/rotate a backend env var | `/Users/valorkopeny/.local/bin/railway variables --set "KEY=value"` (after `railway link --project intelligent-contentment` once per shell). Railway redeploys automatically. |
| Set a frontend env var | Vercel dashboard → project `crypto-news-frontend` → Settings → Environment Variables (team `team_kYZ8yndpCmXg5hf3sDSUQ6tZ`). Then trigger a redeploy by pushing any commit (or use the Vercel UI "Redeploy"). |
| See backend logs | `/Users/valorkopeny/.local/bin/railway logs -n 100` (after linking the project) |
| See backend deploy status | https://railway.com/project/8979a89d-75ee-40f7-a47f-7a5d7ecaa2b2 → service `crypto-news-curator-backend` → Deployments |
| See frontend deploy status | https://vercel.com/team_kYZ8yndpCmXg5hf3sDSUQ6tZ (browse to `crypto-news-frontend`) |
| Add a new brand logo | Upload through the in-app "Upload Logo" form — that hits `POST /api/cover-generator/upload-logo` which writes to BOTH local `uploads/png-logos/` AND Supabase `logos/<SYMBOL>.png`. Then the new symbol shows up in the dropdown. |
| Add a new full-mark logo (mark + wordmark) | Same as above but name it `<SYMBOL>_FULL` (e.g. `SOLANA_FULL`, `HEDERA_FULL`, `RIPPLE_FULL`). The `_FULL` suffix is the convention for full-logo variants and they appear as separate dropdown entries. |
| Rotate the Wavespeed API key | New key → `railway variables --set "WAVESPEED_API_KEY=wsk_live_..."` → Railway auto-redeploys. No frontend change needed. |

## 🚨 Hard rules
1. **GitHub `main` is source of truth.** Never deploy with `vercel --prod` directly — it desyncs main from live and creates the same mess we just cleaned up.
2. **Frontend changes**: edit files in `/Users/valorkopeny/crypto-news-frontend`, `git add && commit && push`. Vercel auto-deploys. Done.
3. **Backend changes**: edit files in `/Users/valorkopeny/crypto-news-curator-backend`, `git add && commit && push`. Railway auto-deploys from `main`. Done. (Do NOT use `railway up` — see below.)
4. **Never touch any file listed under DEPRECATED below.** They are not in the live code path. Modifying them does nothing except create confusion.
5. **Do not touch ValtronXRP-owned projects.** ValtronXRP is just the GitHub identity used to push to Genfinityllc-owned repos.

## 🟢 LIVE files — these are the ONLY ones that run in production

### Backend (`/Users/valorkopeny/crypto-news-curator-backend/`)
| File | Role |
|---|---|
| `src/server.js` `:1495-1680` | `POST /api/cover-generator/generate` — main entry |
| `src/server.js` `:1533-1583` | **STRICT LOGO GUARD** — returns 422 if requested symbol has no uploaded PNG (local or Supabase). Never lets Wavespeed invent a logo. |
| `src/server.js` `:1547-1563` | OG Color palette pre-extraction (Phase 3) — pulls dominant colors from PNG and passes to style builder |
| `src/server.js` `:947` | `POST /api/cover-generator/upload-logo` |
| `src/server.js` `:1208-1240` | **Phase 4** `POST /api/cover-generator/upload-reference` — multer + Sharp PNG normalize → uploads to `logos/references/ref_<ts>_<rand>.png` in Supabase (we reuse the existing `logos` bucket because `createBucket` on this project fails with the service role). Returns `{success, referenceImageUrl, width, height, sizeKb}`. |
| `src/server.js` `:1626-1726` | **Phase 4** ref-mode prompt synthesis — when `referenceImageUrl` is present, bypasses the named style template, builds prompt with either `style_reference` or `composition_restyle` block, still calls `buildColorDirectives()` so color selectors apply. `customPrompt` is appended verbatim with "ADDITIONAL USER INSTRUCTIONS" prefix in BOTH ref-mode and classic style-mode. |
| `src/server.js` `:1422` | `GET  /api/cover-generator/networks` (logo dropdowns) |
| `src/server.js` `:1209,1317` | logo-info, logo-preview |
| `src/server.js` `:1681,1909,2057,2119,2204,2239,2438` | save / diagnostics / table setup |
| `src/services/controlNetService.js` | `generateWithAdvancedControlNet()` → calls Wavespeed Nano-Banana-Pro at `:1129` |
| `src/services/styleCatalogService.js` | Style prompt builder. Accepts dual colors at `:576`, palettesBySymbol at `:511` (7th arg). Public `buildColorDirectives(colorOverrides)` helper at `:1064` extracts color-directive logic so Phase 4 ref-mode can reuse it. |
| `src/services/controlNetService.js` `:1117-1133` | **Phase 4** Wavespeed payload builds `images: [logoUrl, referenceImageUrl?]` array. Second image is appended only when ref-mode is active. |
| `src/services/logoPaletteService.js` | **NEW (Phase 3)** — Sharp-based dominant-color extraction from logo PNGs. Returns `[{ hex, rgb, name, share }]`. Has color-variant resolver (prefers `Uphold-1.png` over `Uphold.png`, `BTC.png` over `BITCOIN.png`). |
| `src/services/svgLogoService.js` | Loads logos from Supabase + crypto detection |
| `src/services/watermarkService.js` | Genfinity watermark overlay (LOCKED 1800x900) |
| `src/routes/style-catalog.js` | Style picker API for frontend |
| `src/routes/logos.js` | Logo management |
| `src/routes/client-networks.js` | Client network metadata |
| `src/config/supabase.js` | Supabase client init |

### Frontend (`/Users/valorkopeny/crypto-news-frontend/`)
| File | Role |
|---|---|
| `src/pages/CoverGenerator.js` | The entire cover generator UI |
| `src/lib/api.ts` (and inline `fetch`) | Talks to backend `/api/cover-generator/*` |

### Required Railway env vars
- `WAVESPEED_API_KEY` — current valid key: `wsk_live_9Nw8s-...` (set 2026-06-15)
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `FIREBASE_*`
- `OPENAI_API_KEY` (legacy paths only)

## 🔴 DEPRECATED — DO NOT EDIT, DO NOT CALL, DO NOT REFACTOR

### Backend services (all dead)
- `src/services/runpodLoraService.js` — **RunPod is NOT used**
- `src/services/hbarLoraService.js`
- `src/services/hfSpacesLoraService.js`
- `src/services/loraAiService.js`
- `src/services/universalLoraService.js` (+ `_old.js`)
- `src/services/trainedLoraService.js`
- `src/services/workingLoraService.js`, `workingLoraGenerator.js`
- `src/services/freeLoraService.js`
- `src/services/fixedUniversalLoraService.js`, `simpleFixedLoraService.js`, `ultraFixedLoraService.js`
- `src/services/multiProviderSDXL.js`
- `src/services/coverGenerationService.js` (old OpenAI path)
- `src/services/vectorFusionService.js`, `vectorNativeService.js`
- `src/services/directSvgRenderingService.js`
- `src/services/twoStepLogoService.js`
- `src/services/coinCompositorService.js`
- `src/services/controlNetService.js` `:4307-4310` only — embedded RunPod fallback (the REST of `controlNetService.js` IS live, just that block is dead)

### Backend routes (mounted in server.js but never used by frontend)
- `/api/ai-cover` → `src/routes/ai-cover.js`
- `/api/lora-archive` → `src/routes/lora-archive.js`
- `/api/direct-svg`, `/api/direct-svg-test`
- `/api/two-step-logo`
- `/api/controlnet-png`
- `/api/coin-compositor`
- `/api/universal-styles`
- `/api/vectorfusion`, `/api/vector-native`

### Whole dead directories
- `hf-spaces-deployment/` — HuggingFace LoRA training
- `ai-cover-generator/` (the nested one inside this repo) — old Python generator
- `training-data/` — LoRA training data
- `scripts/fix-*.js`, `scripts/replace-*.js` — one-off image regen scripts

### Dead markdown docs (ignore them)
`AI_COVER_IMAGE_GENERATOR*.md`, `DEPLOY_HF_SPACES_NOW.md`, `DEPLOY_PURE_LORA_ONLY.md`, `FIX_HF_SPACES_NOW.md`, `FIX_SDXL_LORA_LOADING.md`, `HUGGING_FACE_SETUP.md`, `ULTRA_LORA_TRAINING_PLAN.md`, `URGENT_DEPLOYMENT_SOLUTION.md`, `VALOR_APPROVED_SYSTEM.md`, `PRODUCTION_SNAPSHOT.md`

### Dead Railway env vars
`RUNPOD_ENDPOINT_URL`, `RUNPOD_API_KEY`, `HF_SPACES_LORA_URL`, `HUGGINGFACE_API_KEY`, `FORCE_LORA_FALLBACK`, `AI_COVER_GENERATOR_URL`, `AI_SERVICE_URL`

## 🔒 LOCKED — Do not modify

### Watermark + dimensions
- Output is exactly **1800 × 900**
- Watermark anchored bottom-center, 5px beyond bottom edge:
  ```javascript
  leftPosition = Math.round((1800 - watermarkWidth) / 2);
  topPosition  = 900 - watermarkHeight + 5;
  ```
- Implementation: `src/services/watermarkService.js` + Sharp resize step in `controlNetService.js`

### Network/symbol detection (working — don't break)
- "aave" → Aave ghost
- "ripple" / "xrp" → XRP
- "bitcoin" → BTC (only when actually mentioned)
- Strong anti-Bitcoin prompts for non-BTC articles

## 🛠 Railway CLI is broken on this Mac (2026-06-16)

`railway up` (and `railway up --ci`, `railway up --detach`, `railway up --verbose`) all hang indefinitely at `Indexing...` and eventually die with exit 137. Tried excluding `uploads/reference-images/`, `uploads/logo-backup/`, and `.git/` in `.railwayignore` — no improvement.

**You do not need it.** Backend Settings → Source is already connected to `Genfinityllc/crypto-news-curator-backend` branch `main` with "Auto deploys when pushed to GitHub" enabled. Verified live 2026-06-16 — commit `e085455` (Phase 2 backend) was already running on Railway by the time we tested. Just `git push origin main` and wait ~2 min.

To see deploy status: https://railway.com/project/8979a89d-75ee-40f7-a47f-7a5d7ecaa2b2 → service `crypto-news-curator-backend` → Deployments tab.

## 📜 What happened on 2026-06-15 (read if confused later)

- Wavespeed API key was rotated/invalid → 401 errors. Set new key `wsk_live_9Nw8s-...` on Railway. Fixed.
- Supabase project was paused for billing → DNS failures → no logos. User added credits. Fixed.
- `UPHOLD_FULL` file was misnamed `UPHOLDFULL_FULL.png` on Supabase → upload bug. Not fixed in code yet (cosmetic).
- The frontend `-ruddy` was running a build (`main.76e2ac61.js`, May 31) that contained features **never committed to GitHub** — dual color slots + Reuse Style. These had been deployed via direct `vercel --prod` from local. We:
  1. Verified the local stranded diff = the live bundle (toast string "Style settings loaded" matched verbatim)
  2. Committed it as `da7ea84` on `main`
  3. Pushed to GitHub
  4. Vercel auto-rebuilt from main → bundle `main.fb3f4041.js` is now live and git-driven
- Granted `ValtronXRP` Write access to both Genfinityllc repos so `git push` works from this Mac without token juggling.

## 🗺 Roadmap (in progress — user requested)
- [x] Sync GitHub main with live (done 2026-06-15)
- [x] Inventory live vs deprecated code (this file)
- [x] **Glow None/Transparent** (done 2026-06-16) — frontend `∅` toggle per-logo Glow + global Accent (commit `060e2f6` on frontend). Backend `'none'` sentinel handling in `styleCatalogService.js` via new `_stripGlow()` helper + conditional directives (commit `e085455` on backend). Verified live on both Vercel + Railway.
- [x] **OG Color runtime palette** (done 2026-06-16, commit `0c1e9fd`) — new `logoPaletteService.js` extracts dominant colors from logo PNG via Sharp, filters out transparent/near-white/near-black/low-saturation pixels, returns hex + HSL-based human name (`vivid blue #1050f0`). Generator route pre-extracts for any og_color logo and passes a `palettesBySymbol` map to `styleCatalogService.getStylePrompt`. Both per-logo-array and legacy single-logo paths inject "the actual brand colors for SYMBOL are: …" into the prompt. **Color-variant resolver** prefers `Uphold-1.png` over `Uphold.png` and `BTC.png` over `BITCOIN.png` because the standard files are mono silhouettes. Verified live: `🎨 logoPalette COINBASE: vivid blue(#1050f0, 99%)`.
- [x] **Strict uploaded-logo guard** (done 2026-06-16, commit `0c1e9fd`) — generator route returns HTTP 422 `{error: "missing_logo", missingSymbols: […]}` if any requested symbol has no uploaded PNG locally or in Supabase. Verified: `POST /generate {network:"FAKESYMBOL123"}` → 422 instantly. The cover generator NEVER invents or guesses logos — user must upload first.
- [x] **Reference image + custom prompt — Phase 4** (done 2026-06-16, commits `3537b24` backend + `84cca1b` frontend + `ce22119` bucket fix). Collapsible "Reference Image + Prompt" section ABOVE "Choose a Style" in the cover generator UI. User uploads a reference PNG/JPG → backend normalizes via Sharp → stores in `logos/references/...` in Supabase → returns public URL. User picks behavior chip: **Style Reference** (mimic aesthetic only, ignore composition) or **Composition Restyle** (keep layout, restyle materials). When `referenceImageUrl` is set, the named style template is **bypassed**, but color selectors still apply via the public `buildColorDirectives()` helper. The custom prompt textarea is appended verbatim with "ADDITIONAL USER INSTRUCTIONS" prefix and works in BOTH ref-mode and classic style-mode. Strict logo guard (Phase 3.5) is still enforced. Wavespeed payload now sends `images: [logoUrl, referenceImageUrl]` — logo is always the primary subject. Verified both modes end-to-end on Railway with BTC + custom prompts.
- [x] **PURE REF mode + Generate-button fix — Phase 4-ext A/B** (done 2026-06-17). When `backgroundOnly=true` (no network/style selected) AND a reference image + custom prompt are supplied, the backend skips the black-canvas primary image and sends ONLY the ref image as input. Frontend Generate button now enables on `(network || style || (refImageUrl && customPromptText.trim()))`. Commit `e0fc28a` (frontend).
- [x] **OG color preservation under ref mode — Phase 4-ext2** (done 2026-06-17, commits `0f113cf` + `e1c200e` + `baaa6fb`). The ref-mode LOGO+REF branch now ALSO calls `logoPaletteService.extractPaletteForSymbol()` for any og_color logo (previously only the named-style branch did). The first input image is explicitly named as the "COLOR AUTHORITY" in the prompt, an "ABSOLUTE LOGO BASE-COLOR LOCK" directive is injected, and ref images are scoped to "BACKGROUND / SCENE / ENVIRONMENT ONLY". Wording allows scene-driven reflections/highlights/specular glints on the logo (3D rendering preserved) while forbidding hue-shift/tint of the underlying brand colors.
- [x] **Full-logo variants** (done 2026-06-17). `SOLANA_FULL`, `HEDERA_FULL`, `RIPPLE_FULL` uploaded to Supabase + local — appear as separate dropdown entries from their mark-only counterparts. Convention: `<SYMBOL>_FULL` suffix. Use the in-app uploader to add more.
- [x] **Multi-image references + drag-and-drop — Phase 4-ext3** (done 2026-06-17, commits `e5dd258` backend + `9677ce5` frontend). Reference section supports up to **14** ref images (Wavespeed Nano-Banana-Pro hard cap). Frontend has a drag-and-drop zone (`RefDropZone`) and a thumbnail grid (`RefThumbGrid`) with per-image remove + "remove all". Backend accepts `referenceImageUrls` array (and keeps legacy `referenceImageUrl` for back-compat). `controlNetService.generateWithNanoBananaPro` builds `images: [logoUrl, ...refs[..13]]` (LOGO+REF) or `images: [...refs[..14]]` (PURE REF). Prompt synthesis describes N images ("images 2 through N+1"). See `src/server.js` `:1533-1763` and `src/services/controlNetService.js` `:1117-1144`.

## Logos must stay transparent (2026-10-05)
- Logo PNGs are stored and sent to Nano-Banana WITH their alpha channel. Never flatten a logo onto black (or any background): that was the root cause of garbled, redrawn logo shapes. Both flatten steps (upload in `server.js`, generation in `controlNetService.js`) were removed and the whole library was converted to transparent.
- Monochrome marks should be WHITE on transparent. Brand-coloured logos keep their real colours on transparent.
- Fine line-art logos (example: the hatched Canton mark) cannot be reproduced faithfully by the model. Add a bold solid alternative as a second entry (example: `CANTONSIMPLE`).
- `getPngLogo` prefers the committed files in `uploads/png-logos/` over Supabase, so fix a logo in BOTH places.
- **`HASHPACK_COLOR`** (added 2026-11-19 at the owner's request): HashPack's colour logo, lavender mark `#7A7AB8` with the white wordmark, taken from hashpack.app's own header (`logo-colour-white.svg` on their site's file host) and drawn at 2400x469 on transparent. It is a committed file in `uploads/png-logos/` with a `COMPANIES_LIST` entry in `src/server.js`; it is NOT in Supabase (the committed file is what the preview route and `getPngLogo` read first).
- **`CROWDBRAIN` and `CROWDBRAIN_WHITE`** (added 2026-11-23 at the owner's request): CrowdBrain's logo, taken from the vector in crowdbrain.ai's own page (the `cb-lockup` symbol in its header) and drawn at 2400x343 on transparent. `CROWDBRAIN` is the violet mark `#6c64dd` with the white wordmark (the site's docked header and footer); `CROWDBRAIN_WHITE` is all white (the site's header over its hero). Committed files in `uploads/png-logos/` with `COMPANIES_LIST` entries in `src/server.js`; NOT in Supabase. The stepped diagonals of the "w" are in the site's own outline.
- **Logos must be fully solid** (owner 2026-11-25: "I want the logos to be 100% solid with no transparency" and "for logos that we dont have a 100 opacity for we need to find them online as svgs, not try to erase backgrounds with tools where it messes them up"). 24 of the 92 library files were see-through INSIDE their shapes (Solana's mark, PayPal, Google, Circle, Nasdaq and more), so a cover showed through their colours. 17 were replaced that day with each brand's own file drawn at a large size on a clear background: committed files in `uploads/png-logos/` (SOLANA_FULL, PAYPAL_FULL, GOOGLEMARK, MASTERCARD, NASDAQ_FULL, NYSE_FULL, CIRCLE_FULL, ALLFUNDS_FULL, TOSSBANK_FULL, JUPITER, JUPITERFULL_FULL, HELIUS_FULL, IOBUILDERS_FULL, TELLER_FULL, TELLER1_FULL, CLAYNOSAURZ_FULL, COMICBOOK_FULL), which the preview route and `getPngLogo` read before the old Supabase copies. Where each came from, the source files and the script that drew them are in `uploads/logo-sources/` (`SOURCES.md`). **When adding or fixing a logo: get the brand's own vector (site header, press kit, official repository, then Wikimedia Commons), draw it with that script, and check that its inside is solid. Do not repair a see-through file with a background-removal or alpha tool.** Still not replaced (no solid official file of the same design found): HASHGRAPHONLINE_FULL, HOL, FERROX_FULL, THINKINGCRYPTO, THINKINGCRYPTOFULL_FULL.
- Deploys run on Node 24 (`package.json` engines + `nixpacks.toml`). Railway is the only live backend. Any Render or Vercel project pointed at this repo is stale.

## Design Studio + background-only generation (2026-11-16)
- **Design Studio** (frontend `src/components/coverStudio/`): a fabric.js canvas editor at a true 1800x900. Background + any number of logos + text, all draggable and scalable, exported in the browser. Backgrounds come from flat procedural templates (`backgrounds.js`, no AI, no credits), an AI backdrop, or an image.
- **Backdrop mode**: a request with no `network` and a `styleId` now uses `styleCatalog.getBackdropPrompt()` (environment + material + composed negative space, zero logo language) instead of the logo prompt with phrases deleted. Optional body field `copySpace`: `center | left | right | bottom | none`.
- Background-only with no reference images goes to the Nano-Banana-Pro **text-to-image** endpoint (`.../nano-banana-pro/text-to-image`), not `edit` with a black canvas. It falls back to the old edit path if the submit fails.
- `POST /api/cover-generator/upload-composed` (multipart field `image`, optional `label`): stores a Studio export in the `cover-images` bucket and returns `{ imageUrl }`, which the frontend then passes to `/save`.
- The Studio draws the watermark itself (asset copied to the frontend `public/genfinity-watermark.png`, same locked placement: centred, 5px low). It requests AI backdrops with `skipWatermark: true` so the watermark always sits above the logos.

## 🐛 Known Supabase quirk (2026-06-16)
- This project's service-role key CANNOT create new buckets — `createBucket()` returns `StorageUnknownError`. Solution: reuse existing buckets and use folder prefixes. Phase 4 stores ref images in `logos/references/...` not in a separate bucket.
- After **un-pausing** the Supabase project, expect ~2 minutes of `status:544 "The connection to the database timed out"` on writes while Postgres warms up. Reads from the public CDN keep working throughout. Just wait and retry.

## Backdrop-only styles for the Studio (2026-11-23)
- Owner asked for more AI backdrop styles for the Interview Cover Studio: all on a black base (no light backgrounds), different from the existing ones, ten samples to approve or deny. **Result: only `bd03_particle_wave` (Particle Wave, a rolling surface of tiny points of light) was approved and is live.** Denied and deleted the same day: Black Silk, Black Marble, Paper Cut Layers, Black Dunes, City Bokeh, Blind Emboss, Oil Ripple, Machined Fins, Obsidian. Do not offer those again; the owner's taste here runs to clean digital light on black, not photographed materials (my reading of one pick out of ten, not something the owner said).
- **Second batch (2026-11-23), verdict 2026-11-24: `bd16_dither_bloom` (Dither Bloom) and `bd17_photocopy_grain` (Photocopy Grain) approved and live** ("16 and 17 are ok"). Denied and deleted: Folded Planes, Edge-lit Slabs, Column Field, Sliced Forms, Halftone Fade, Slat Wall, Lit Alcoves, Stepped Frame. Do not offer those again. So three styles are in the Studio's "Black backdrops" group: Particle Wave, Dither Bloom, Photocopy Grain.
- **What the owner has said about backdrops, in their words.** First batch: a "stock wallpaper look"; "I dont want light in the middle of them... like a spotlight look is bad and super photographic is bad". Second batch: "I dont want a floor or a plane where there is a reflection of the items in the scene"; on Photocopy Grain, "I dont like the light grey patches". The brief carries a rule for each: "NO LIGHT IN THE CALM AREA", "NO FLOOR AND NO REFLECTIONS", a colour line that allows only black and near-black charcoal beside the two accents, and `backdrop.kind` picks a quality line (`BACKDROP_QUALITY`) that asks for a stylised render or flat print, not a photograph. Never write a floor, a ground plane, a mirror surface or grey patches into a new brief. Both survivors of the second batch are flat print textures (kind `print`); every 3D form and every studio set was turned down (my reading: flat, two-dimensional graphics on black are the safe direction; the owner did not say that).
- Photocopy Grain's brief was rewritten on 2026-11-24 to remove the grey patches (solid even toner, fine near-black grain only). One generation approved by the owner on 2026-11-24 confirmed it (colourless areas lighter than near-black fell from 11 percent of the frame to 0.01 percent) and is now its sample picture. In that sample the ink runs round all four edges, not two; the owner has not commented on that yet.
- A backdrop-only style is an entry at the end of the style list in `src/services/styleCatalogService.js` with `backdrop: { look, scene }` instead of a logo template. `getBackdropPrompt` sends it to `_blackBackdropPrompt`: the brief always starts with "Abstract editorial BACKDROP plate" (that opening is how `controlNetService` knows not to scrub it), the base is ALWAYS pure black whatever `bgColor` the request carries, and `{{A1}}` / `{{A2}}` in the scene are the two accent colours (the request's `elementColor` / `accentLightColor`, else the style's `defaultColors`). A `prompt()` is made for such entries in the constructor so older callers still work.
- Flags: `internal: true` keeps them out of the Cover Generator picker, its category chips and the article style rotation for good. `backdropOnly: true` is what the Studio's AI backdrop tab lists (under "Black backdrops"). `pending: true` hides a style there too: use it for a new style until the owner has approved its sample.
- The sample picture `style-examples/<id>.png` (900x506) is the real first generation of the style with its default colours and centre clear space, made through the live `generate-async` route. Ask before generating samples: each one is a paid generation (the ten on 2026-11-23 were approved beforehand).

## Cover Studio server side: shared backgrounds + account drafts (2026-11-18)
- Routes in `src/routes/studio.js`, mounted at `/api/cover-generator/studio` (before the other cover-generator router). Frontend side: `src/components/coverStudio/studioServer.js`.
- **Sign-in is really verified here.** `verifyIdToken` checks the Firebase ID token's signature against Google's published keys (no service account needed; project `crypto-curator`, or `FIREBASE_PROJECT_ID`). The older routes in `server.js` only decode the token without checking it; do not copy that pattern for anything private.
- **Owner accounts** (`isOwner`): the two emails the owner named on 2026-11-18, listed in `OWNER_EMAILS` at the top of `src/routes/studio.js`; also the existing `MASTER_ACCOUNT_UID` / `MASTER_ACCOUNT_EMAIL` / `MASTER_ACCOUNT_HINT`, or the optional comma lists `STUDIO_OWNER_EMAILS` / `STUDIO_OWNER_UIDS`. **All owner accounts share ONE set of drafts** (`homeOf` returns the same space for each); every other account has its own. An owner's drafts saved before it was an owner are moved into the shared space the next time it lists drafts (`adoptPersonalDrafts`). An email only protects anything once an account exists for it: sign-up does not verify emails, so an owner email with no account yet could be registered by someone else. Only the owner can add or remove shared backgrounds. `GET /studio/me` tells the frontend `{ signedIn, isOwner }`.
- **Shared backgrounds** (`GET/POST /studio/backdrops`, `DELETE /studio/backdrops/:id`): the list everyone sees in the Studio's Background > Image tab, signed in or not. Adding takes the address of an image already in this project's `cover-images` bucket and COPIES it (JPEG + small thumbnail) into `cover-images/studio/shared/`.
- **Why the copy matters:** `cleanupOldCoverImages` deletes files in the ROOT of `cover-images` after 7 days (startup and every 6 hours). It does not look inside folders, so everything under `studio/` is kept. Generated covers and backdrops in the root still expire after a week.
- **Account drafts** (`/studio/drafts...`): only for a signed-in account, and only that account's. Files are in `cover-images/studio/drafts/<key>/<draftId>/`, `<key>` being an HMAC of the account id (constant in the route file: changing it orphans every draft). A draft is `cover_<time>.json` plus its pictures `p_<sha256>.png|jpg`, uploaded one by one and only when the server does not have them yet; a per-account `index_<time>.json` holds names, dates and thumbnails.
- **Never overwrite a changing file in place.** This storage can return the OLD contents of an overwritten or deleted file for a moment (seen in testing: a list read right after a write came back stale). So lists and covers are written as a new `<name>_<time>.json` each save and the newest is picked from the folder listing (`readVersioned` / `writeVersioned`).
- **Privacy, honestly stated:** the `cover-images` bucket is public-by-address and this project cannot create a private bucket from the server. Drafts are private because their addresses cannot be guessed and nothing but these verified routes ever lists or reveals them. If the owner creates a private bucket in the Supabase dashboard, point `BUCKET` for drafts at it.
- Limits: 300 shared backgrounds, 300 drafts per account, 80 pictures per draft, 10 MB per picture (the bucket's own file limit).
- **Backdrops used to vanish on every deploy (fixed 2026-11-18).** `controlNetService.js` built the storage file name with `logoSymbol.toLowerCase()`; a backdrop has no logo, so that threw, the error was swallowed, and the image stayed at its fallback address on Railway's temporary disk (`/temp/controlnet-images/<id>.png`), which every deploy wipes. The owner lost twelve backdrops this way on 2026-11-18. The name now falls back to `backdrop_...`. `POST /studio/backdrops` also accepts such a temporary address (it reads the file from the folder, name checked) in case an upload ever fails again.
- **Lost backdrops were brought back (2026-11-18).** `recoverBackdrops` in `src/routes/studio.js` reads the image service's own history (`POST https://api.wavespeed.ai/api/v3/predictions`, kept about 7 days), takes the `text-to-image` results and copies them into the shared backgrounds. It ran once on the live server as `recovery-v1` and restored 24 images; its report is the `recovery-v1_<time>.json` file in `cover-images/studio/shared/`. It only runs where `WAVESPEED_API_KEY` is set and only once per `RECOVERY_RUN` name: change that name to run it again.
- **Bookmarks (2026-11-18).** The news pages' bookmark routes in `routes/firebase-auth.js` need Firebase Admin with a service account, which Railway has never had (`/api/cover-generator/auth-status` shows `firebase.initialized: false`), so they refused everyone. `routes/studio.js` exports a second router, `bookmarks`, mounted at `/api/firebase-auth` ABOVE the old one in `server.js`: `GET/POST /bookmarks`, `DELETE /bookmarks/:id`, with the verified sign-in, one list per account in `cover-images/studio/bookmarks/<key>/`, the article's card fields stored with each bookmark. Every other `/api/firebase-auth/*` address still falls through to the old router (and still needs Firebase Admin).

## Client News (2026-11-18)
- **The clients are listed in ONE place: `src/data/clients.js`.** Owner's list on 2026-11-18: Hedera, HashPack, XDC, Solana, Canton (Algorand, Constellation and Axiom are no longer clients). Tagging, retention, the feed, the counts and the site's buttons all read that file. To add or drop a client, change `CLIENTS` there and nothing else. Do not put a client name anywhere else in the code again: the old list was copied into eight files, which is how it went stale.
- **Feed:** `GET /api/client-news` (`?client=hedera|hashpack|xdc|solana|canton`), in `src/routes/client-news.js`. It answers with the articles AND the client list with logos and counts, so the site never has to match two requests. It reads the `articles` table directly (two queries, kept in memory for 60 seconds): rows stored under a client for 30 days, plus the last 4 days of everything else, and lists an article under every client its headline or opening lines name (`matchClients`). Solana must be in the headline (it is mentioned in passing everywhere). "Canton" alone only counts next to finance or crypto words and never next to a place (Ohio, Guangzhou, a Swiss canton). The same story from two publishers' feeds is listed once. `/api/enhanced-client-news` (used to answer 500), `/api/fast-news/client-counts` and `/api/client-networks/buttons/config` now give the same clients and the same numbers.
- **Why the count read 0 before:** the counts asked only for articles with a picture, and no stored article had one (`transformArticleForSupabase` never saved `cover_image`). It is saved now when the feed supplies one.
- **Why client stories were so few before** (three separate causes, all fixed in `newsService.js`, `intelligentArticleManager.js`, `articlePurgeService.js`):
  1. A rejected item in a feed was returned as `false`, slipped past a `!== null` filter and threw on the next line for Google News feeds, which dropped the WHOLE feed. Any big client search died this way on almost every run.
  2. Only the newest 200 articles of a run were kept, and at 500 stored rows the 50 oldest of any kind were deleted. A client's stories are older and rarer than general news, so they were pushed out both times. General and client articles are now counted apart (500 general, 750 client, 150 per client) and every client article of a run is kept.
  3. Half the client feeds were dead (404 or blocked). The working ones, checked 2026-11-18, are in `clients.js` next to each client. A client's own blog or press feed is marked `official`: its posts skip the crypto headline check (a Canton post titled "One Giant Leap" is still Canton news).
- **Retention:** general news 4 days, client news 30 days (`CLIENT_RETENTION_DAYS`).
- **Pictures:** Google News items come without one and their links cannot be turned into the publisher's address reliably. For client rows with no picture and a real address, `fillPictures` (in the client-news route) reads the page's own preview picture (`og:image`), 12 rows at most every 5 minutes, each row once per server start. Everything else shows the client's logo on the card (`fallback_logo`).
- Search results that are not articles (price pages, "how to buy", share tickers, token-sale promotion) are dropped by `isNotNews` in `clients.js`. Price-prediction pieces are dropped too (owner, 2026-11-18: "drop the price prediction articles"): headlines with "price prediction" or "price forecast", "could be worth", "will X hit $N?", "buy signal". News about a price move, or about a named firm's published target (Bitwise's Solana model), stays. The feed hides them even when they are already stored; the client feeds and searches no longer store them.
- Test without writing anything: `matchClients` has a small table of headlines, and the ingestion can be run on the real feeds with nothing stored (`fetchRealCryptoNews()` only returns the list). Done on 2026-11-18: 167 client articles in one run (Solana 59, Canton 52, Hedera 31, XDC 22, HashPack 3) against 8 on the live site before.
