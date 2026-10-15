# Design language

RTO Shield is a packing-table product for Indian COD shops, not a generic AI dashboard. The interface should feel like a well-kept ledger: confident numbers, a warm paper ground, and one marigold accent. Hindi is present as a wordmark, not as decoration pasted onto a Western SaaS template.

## References

These are specific sites, not a mood board of categories. We borrowed structure and restraint, not their palettes.

1. [Razorpay Sprint 26](https://razorpay.com/sprint/26) — [Awwwards SOTD](https://www.awwwards.com/sites/razorpay-sprint-26). Scroll chapters for an Indian payments product. We took the idea of one journey told in pinned steps (teach, score, confirm) and left the cobalt 3D world behind.
2. [Stripe Dot Dev](https://stripe.dev) — [Awwwards SOTD](https://www.awwwards.com/sites/stripe-dot-dev). Tight product type, a real interface in the hero, no stock illustration. The packer card on the landing page is that move.
3. [Moto Finance](https://www.awwwards.com/sites/moto-finance) — Awwwards SOTD, 24 Sep 2026. A premium financial object that feels worth holding. Informed the weight of the score and the rupee figures.
4. [Milledollars](https://www.awwwards.com/sites/milledollars) — Awwwards SOTD, 2 Oct 2026. Editorial finance: large serif headlines, quiet supporting text.
5. [Stripe BFCM Machine](https://www.awwwards.com/sites/stripe-bfcm-machine) — data treated as an instrument. The dashboard trend line draws itself; the bars grow from the left.
6. [CRED](https://cred.club) — Indian premium, high contrast, Devanagari used with confidence. We kept the paper ground instead of CRED’s black, and used Tiro Devanagari only for short marks (`आरटीओ शील्ड`, `गोपनीयता`).
7. [Godly](https://godly.website) and [Land-book](https://land-book.com) — used as indexes while choosing the six sites above. The pattern we kept is large type, a sticky header, and one motion idea per section.
8. [Dribbble: fintech dashboard search](https://dribbble.com/search/fintech-dashboard) — a reminder of what to avoid: purple gradients, identical KPI cards, and charts with no sentence attached. Every metric on this dashboard has a plain-language hint.

## Language

**Name.** Haldi ledger.

**Type.** Fraunces for display (optical size, tight leading). Outfit for UI text. Tiro Devanagari Hindi for short Hindi marks. Scale: `text-display-1` is `clamp(2.7rem, 6vw, 5.4rem)` at 0.96 line-height. Body stays 16px so a packer can read it on a phone.

**Color.**

| Token | Hex | Role |
| --- | --- | --- |
| paper | `#f3ecdf` | Page ground, warm rice paper |
| card | `#fffaf3` | Raised surfaces |
| ink | `#16130f` | Text |
| navy | `#1a2744` | Indigo dye, navigation and inverse panels |
| saffron | `#c9841a` | Marigold, one accent |
| forest | `#1c6a45` | Low risk and WhatsApp |
| danger | `#8c2e2a` | Madder, high risk and destructive actions |
| warn | `#8a5a12` | Medium risk |
| line | `#e4d5bf` | Rules |

Risk is never color alone. Bands are written out: Low, Medium, High.

**Grid.** Content sits in `max-w-page` (72rem) with 20px padding, 16px from 360px up via `px-4`. The app is a 15rem indigo-side rail from `lg`, and a horizontally scrolling nav below that so 360px does not crush five labels.

**Motion.** GSAP ScrollTrigger pins the three-step story. SplitText reveals the hero by word, with masks so the overflow stays hidden. Lenis smooths scroll on the marketing page only. Dashboard charts use a short stroke and scale animation. `prefers-reduced-motion: reduce` skips Lenis, GSAP, and the chart keyframes. SplitText’s current GSAP license (standard, no charge, including commercial use, since 30 April 2025) allows the plugin. No Club token.

**Components.** `panel` for cards. Pill buttons. Notices for degraded integrations. The wake-up screen uses the same panel, a progress bar with a numeric value, and a live region for the message.
