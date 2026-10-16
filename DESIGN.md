# Design language

**2026-10-16 — PIXEL/NEO.** The "Electric Play" direction was rejected by the owner as dated ("structure is back from 2020, 2016"). New brief, in his words: like lusion.co's modern scroll craft, but a **pixel-art design language** — self-generated pixel assets, bright Gen Z colors and typography, modern layouts, sweet scroll animations, rebuilt from scratch. UI only; no backend/logic changes.

RTO Shield is now a neon arcade boss-fight: deep void `#0b0b14`, electric lime `#b4ff39`, hot pink `#ff4ad8`, cyan `#4ae3ff`, yellow `#ffd94a`. Pixelify Sans display type, Space Grotesk body, Space Mono labels. Signature 8-bit chamfered corners (`px-cut`), 2px borders, hard offset shadows, CRT scanlines, pixel-grid backdrops. Four self-generated pixel assets in `apps/web/public/assets/pixel/`: neon night-market hero, RISK SCANNER arcade cabinet, shopkeeper mascot, sprite icon sheet.

Marketing is a scroll-driven game: boot loader → floating HUD nav + fullscreen overlay menu → parallax pixel hero → lime marquee → LEVEL 01 (boss stats with count-ups + mascot) → LEVEL 02 (interactive RiskArcade demo console + cabinet art) → LEVEL 03 (pinned horizontal scroll: DETECT/SCORE/ACT/SAVE) → LEVEL 04 (WhatsApp draft transmission) → FINAL BOSS (INSERT COIN pricing) → GAME OVER footer. Lenis smooth scroll drives GSAP ScrollTrigger throughout.

The app keeps every route, form, and data contract; only the chrome is pixel: HUD sidebar with lime active states, pixel-cut cards with colored borders, pixel risk chips, lime charts on dark.

Studied in Firefox at 1440×900 on 16 Oct 2026 (hero, level 1, arcade console, horizontal scroll, final boss). Zero JS errors.

## Direction

**PIXEL/NEO.** A boss fight, not a brochure.

The reference lineage is lusion.co's scroll craft (pinned narratives, parallax, buttery motion) crossed with the awards-level pixel-art language (Awwwards-recognized: 1-bit pixel portfolios, Pixel Melbourne HM 2026). The language is its own — original generated assets, game-level metaphors (the product IS a score: 0–100, bands, INSERT COIN), Gen Z brights on dark.

## Tokens

| Token | Value | Role |
| --- | --- | --- |
| void | `#0b0b14` | Page — deep blue-black |
| panel / panel2 | `#14141f` / `#1b1b2b` | Surfaces |
| ink | `#f2f2ea` | Text — off-white |
| muted | `#8b8b9e` | Secondary |
| line | `#2a2a3d` | Borders |
| lime | `#b4ff39` | Primary — CTAs, score, focus, marquee |
| pink | `#ff4ad8` | Secondary — accents, level 04 |
| cyan | `#4ae3ff` | Tertiary — level 02 |
| yellow | `#ffd94a` | Highlights — pricing, save |
| danger | `#ff4a5e` | High band and destructive |
| warn | `#ffd94a` | Medium band |

Type is **Pixelify Sans** (display, via `next/font/google`), **Space Grotesk** (UI), **Space Mono** (labels/figures), **Noto Sans** Devanagari for Hindi copy. Display size `clamp(2.4rem, 7.5vw, 6rem)`.

Radius: none — chamfered pixel corners via `clip-path` instead. Elevation is `6px 6px 0 #000` hard shadows; buttons press to `translate(4px,4px)`. Grain is CRT scanlines (fixed overlay). The boot bar fills in `steps(10)`.

## Motion

Lenis (`lerp` 0.09) drives ScrollTrigger. Hero staggers in after the boot overlay; hero bg parallax scrubs; reveals are `power3/4.out`; counters tick with `power2.out`; Level 03 pins and rides horizontally with `scrub: 1`; marquee loops; `px-blink` pulses arcade prompts.

`prefers-reduced-motion` skips Lenis, reveals, counters, the horizontal pin, marquee, and blink. Focus is a 3px lime ring.

## Retired

- The "Electric Play" Arc-referenced system (2026-10-16): electric blue `#1e1efa`, DM Serif Display, wavy dividers. Replaced by PIXEL/NEO above after owner rejection.
- The "Kagaz" warm-ledger system (2026-10-16): warm paper `#faf6ec`, postal red `#c0392b`, Fraunces.
- The dark "Signal" system (2026-10-16): near-black `#07080a`, phosphor `#d6ff4a`, Geist display.
- The "Eloqwnt" imitation: retired earlier.
- A separate Heron-referenced marketing redesign was built on `main` by mistake and reverted; `main` is back to the initial commit. All product work lives on this branch.

Studied in Firefox at 1440×900 on 16 Oct 2026 (landing, method band, pricing, login wake screen).
## References

| | Site | What makes it feel premium |
| --- | --- | --- |
| 1 | [Linear](https://linear.app/) | Near-black field, one quiet accent, huge tight headline, product UI as the hero, almost no decoration. ![Linear](docs/references/linear.jpg) |
| 2 | [Vercel](https://vercel.com/) | Geist, pure black, white type, the product is a dark frame with a single luminous edge. ![Vercel](docs/references/vercel.jpg) |
| 3 | [Resend](https://resend.com/) | Monochrome, code-sized labels, one green, generous empty space, no stock photography. ![Resend](docs/references/resend.jpg) |
| 4 | [Raycast](https://www.raycast.com/) | Dark glass, a shortcut as the product shot, color used as light rather than fill. ![Raycast](docs/references/raycast.jpg) |
| 5 | [Supabase](https://supabase.com/) | Dark canvas, one brand green, technical labels, the product grid is the argument. ![Supabase](docs/references/supabase.jpg) |
| 6 | [Clerk](https://clerk.com/) | Auth treated as a product surface: one card, clear hierarchy, no marketing chrome inside the form. ![Clerk](docs/references/clerk.jpg) |
| 7 | [Cal.com](https://cal.com/) | Open-source SaaS that still feels finished: tight nav, real UI, restrained color. ![Cal.com](docs/references/cal.jpg) |
| 8 | [Attio](https://attio.com/) | Data density without clutter. Tables and records are the visual, not illustrations of tables. ![Attio](docs/references/attio.jpg) |
| 9 | [Mercury](https://mercury.com/) | Money set in a large grotesque, calm contrast, numbers are the hero. ![Mercury](docs/references/mercury.jpg) |
| 10 | [Ramp](https://ramp.com/) | Fintech that stays sharp: black, white, one accent, product frames instead of abstract blobs. ![Ramp](docs/references/ramp.jpg) |
| 11 | [Stripe](https://stripe.com/) | Editorial rhythm, long measure, gradients that sit behind type instead of on it. ![Stripe](docs/references/stripe.jpg) |
| 12 | [Framer](https://www.framer.com/) | Oversized type, motion that is the layout, not a decoration on a static page. ![Framer](docs/references/framer.jpg) |
| 13 | [Godly](https://godly.website/) | A grid of current marketing sites. The ones that hold up are type-led and show the product. ![Godly](docs/references/godly.jpg) |
| 14 | [Awwwards SOTD](https://www.awwwards.com/websites/sites_of_the_day/) | Recent winners earn the award with pacing and craft, not with a second typeface and a gradient mesh. ![Awwwards](docs/references/awwwards.jpg) |
