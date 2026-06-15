# ⚡ CLAUDE: READ THIS FIRST — Cover Generator Source of Truth

> If you are a new Claude session, this card tells you everything. Do not search around for "the real backend" — it is this directory. Do not look at `ai-cover-generator/`, `hf-spaces-deployment/`, or any LoRA/RunPod file — they are dead.

## 📍 Canonical Locations (memorize these)

| Thing | Path / URL |
|---|---|
| **Backend repo (local)** | `/Users/valorkopeny/Desktop/crypto-news-curator-backend` |
| **Backend repo (GitHub)** | `https://github.com/Genfinityllc/crypto-news-curator-backend` branch `main` |
| **Backend live URL** | `https://crypto-news-curator-backend-production.up.railway.app` |
| **Backend deploy** | Manual: `/Users/valorkopeny/.local/bin/railway up` *(not git-auto)* |
| **Frontend repo (local)** | `/Users/valorkopeny/crypto-news-frontend` |
| **Frontend repo (GitHub)** | `https://github.com/Genfinityllc/crypto-news-frontend` branch `main` |
| **Frontend live URL** | `https://crypto-news-frontend-ruddy.vercel.app` |
| **Frontend deploy** | **Git auto** — `git push origin main` → Vercel deploys in ~2 min |
| **Frontend Vercel team** | `team_kYZ8yndpCmXg5hf3sDSUQ6tZ` (NOT `valors-projects-e78ccc5f` — that's stale) |
| **Image API** | Wavespeed Nano-Banana-Pro (`api.wavespeed.ai/api/v3/google/nano-banana-pro/edit`) |
| **Logo storage** | Supabase (project `daqxnvcfmepjzcgfdrdf`) |
| **Railway project** | `intelligent-contentment` (ID `8979a89d-75ee-40f7-a47f-7a5d7ecaa2b2`), service `crypto-news-curator-backend` (ID `d20f230c-6855-4641-a026-57f81e649875`), account `support@genfinity.io` |
| **GitHub auth on this Mac** | `gh auth` is logged in as `ValtronXRP` — has Write access to both Genfinityllc repos (granted 2026-06-15). `git push origin main` just works. |

## 🚨 Hard rules
1. **GitHub `main` is source of truth.** Never deploy with `vercel --prod` directly — it desyncs main from live and creates the same mess we just cleaned up.
2. **Frontend changes**: edit files in `/Users/valorkopeny/crypto-news-frontend`, `git add && commit && push`. Vercel auto-deploys. Done.
3. **Backend changes**: edit files in `/Users/valorkopeny/Desktop/crypto-news-curator-backend`, `git add && commit && push`, then `railway up`. (Or, do the one-time Railway → GitHub source link below to make it git-auto.)
4. **Never touch any file listed under DEPRECATED below.** They are not in the live code path. Modifying them does nothing except create confusion.
5. **Do not touch ValtronXRP-owned projects.** ValtronXRP is just the GitHub identity used to push to Genfinityllc-owned repos.

## 🟢 LIVE files — these are the ONLY ones that run in production

### Backend (`/Users/valorkopeny/Desktop/crypto-news-curator-backend/`)
| File | Role |
|---|---|
| `src/server.js` `:1495-1680` | `POST /api/cover-generator/generate` — main entry |
| `src/server.js` `:947` | `POST /api/cover-generator/upload-logo` |
| `src/server.js` `:1422` | `GET  /api/cover-generator/networks` (logo dropdowns) |
| `src/server.js` `:1209,1317` | logo-info, logo-preview |
| `src/server.js` `:1681,1909,2057,2119,2204,2239,2438` | save / diagnostics / table setup |
| `src/services/controlNetService.js` | `generateWithAdvancedControlNet()` → calls Wavespeed Nano-Banana-Pro at `:1129` |
| `src/services/styleCatalogService.js` | Style prompt builder. Accepts dual colors at `:576`. |
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

## 🛠 Optional one-time setup: enable git-auto-deploy for backend

To bring backend up to the same workflow as frontend (so `git push` deploys it too):
1. Open https://railway.com/project/8979a89d-75ee-40f7-a47f-7a5d7ecaa2b2
2. Click service `crypto-news-curator-backend`
3. Settings → Source → **Connect Repo** → `Genfinityllc/crypto-news-curator-backend` branch `main`
4. After that, drop the `railway up` step. Every push to main auto-deploys.

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
- [ ] **Glow None/Transparent** — picker option that disables glow on the logo (not scene)
- [ ] **OG Color runtime palette** — when material = `og_color`, extract original logo colors and feed them into the prompt at generation time, so brand palette is preserved
- [ ] **Reference image + custom prompt** — collapsible section BELOW the existing toolbar; user uploads a reference image + types a freeform prompt ("remove X", "change color of Y", "make Z larger"). Bypasses style template and uses the image as a starting reference in Nano-Banana. User picks behavior dropdown: composite / replace / style-only.
