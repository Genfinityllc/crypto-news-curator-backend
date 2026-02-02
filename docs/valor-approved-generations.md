# Valor approved Generations

This document captures the current, approved generation setup as a stable reference point.
If future changes cause regressions, return here to compare or restore behavior.

## Core generation pipeline
- Primary model: Wavespeed Nano-Banana-Pro edit (`google/nano-banana-pro/edit`).
- Resolution: `2k`, aspect ratio `16:9`.
- Input logo preprocessing: PNG logo is placed on a 16:9 canvas before edit.
- Output storage: Supabase Storage (permanent URLs) with local fallback if upload fails.
- Logo sources: local `uploads/png-logos` first, then Supabase Storage for uploaded logos.
- Multi-logo: multiple symbols are composited into a single logo image before generation.

## Prompting system
- Curated style catalog based on approved examples (3D CGI, glass/chrome/crystal, dark depth).
- Randomized style selection to avoid repetition.
- Explicit negative prompt exclusions:
  - No boxes/frames/containers.
  - No photography or photorealistic photos.
  - No server racks, data centers, or computer equipment.
  - No cityscapes or skylines.
  - No sparkles, glitter, or nebula spirals.
  - Avoid dominant red/yellow and heavy warm tones.
- Accent colors: subtle purple, neon green, occasional pink, limited to 2–3 main colors.
- Depth emphasis: tilted angles, parallax, reflections, and cinematic lighting.

## Feedback loop
- Ratings: 1–10 numeric scale for logo quality, logo size, logo style, background quality, background style.
- Written feedback: analyzed with Anthropic Claude for contextual adjustments.
- Master account: Valor’s account applies global preferences; others apply per-user preferences.

## Storage and profiles
- Generated covers are saved to Supabase for permanent access.
- User history + profile grids show full generation history (scrollable).
- Non-master generations are mirrored to the master account profile.

## Frontend behavior
- Logo/network lists are populated from backend and include all uploaded logos.
- Logo uploader (frontend) stores PNG logos in Supabase and keeps them in dropdowns.
- Generation UI allows a custom keyword to add secondary elements.

## Logo text mode (new)
- Toggle in cover generator UI:
  - `Full Logo (text + mark)`: prompt preserves wordmark/typography.
  - `Logo Mark Only`: prompt favors symbol-only, omits text.
- Default mode: `Full Logo (text + mark)`.

