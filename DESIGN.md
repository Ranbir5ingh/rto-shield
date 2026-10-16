# Design language

**2026-10-16 — Electric Play.** The "Kagaz" warm-ledger direction was rejected by the owner as "a basic website with the basic UI". After reviewing awards-level references, the owner picked the **Arc** reference (electric blue, wavy edges, chunky serif, pastel washes, playful product staging — arc.net). RTO Shield is now a loud, joyful, awards-grade product: electric cobalt `#1e1efa`, chunky DM Serif Display headlines, pastel aurora washes, wavy scalloped section dividers, chunky dark pill buttons, floating stickers, bouncy `back.out` motion.

Studied in Firefox at 1440×900 on 16 Oct 2026 (landing, method band, pricing, login wake screen).

## Direction

**Electric Play.** A game you're winning, not a ledger you're filing.

The reference is Arc's product site: a vivid blue field, wavy dividers between sections, one chunky serif for headlines, pastel washes behind the hero, product UI staged in clean white cards with playful pastel stat tiles, dark pill CTAs. The language is its own — not a copy of Arc's illustration style, just its energy: color as joy, type as voice, motion as bounce.

The seller's dashboard keeps every workflow, route, and data contract. Only the chrome changes: sidebar links become blue pills, big figures set in DM Serif, risk stays written (Low, Medium, High) as chunky outlined pills.

## Tokens

| Token | Value | Role |
| --- | --- | --- |
| canvas / paper | `#fbfaf5` | Page — warm white |
| card | `#ffffff` | Surfaces — white cards, 24px radius |
| ink | `#17150f` | Text — warm black; also the chunky dark button |
| muted | `#6b6257` | Secondary |
| line | `#e8e4d8` | Soft warm borders |
| accent / electric | `#1e1efa` | The blue — marquee band, method band, score, focus |
| accent-deep | `#1212b8` | Blue hover |
| pastel-pink / sky / butter / mint | `#ffd9e8` `#d9e6ff` `#ffeba8` `#d8f5e3` | Aurora washes, stat tiles |
| low | `#16a34a` | Low band, with the word |
| mid | `#d97706` | Medium band, with the word |
| high | `#e11d48` | High band and destructive actions — vivid rose |

Type is **DM Serif Display** (chunky display serif, via `next/font/google`), **Geist** (UI), and **Geist Mono** (figures, labels — always tabular numerals). Hindi confirmation copy uses **Noto Sans** Devanagari. Display size is `clamp(2.9rem, 7vw, 5.75rem)` at line-height 0.98. Labels are 11px, bold, uppercase, `0.16–0.22em`.

Radius: pill buttons, 24px cards, 16px stat tiles. Elevation is a soft layered shadow; hover lifts cards with a slight `-0.4deg` tilt and a blue-tinted shadow. Grain is a fixed overlay (overlay blend, low opacity) — the blue has visible tooth, like the reference.

Signature moves: the tilted electric-blue marquee band; the full-bleed blue method band with wavy SVG dividers top and bottom; the floating rotated "HIGH RISK" sticker on the hero product frame; pastel stat tiles; bouncy reveals.

## Motion

Unchanged architecture: Lenis on the marketing page (`lerp` 0.1) drives ScrollTrigger. Hero items and section reveals now use `back.out(1.3–1.4)` — a springy pop instead of a polite rise. Example-day figures tick once. Buttons squash to 0.94 on press and lift on hover. Charts draw in. Routes fade 0.35s.

`prefers-reduced-motion` skips Lenis, the reveals, the tickers, the marquee, and the chart draw. Focus is a 3px electric-blue ring.

## Retired

- The "Kagaz" warm-ledger system (2026-10-16): warm paper `#faf6ec`, postal red `#c0392b`, Fraunces. Replaced by Electric Play above after owner rejection.
- The dark "Signal" system (2026-10-16): near-black `#07080a`, phosphor `#d6ff4a`, Geist display.
- The "Eloqwnt" imitation: retired earlier.
- A separate Heron-referenced marketing redesign was built on `main` by mistake and reverted; `main` is back to the initial commit. All product work lives on this branch.

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

## Direction

**Signal.** A dark instrument, not a gray brochure.

Borrowed from Linear and Resend: hairline borders, small radius, mono labels, one accent. Borrowed from Mercury: the number is the headline. The accent is phosphor `#d6ff4a` on near-black, used for the primary action, the score, and focus. Risk stays written: Low, Medium, High.

## Tokens

| Token | Value | Role |
| --- | --- | --- |
| canvas | `#07080a` | Page |
| card | `#121318` | Surfaces |
| raised | `#1a1b20` | Active nav, nested wells |
| line | `#2a2c33` | 1px borders |
| ink | `#f4f4f5` | Text |
| muted | `#9a9aa3` | Secondary |
| accent | `#d6ff4a` | Primary, focus, score |
| low | `#3dd68c` | Low band, with the word |
| mid | `#f5c16c` | Medium band, with the word |
| high | `#ff6b6b` | High band and destructive actions |

Type is **Geist** and **Geist Mono** (Vercel, OFL). Hindi confirmation copy uses **Noto Sans** Devanagari. Display tracking is about `-0.045em`. Labels are 11px mono, uppercase, `0.16–0.22em`.

Radius: 8px controls, 16px cards, 6px status chips. Spacing steps are 4, 8, 12, 16, 24, 32, 48, 80. Icons are Lucide, 15–16px, stroke 1.5.

Elevation is a border plus, on the hero frame only, a soft phosphor glow. Grain is a fixed overlay at low opacity.

## Motion

Lenis on the marketing page (`lerp` 0.1) drives ScrollTrigger. The hero rises in 0.8s. Sections reveal on enter. Example-day figures tick once. Primary controls ease toward the pointer. Buttons scale to 0.98 on press. Charts draw in. Routes fade 0.35s.

`prefers-reduced-motion` skips Lenis, the reveals, the tickers, the marquee, and the chart draw. Focus is a 2px phosphor ring.
