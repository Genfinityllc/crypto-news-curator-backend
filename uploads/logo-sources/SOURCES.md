# Where the replaced logo files came from

On 2026-11-25 the owner found the Solana logo partly see-through on a cover
and asked for solid logos taken from proper files ("for logos that we dont
have a 100 opacity for we need to find them online as svgs, not try to erase
backgrounds with tools where it messes them up"). 24 of the 92 logo files the
library served were see-through inside their shapes. The 17 below were
replaced that day with each brand's own file, drawn on a clear background at a
large size and trimmed, as `uploads/png-logos/<SYMBOL>.png` (the committed
file is what the preview route and `getPngLogo` read first; the old copies in
the Supabase bucket are still there, unused). The file each was drawn from is
kept here as `<SYMBOL>.svg`. `render-logo.js.txt` is the script that drew
them (needs `sharp`).

| Symbol | Drawn from | Notes |
|---|---|---|
| SOLANA_FULL | `solanaLogo.svg` in the Solana Foundation's site repository: https://raw.githubusercontent.com/solana-foundation/solana-com/main/apps/web/public/src/img/branding/solanaLogo.svg (the files of solana.com/branding) | White wordmark. |
| PAYPAL_FULL | PayPal's own file host: https://www.paypalobjects.com/paypal-ui/logos/svg/paypal-color.svg | The blue logo, as the library had it. PayPal's 2024 newsroom kit is a newer black / white design in PNG only. |
| GOOGLEMARK | Google's file host: https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg | The solid four-colour G, as the library had it (Google's 2025 G is a gradient). |
| MASTERCARD | Wikimedia Commons, "Mastercard 2019 logo.svg": https://upload.wikimedia.org/wikipedia/commons/a/a4/Mastercard_2019_logo.svg | Mastercard's brand centre refused automated reads. Official colours. |
| NASDAQ_FULL | nasdaq.com, named on its newsroom page: https://www.nasdaq.com/themes/nsdq/dist/assets/images/logo-half-white.svg | White wordmark. The mark is Nasdaq's own #0090BA, a little deeper than the old copy. |
| NYSE_FULL | Wikimedia Commons, "NY Stock Exchange logo.svg": https://upload.wikimedia.org/wikipedia/commons/9/93/NY_Stock_Exchange_logo.svg | The bars logo the library had (NYSE's site has used a different design since 2022). Its letters are drawn dark (#100f0d); they were made white for dark covers, nothing else changed. |
| CIRCLE_FULL | Circle's brand kit (circle.com/pressroom#brandkit), `circle-logo-2024.zip`, `circle-logo-ondark.svg` | White wordmark. |
| ALLFUNDS_FULL | The header of allfunds.com: https://allfunds.com/assets/allfunds-logo_white-Csmm11iI.svg | White wordmark. |
| TOSSBANK_FULL | Toss's brand kit (brand.toss.im), `TossBank.zip`, `TossBank_Logo_Primary_White.png` (6000 x 2500) | No vector of the colour logo is published (the kit holds AI and PNG; Toss's SVGs carry the mark as a picture). The kit's own PNG is solid. Not kept here (it is the kit's file made smaller). |
| JUPITER | Jupiter's brand kit (developers.jup.ag/docs/resources/brand-kit), `jupiter-brand-kit.zip`, `logo-dark.svg` | The current green to cyan mark. The library had the orange to cyan one from before 2023. |
| JUPITERFULL_FULL | The same kit, `logowithtext-dark.svg` | White wordmark, current colours. |
| HELIUS_FULL | Helius's brand page (helius.dev/brand): https://www.helius.dev/Helius-Brandkit/Helius/Helius-Horizontal-Logo.svg | Orange. A white one is on the same page. |
| IOBUILDERS_FULL | The header of io.builders: https://io.builders/_next/static/media/iobuilders-white.0065cf90.svg | White. |
| TELLER_FULL, TELLER1_FULL | Teller protocol's own repository: https://raw.githubusercontent.com/teller-protocol/landing-page/HEAD/public/images/img-teller-logo-white.svg | All white and flat. The old copy shaded the mark's tiers by making them see-through. |
| CLAYNOSAURZ_FULL | The header of claynosaurz.com (press page files), `claynosaurz-logo.png`, 1366 x 280 | The one-line colour logo is published only as a picture; it is solid. Their vectors are a two-line version and a one-colour version. |
| COMICBOOK_FULL | The header of comicbook.com: https://comicbook.com/wp-content/uploads/sites/4/2024/10/ComicBook-logo.png | Only 522 x 89, the largest the site publishes of this design; solid. It will look soft if shown very large. |

Not replaced, because no solid official file of the same design was found:
HASHGRAPHONLINE_FULL and HOL (the company is now "HOL" and publishes PNG only,
with a new wordmark), FERROX_FULL (the company's files all carry a tagline),
THINKINGCRYPTO and THINKINGCRYPTOFULL_FULL (the site's own files are smaller
than ours or laid out differently). CANTON and SEC_FULL are fine line art, not
see-through. The cover studio still makes library logos solid when they are
placed (frontend `solidLogo.js`), which covers these.
