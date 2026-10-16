# Design language

**2026-10-16 — SIGNAL (current).** After the owner rejected NOIR GOLD ("looking very bad… not following the latest design trends… the font is looking very ugly… the colors are not good"), he ordered deep research: find a modern, Gen Z, award-winning reference and copy its design language faithfully — marketing and dashboard.

Deep research (Awwwards 2026 winners, Dribbble Select 2026, design press) selected **Signal IQ by Setu (Pine Labs)** — https://marketing.pinelabs.com/signaliq — Awwwards Honorable Mention, Jul 2026. An Indian fintech that reads UPI bank statements to surface hidden income and risk signals: the same design problem as a COD risk scorer (making transaction risk legible). Runners-up: Seasats (clearest pure system), Aardvark Book Club (strongest Gen-Z energy, source of the banana secondary).

SIGNAL is a faithful translation of Signal IQ's system:

- **Palette:** true black `#000000`, white `#ffffff`, signal red `#fd0100` (risk only), vivid green `#00e676` (primary CTA), banana `#faed8f` (medium/warmth), muted `#8a8a8a`. Red is never decorative.
- **Typography:** Inter Tight (tight grotesk display + body, 800/900, uppercase statements), JetBrains Mono (eyebrow labels, data, CTAs), Noto Sans (Devanagari).
- **Signature components:** `/Introducing/`-style mono eyebrow kickers, gray label chips (`COD RISK INTELLIGENCE`), giant product wordmark hero, all-caps editorial statement sections (`AN UNSCORED ORDER IS A GAMBLE.`), red flag callouts (`RTO RISK`, `FAKE ADDRESS`, `GHOST BUYER`), numbered pillars (01/02/03), arrow CTAs (`OPEN THE DEMO →`), FAQ accordion, giant footer marquee, faint mono order-code rain background.
- **Motion:** Lenis smooth scroll, GSAP masked line reveals (GSAP-owned initial states — no CSS-hidden content, safe under `prefers-reduced-motion`), fade-up reveals, count-ups, marquee, live scan ticker. Every animation demonstrates the product.
- **Dashboard:** hairline panel grid, mono eyebrow section labels, flagged-row order callouts, red trend line, red/banana/green distribution, stat bands. Icon rail + top HUD + ⌘K palette retained, restyled in SIGNAL.
- **Rule:** UI only. No `apps/api` or `apps/ml` changes; every route, form, API call, auth action, and data contract unchanged.

**Retired 2026-10-16 — NOIR GOLD** (commit `3a79430`): cinematic dark luxury, gold `#e8b34a`, Syne + Instrument Serif. Rejected by owner as ugly font, bad colors, not on-trend.
**Retired 2026-10-16 — PIXEL/NEO** (commit `cbb138a`): neon pixel-art. Rejected as too cartoonish/game-like for the product.
**Retired 2026-10-16 — Electric Play / Arc** (commit `7aee36e`): owner-picked, then rejected as dated in structure.
**Retired 2026-10-16 — Kagaz** (commit `954b537`): too basic.
