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

## Motion

- **Smooth scroll.** Lenis on marketing pages (`lerp` 0.12), driving ScrollTrigger.
- **Text reveal.** SplitText splits headlines into lines and words and slides the words up from a mask.
- **Scroll sections.** Blocks with `data-reveal` fade and rise when they enter the viewport.
- **Ticker.** A CSS marquee under the hero. It pauses when `prefers-reduced-motion` is set.
- **Page transition.** `template.tsx` fades and lifts the next route with GSAP (about 0.45s).
- **Preloader.** The wake-up gate is a full-viewport `#e5e9eb` screen: wordmark, status line, thin black progress. It still waits until both health checks return ok.

`prefers-reduced-motion: reduce` skips Lenis, SplitText, scroll reveals, the marquee, the page fade, and chart draw animations. Focus rings stay visible (`2px` ink, offset `3px`).
