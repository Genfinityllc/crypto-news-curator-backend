# PRODUCTION SNAPSHOT - DO NOT DELETE OR OVERWRITE

## Date: February 12, 2026
## Status: LOCKED PRODUCTION VERSION

---

## Deployment URLs
- **Frontend (PRODUCTION):** https://crypto-news-frontend-ruddy.vercel.app
- **Backend (PRODUCTION):** https://crypto-news-curator-backend-production.up.railway.app

## Git Commits (EXACT production state)
- **Frontend:** `dc9a2d3030441e917180331128eb4b56a843ba36` (branch: main)
- **Backend:** `d0661c98d3c45d7703bf9c130e1ac159a154728a` (branch: main)

## Repositories
- **Frontend:** https://github.com/Genfinityllc/crypto-news-frontend
- **Backend:** https://github.com/Genfinityllc/crypto-news-curator-backend

## How to Restore This Exact Version
```bash
# Frontend
cd /Users/valorkopeny/crypto-news-frontend
git checkout dc9a2d3030441e917180331128eb4b56a843ba36

# Backend
cd /Users/valorkopeny/Desktop/crypto-news-curator-backend
git checkout d0661c98d3c45d7703bf9c130e1ac159a154728a
```

---

## Complete Feature List

### Cover Generator Page (`src/pages/CoverGenerator.js` - 1963 lines)

#### 1. Network / Company Selection (up to 3 logos)
- Text input for typing network/company name
- **Network dropdown** (45 networks): BTC, ETH, XRP, SOL, HBAR, ADA, AVAX, DOT, MATIC, LINK, UNI, DOGE, LTC, ATOM, NEAR, ALGO, XLM, SUI, APT, ARB, OP, INJ, SEI, TIA, PEPE, SHIB, BNB, TRX, TON, FIL, XMR, CRO, RUNE, TAO, QNT, ONDO, IMX, DAG, XDC, USDC, USDT, ZEC, CANTON, MONAD, AXELAR
- **Company dropdown** (54 companies): BlackRock, Grayscale, 21Shares, WLFI, Bitmine, MoonPay, NVIDIA, Paxos, Robinhood, HashPack, Kraken, KuCoin, Binance Exchange, BitGo, MetaMask, Magic Eden, Uphold, IMF, CFTC, Aberdeen, Arrow, Archax, Avery Dennison, Blockchain for Energy, Boeing, Confra, Dell, Dentons, Deutsche Telekom, DLA Piper, EDF, Eftpos, GBBC, Google, Hitachi, IBM, IIT Madras, LG Electronics, LSE, Magalu, Mondelez, Nomura, ServiceNow, Shinhan Bank, Swirlds Labs, Tata Communications, Ubisoft, Worldpay, Zain, Axiom, Plug and Play, Raze, Ripple, Coinbase
- **Logo preview** - Shows logo thumbnail + name when a network/company is selected
- **Multi-logo support** - "Add Another Logo" button, up to 3 total, each with Network/Company dropdowns and logo preview
- Fallback hardcoded lists if API is down (all 45 networks + 54 companies)

#### 2. Admin Logo Upload (admin-only: valor.kopeny@cc-ea.org)
- File chooser (PNG/JPEG)
- Symbol input (auto-uppercase)
- Name input
- Network / Company toggle
- **Logo Mark / Full Logo (text) toggle** - Mark saves as `SYMBOL.png`, Full saves as `SYMBOL_FULL.png`
- Upload button sends to `/api/cover-generator/upload-logo`

#### 3. Article Title (optional)
- Text input for article context
- Adds context for more relevant imagery

#### 4. Custom Keyword (optional)
- Text input for style influence (e.g., space, futuristic, wall street)

#### 5. Style Picker with Thumbnails
- Loads 22 styles from `/api/style-catalog`
- Category filter chips (All + categories from API)
- Clickable thumbnail grid with style name labels
- Supabase URL with fallback to API-served images
- Click to select/deselect a style

#### 6. Custom 3D Elements Override
- Appears when a style with `customSubject.enabled` is selected (Glass Banks, Frosted Hands)
- Text input to replace default 3D elements (e.g., replace "bank buildings" with rockets)
- Shows default subject as hint text

#### 7. Scene Color Pickers (4 pickers, shown when style selected)
- **BG** - Background/void color
- **Elements** - 3D shapes, coins, objects color
- **Accent** - Neon effects, inner glow, edge lighting
- **Lighting** - Volumetric glow, surface reflections, specular highlights, rim light

