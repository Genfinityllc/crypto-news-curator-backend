# Cover Generator — Source of Truth & Deployment Notes

Last reconciled: 2026-06-15

## Live URLs
- **Frontend (LIVE)**: https://crypto-news-frontend-ruddy.vercel.app
- **Backend  (LIVE)**: https://crypto-news-curator-backend-production.up.railway.app

## Source of Truth (GitHub)
| Component | Repo | Branch | Auto-Deploy |
|---|---|---|---|
| Frontend | `Genfinityllc/crypto-news-frontend` | `main` | ✅ Vercel (push → live in ~2 min) |
| Backend  | `Genfinityllc/crypto-news-curator-backend` | `main` | ❌ NOT git-linked — uses `railway up` |

**Rule**: GitHub `main` is the canonical source for both. Never deploy directly via `vercel --prod` or anything that bypasses git — it desyncs main from live.

### To enable git auto-deploy for backend (recommended one-time setup)
1. Open `https://railway.com/project/8979a89d-75ee-40f7-a47f-7a5d7ecaa2b2`
2. Click service `crypto-news-curator-backend`
3. Settings → Source → **Connect Repo** → `Genfinityllc/crypto-news-curator-backend` branch `main`
4. After this, `git push origin main` auto-deploys backend just like frontend.

## Deployment Workflow

### Frontend (git-driven, auto)
```bash
cd /Users/valorkopeny/crypto-news-frontend
git add <files> && git commit -m "..." && git push origin main
# Vercel auto-deploys to crypto-news-frontend-ruddy.vercel.app
```
- The Vercel project is linked under team `team_kYZ8yndpCmXg5hf3sDSUQ6tZ` (NOT the `valors-projects-e78ccc5f` team — that team has a stale duplicate project, ignore it).
- Local `.vercel/project.json` already points to the correct project.

### Backend (manual until git source is connected)
```bash
cd /Users/valorkopeny/Desktop/crypto-news-curator-backend
git add <files> && git commit -m "..." && git push origin main
/Users/valorkopeny/.local/bin/railway up
```
Verify link first: `railway status` should show:
```
Project: intelligent-contentment
Service: crypto-news-curator-backend
Environment: production
```
If not linked: `railway link --project intelligent-contentment --service crypto-news-curator-backend --environment production`

**Railway project info**
- Account: `support@genfinity.io`
- Project: `intelligent-contentment` (ID `8979a89d-75ee-40f7-a47f-7a5d7ecaa2b2`)
- Service: `crypto-news-curator-backend` (ID `d20f230c-6855-4641-a026-57f81e649875`)

## LIVE Cover Generation Stack (use these files)

The cover generator currently in production uses **Wavespeed Nano-Banana-Pro** (`api.wavespeed.ai/api/v3/google/nano-banana-pro/edit`).

### Backend — LIVE files
| File | Role |
|---|---|
| `src/server.js` lines 1495-1680 | `/api/cover-generator/generate` route handler |
| `src/server.js` line 947 | `/api/cover-generator/upload-logo` |
| `src/server.js` line 1422 | `/api/cover-generator/networks` (logo dropdowns) |
| `src/services/controlNetService.js` | `generateWithAdvancedControlNet()` → calls Wavespeed Nano-Banana-Pro |
| `src/services/styleCatalogService.js` | Style template + color override prompt builder |
| `src/services/svgLogoService.js` | Logo loader from Supabase (crypto detection) |
| `src/services/watermarkService.js` | Genfinity watermark overlay (1800x900) |
| `src/routes/style-catalog.js` | Style picker API |
| `src/routes/logos.js` | Logo management |
| `src/routes/client-networks.js` | Client network metadata |
| `src/config/supabase.js` | Logo storage (Supabase) |

