# Design language

RTO Shield follows the rendered interface of [Eloqwnt](https://www.eloqwnt.com), studied in Chrome at 1440×900 and 390×844 on 15 Oct 2026. Hindi and Hinglish confirmation copy stays in the product. The chrome around it is the same Latin grotesque as the rest of the UI.

Screens from that study live in the pull request: desktop hero, mid-page cards, mobile hero, and a scroll recording.

## What the reference actually does

Measured from the live page, not from a mood board.

| Property | Observed |
| --- | --- |
| Page ground | `rgb(229, 233, 235)` → `#e5e9eb` |
| Header over the hero | `#ffffff` |
| Cards | `#ffffff`, large radius, sitting on the gray field |
| Text | Near-black. Muted labels around `#6b6b6b`–`#8b8b8b` |
| Display type | Mazzard, weight 500, 56px / 58.8px on desktop, about 35px / 39px at 390px |
| Body type | Same family, regular weight |
| Cursor | The system cursor. Pointer on links and buttons. No custom follower. |
| Hover | Pills darken. List rows pick up a light fill. No image zoom. |
| Scroll | Long, eased, momentum-like. Header stays put. |
| Preloader | None on the reference. Our wake-up screen uses the same full-viewport gray field as a quiet preloader. |
| Page change | A short fade, header unchanged. |
| Mobile | Hamburger, stacked cards, headline wraps to three lines, same gray ground. |

Mazzard is a licensed face. We use **Manrope** (Google Fonts, weights 400–700), a geometric grotesque with a similar medium headline weight and tight leading. Hindi product strings use **Noto Sans** Devanagari so the letters render, in the same size as the surrounding UI.

## Tokens

| Token | Hex | Role |
| --- | --- | --- |
| paper | `#e5e9eb` | Page ground |
| card | `#ffffff` | Cards, header, inputs |
| ink | `#111111` | Text, primary pills, progress |
| muted | `#6b6b6b` | Secondary copy |
| line | `#d5dadd` | Hairline rules |
| low | `#1f6b45` | Low band, written out |
| mid | `#8a5a12` | Medium band, written out |
| high | `#9b1c1c` | High band and destructive actions |

Risk is never color alone. Bands stay written: Low, Medium, High.

## Layout

Content width is `72rem`. Desktop padding is about 2.5rem; 360px uses 1.25rem. Sections stack with 5–7rem of vertical air. Cards use a 1.75rem radius. Buttons and nav items are full pills.

The marketing page is one column of large type, then a white card, then numbered rows, then a footer of text links. The app is the same ground: a white top bar, black pill for the current section, white cards for metrics and lists. There is no dark side rail.

## Motion catalogue (Eloqwnt, measured 15 Oct 2026)

Taken from the live page at 1440×900 and 390×844. Their motion is GSAP 3.15 and SplitText, with about 25 ScrollTriggers. There is no Lenis instance and no CSS transition sheet for the entrances. The only CSS keyframes rule is a spin used off the hero. Timings below are what we play, chosen to sit in the same range as that GSAP setup. Their source is not copied.

| Detail | What the reference does | What we play |
| --- | --- | --- |
| Preloader | None. | Wake screen on login, signup, and the app. Full-viewport paper, wordmark, status, hairline progress. It leaves over 0.7s with `cubic-bezier(0.16, 1, 0.3, 1)` once both health checks are ok. |
| Hero entrance | White fullscreen hero, headline weight 500, 56px / 58.8px, tracking −1.6px. GSAP is on the page. | Masked line reveal, 1.15s, `power4.out`, 0.07s stagger, 0.12s delay. Supporting lines rise 1.05s, `power3.out`. |
| Text masks | SplitText is loaded. | `SplitText` lines with `mask: 'lines'`, `yPercent: 112`. |
| Image reveals | Project photos sit in 32px-radius frames, parent `overflow: hidden`, about 640×480. | `clip-path` from `inset(12%)` plus scale 1.12 → 1, 1.35–1.5s, `expo.out`. |
| Parallax | ScrollTriggers scrub is off on the first triggers; ranges overlap down a ~9600px page. | Media drifts `yPercent: -8` with `scrub: true`. |
| Pinned story | Sampled triggers were not pins. The work section is one ~2625px stack of large frames. | Desktop “method” pins for 170% scroll and crossfades three product frames. Mobile stacks them. |
| Horizontal scroll | Not present. Projects stack vertically. | Not used. |
| Marquee | A thin repeating strip. | 28s linear CSS marquee. |
| Magnetic control | Not measurable as a CSS transition. | Primary pills ease toward the pointer (`power3.out`, 0.45s), then home. |
| Cursor | `.cursor` is a 12px black circle, fixed, `pointer-events: none`, z-index 9999. | Same idea on marketing pages: 12px dot, lerp 0.38, scales on links. Hidden for coarse pointers and in the app. |
| Hover | Pills darken. Rows pick up a light fill. | Pills invert or darken. Numbered rows fill white. Table rows fill `#f3f5f6`. |
| Nav | `.hide_nav-hero` is fixed. Header over the hero is transparent; the page ground is `#e5e9eb` and the hero is white. | Fixed nav, transparent on the hero, white at 92% opacity after 12px, hides on scroll down, returns on scroll up (0.7s). |
| Section color | White hero, then the gray field, then white cards. | Same sequence. |
| Page change | A short fade, header unchanged. | Paper curtain, `scaleY` 1 → 0, 0.9s `expo.inOut`, content fades in over 0.6s. |

Smooth scroll on marketing pages is Lenis (`lerp` 0.085) on the GSAP ticker, with `ScrollTrigger.update` on each Lenis scroll. Chart lines draw in 1.1s. Skeletons shimmer 1.35s.

`prefers-reduced-motion: reduce` skips Lenis, SplitText, scroll reveals, the pin, the cursor, magnetic pull, the marquee, the page curtain, the wake exit, and chart draw. Focus rings stay visible (`2px` ink, offset `3px`).