#### 8. Logo Override Pickers (shown when style selected)
- **Material dropdown** - Default, Frosted Glass, Crystal Glass, Mirror Chrome, Matte Ceramic, Liquid Mercury, Beveled Crystal, Edge-Lit Glass, Platinum Chrome, Brushed Metal
- **Logo Color** - Base surface color
- **Logo Glow** - Inner glow / rim highlight color
- **Reset All Colors** button to clear everything

#### 9. Logo Text Mode Toggle
- Full Logo (text + mark) - Uses `_FULL` variant if available
- Logo Mark Only - Uses standard `SYMBOL.png`

#### 10. Generate Button
- Gradient button (cyan to purple)
- Shows spinner with "Generating (~45s)..." during loading
- Sends all parameters to `/api/cover-generator/generate`

#### 11. Generated Cover Display
- Large preview area with IMG placeholder when empty
- Generation metadata (Network, Method, Time)
- Download button
- Regenerate button

#### 12. Rating System (1-10 scale)
- Logo Quality, Logo Size, Logo Style, Background Quality, Background Style
- Color-coded number buttons (red < 4, yellow 4-5, blue 6-7, green 8+)
- Additional Feedback textarea (500 char max)
- Submit Feedback button
- Thank you message after submission

#### 13. Generation History
- Auto-saved badge for logged-in users
- Grid of previous generations with thumbnails
- Click to view in main preview
- Network tag overlay on each thumbnail
- Saved badge for persisted images
- Loads saved covers from `/api/cover-generator/my-covers`

#### 14. Login Hint
- "Sign in to auto-save your generations" for non-logged-in users

---

## Theme / Styling
- **Body background:** `#000000` (pure black)
- **Card/container background:** `#111111`
- **Inner sections:** `#0a0a0a`
- **Borders:** `#1a1a1a`
- **Text:** `#e6edf3` (primary), `#8b949e` (secondary), `#6e7681` (hint)
- **Accent color:** `#00d4ff` (cyan)
- **Generate button:** gradient `#00d4ff` to `#8b5cf6`
- **Admin section:** orange title `#f0883e`
- **Type toggles:** purple `#8b5cf6`

---

## Backend API Endpoints Used
- `GET /api/cover-generator/networks` - Returns networks + companies lists
- `GET /api/cover-generator/logo-preview/:symbol` - Serves logo image (local -> Supabase -> CDN)
- `POST /api/cover-generator/upload-logo` - Admin upload (FormData: logo, symbol, name, type)
- `POST /api/cover-generator/generate` - Generate cover image
  - Params: network, additionalNetworks, title, customKeyword, logoTextMode, styleId, bgColor, elementColor, accentLightColor, lightingColor, logoMaterial, logoBaseColor, logoAccentLight, customSubject
- `GET /api/style-catalog` - Returns 22 styles with thumbnails, categories, customSubject config
- `GET /api/cover-generator/my-covers` - Load user's saved covers (auth required)
- `POST /api/cover-generator/save` - Save cover to profile (auth required)
- `POST /api/cover-generator/rating` - Submit rating feedback

## Backend Key Files
- `src/server.js` - Main server, all endpoints, NETWORKS_LIST (45), COMPANIES_LIST (54)
- `src/services/controlNetService.js` - Wavespeed Nano-Banana-Pro generation, logo loading with _FULL variant support
- `src/services/styleCatalogService.js` - 22 style prompts, color override regex engine, customSubject replacement
- `src/services/watermarkService.js` - Watermark positioning (1800x900, centered, 5px beyond bottom)
- `src/routes/style-catalog.js` - Style catalog route
- `uploads/png-logos/` - 110 logo files including _FULL variants

## Frontend Key Files
- `src/pages/CoverGenerator.js` - Main Cover Generator page (1963 lines)
- `src/contexts/AuthContext.js` - Firebase auth context
- `src/App.js` - Global styles, routing
- `vercel.json` - Build config, CSP headers, routing

## Build Config
- `vercel.json` buildCommand: `CI=false npm run build`
- CSP includes Supabase in connect-src
- Framework: create-react-app

---

## CRITICAL NOTES
1. **ruddy auto-deploys from GitHub main branch** - Any push to main triggers a Vercel rebuild
2. **Backend auto-deploys from GitHub main branch** - Any push triggers a Railway rebuild
3. **NEVER force push or rebase** - This will destroy history
4. **Logo files in uploads/png-logos/ are committed to git** - They deploy with the backend
5. **Admin email:** valor.kopeny@cc-ea.org
6. **Watermark positioning is LOCKED** - See CLAUDE.md for exact formula