### Required environment variables (Railway)
- `WAVESPEED_API_KEY` — Nano-Banana-Pro auth (current: `wsk_live_9Nw8s-...`)
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` — Logo storage
- `FIREBASE_*` — Auth
- `OPENAI_API_KEY` — used by some old paths only (legacy)

### Frontend — LIVE files
| File | Role |
|---|---|
| `src/pages/CoverGenerator.js` | The whole cover generator UI |
| `src/lib/api.ts` or fetch calls inline | Talks to `/api/cover-generator/*` |

## DEPRECATED — DO NOT MODIFY OR USE

All of the following are dead code paths kept only as historical artifacts. Do not extend, do not refactor, do not call:

### Backend services (dead)
- `src/services/runpodLoraService.js` — RunPod is **NOT used**, never call this
- `src/services/hbarLoraService.js`
- `src/services/hfSpacesLoraService.js`
- `src/services/loraAiService.js`
- `src/services/universalLoraService.js`
- `src/services/universalLoraService_old.js`
- `src/services/trainedLoraService.js`
- `src/services/workingLoraService.js`
- `src/services/workingLoraGenerator.js`
- `src/services/freeLoraService.js`
- `src/services/fixedUniversalLoraService.js`
- `src/services/simpleFixedLoraService.js`
- `src/services/ultraFixedLoraService.js`
- `src/services/multiProviderSDXL.js`
- `src/services/coverGenerationService.js` (old OpenAI path)
- `src/services/vectorFusionService.js`
- `src/services/vectorNativeService.js`
- `src/services/directSvgRenderingService.js`
- `src/services/twoStepLogoService.js`
- `src/services/coinCompositorService.js`
- `src/services/controlNetService.js` lines ~4307-4310 — embedded RunPod fallback (dead branch)

### Backend routes (dead, but still mounted in server.js — safe to ignore)
- `src/routes/ai-cover.js` (LoRA endpoint — `/api/ai-cover`)
- `src/routes/lora-archive.js` (`/api/lora-archive`)
- `src/routes/direct-svg.js`, `direct-svg-test.js`
- `src/routes/two-step-logo.js`
- `src/routes/controlnet-png.js`
- `src/routes/coin-compositor.js`
- `src/routes/universal-styles.js`
- `src/routes/vectorfusion.js`
- `src/routes/vector-native.js`

### Whole directories that are dead
- `hf-spaces-deployment/` — HuggingFace Spaces LoRA training (abandoned)
- `ai-cover-generator/` (the nested subdir) — old Python generator (abandoned)
- `training-data/` — LoRA training data (abandoned)
- `style-examples/` — generated style preview images (used as references, not as code)
- `scripts/fix-*.js`, `scripts/replace-*.js` — one-off image regeneration scripts (historical)

### Old markdown docs (informational only — do not follow their instructions)
- `AI_COVER_IMAGE_GENERATOR.md`, `AI_COVER_IMAGE_GENERATOR_UPDATED.md`
- `DEPLOY_HF_SPACES_NOW.md`, `DEPLOY_PURE_LORA_ONLY.md`
- `FIX_HF_SPACES_NOW.md`, `FIX_SDXL_LORA_LOADING.md`
- `HUGGING_FACE_SETUP.md`
- `ULTRA_LORA_TRAINING_PLAN.md`
- `URGENT_DEPLOYMENT_SOLUTION.md`
- `VALOR_APPROVED_SYSTEM.md`
- `PRODUCTION_SNAPSHOT.md` (Feb snapshot — outdated)

### Env vars in Railway that are dead (safe to ignore / can clean up later)
- `RUNPOD_ENDPOINT_URL`, `RUNPOD_API_KEY`
- `HF_SPACES_LORA_URL`, `HUGGINGFACE_API_KEY`
- `FORCE_LORA_FALLBACK`
- `AI_COVER_GENERATOR_URL`, `AI_SERVICE_URL` (points at deprecated nested service)

## LOCKED — Watermark / Output Dimensions

The 1800x900 output size + watermark position is correct and must stay. The implementation lives in:
- `src/services/watermarkService.js` — positioning logic
- `src/services/controlNetService.js` (Wavespeed result handler) — Sharp resize to 1800x900

```javascript
leftPosition = Math.round((1800 - watermarkWidth) / 2);  // Center horizontally
topPosition = 900 - watermarkHeight + 5;                  // 5px beyond bottom edge
```

## Network / Symbol Detection
- Aave: "aave" → Aave ghost symbol
- XRP/Ripple: "ripple" or "xrp" → XRP symbols
- Bitcoin: only when title actually mentions Bitcoin
- Strong anti-Bitcoin prompts for non-Bitcoin articles

## Source-of-Truth History (for future reference)
- 2026-06-15: Synced GitHub `main` with what was already deployed live on `-ruddy`. Live had been built via direct `vercel --prod` from local `CoverGenerator.js` that was never committed (dual color slots + Reuse Style). Now committed as `da7ea84`.
- Going forward, ALL changes must be committed and pushed before deploying. Vercel auto-deploys from `main`.

## Cover Generator Feature Roadmap (in progress)
- [x] Dual color slots (elementColor2, accentLightColor2, lightingColor2)
- [x] "Reuse This Style" / "Reuse Style" buttons on history items
- [ ] **Glow None/Transparent option** — make picker support transparent so glow can be turned off
- [ ] **OG Color runtime palette extraction** — when `og_color` material is selected, extract original logo colors at runtime and feed them into the prompt
- [ ] **Reference image upload + custom prompt** — toolbar section below existing controls; uploads a reference image + free-form prompt ("remove X", "make X larger") and bypasses style template. User picks behavior: composite / replace / style-only
