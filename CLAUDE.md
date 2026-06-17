# ⚡ CLAUDE: READ THIS FIRST — Cover Generator Source of Truth

> If you are a new Claude session, this card tells you everything. Do not search around for "the real backend" — it is this directory. Do not look at `ai-cover-generator/`, `hf-spaces-deployment/`, or any LoRA/RunPod file — they are dead.

## 📍 Canonical Locations (memorize these)

| Thing | Path / URL |
|---|---|
| **Backend repo (local)** | `/Users/valorkopeny/Desktop/crypto-news-curator-backend` |
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
| Deploy backend code | `git push origin main` from `/Users/valorkopeny/Desktop/crypto-news-curator-backend` → Railway rebuilds in ~2 min |
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
3. **Backend changes**: edit files in `/Users/valorkopeny/Desktop/crypto-news-curator-backend`, `git add && commit && push`. Railway auto-deploys from `main`. Done. (Do NOT use `railway up` — see below.)
4. **Never touch any file listed under DEPRECATED below.** They are not in the live code path. Modifying them does nothing except create confusion.
5. **Do not touch ValtronXRP-owned projects.** ValtronXRP is just the GitHub identity used to push to Genfinityllc-owned repos.

## 🟢 LIVE files — these are the ONLY ones that run in production

### Backend (`/Users/valorkopeny/Desktop/crypto-news-curator-backend/`)
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

## 🐛 Known Supabase quirk (2026-06-16)
- This project's service-role key CANNOT create new buckets — `createBucket()` returns `StorageUnknownError`. Solution: reuse existing buckets and use folder prefixes. Phase 4 stores ref images in `logos/references/...` not in a separate bucket.
- After **un-pausing** the Supabase project, expect ~2 minutes of `status:544 "The connection to the database timed out"` on writes while Postgres warms up. Reads from the public CDN keep working throughout. Just wait and retry.
