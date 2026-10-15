# Feature audit

Audited against the product a seller actually uses: signup, a scored shop, a confirmation, and a dashboard. Status “before” is the app as deployed on Vercel and Render before this pass. “After” is this branch.

| Feature | Before | After | What changed |
| --- | --- | --- | --- |
| Signup and login | Working. bcrypt, JWT httpOnly cookies, CSRF, refresh, logout. | Working | Unchanged security. Signup now lands on shop setup. Login offers the demo shop. |
| Shop setup | Shop name was only a signup field, then a jump to history. | Working | `/app/start` asks for sample-and-score or a CSV upload. |
| One-click demo shop | Missing. A judge had to sign up, then click sample, then score. | Working | `POST /api/auth/demo` creates an isolated `demo+…@demo.rtoshield.tech` shop (Asha Studio), loads synthetic orders, scores them, and sets the session. Rate limited with the other auth routes. |
| CSV and manual import | Working. Shopify, Meesho-style, generic template, column mapping, 5 MB / 5,000 rows, injection-safe export. | Working | No behavior change. Orders link through to a detail page. |
| Risk scoring | Working. TabPFN when a token or local package exists, otherwise scikit-learn, otherwise a rules prior. The UI names the model. | Working | The API span is now `gen_ai.invoke_agent` around the score. The Python service opens the same agent span around address notes and the predictor. |
| Gemma address quality | Working, with heuristic fallback. Ollama preferred, then AI Studio, then rules. | Working | Chat spans already carried token counts when the provider returned them. They stay free of address text. |
| Hindi / Hinglish messages and wa.me | Working. Templates if Gemma is absent. Seller sends the message. | Working | Queue and the new order page rebuild the wa.me text from the selected language. |
| ElevenLabs Hindi voice | Working when `ELEVENLABS_API_KEY` is set. Otherwise the script is returned and the UI says so. Script is shop name and amount only. | Working | The span is `gen_ai.tts` with model and character count. The script is not a span attribute. |
| SerpApi pincode context | Working. Seven-day cache, embedded localities without a key, fairness note, not a model feature. | Working | No behavior change. |
| Dashboard and held-out AUC | Working. Weekly RTO rate, rupees saved, exposure, reasons, model metrics. | Working | Charts animate. The numbers and the formula are unchanged. |
| Settings, export, delete | Working. Password required to delete the account. | Working | No behavior change. |
| Data isolation | Working. Every order query includes the seller id. | Working | The demo test checks a second shop cannot see the demo orders. |
| PII encryption | Working. AES-GCM, masked phones, production refuses to boot without the key. | Working | No behavior change. |
| Rate limits and validation | Working. Throttler, Zod on inputs, helmet. | Working | The demo route sits on the auth throttle. |
| Error states | Partial. API errors surfaced as text. Wake-up screen existed for cold Render. | Working | Wake-up screen kept and restyled. Score, voice, and demo failures stay in notices. |
| Sentry agent tracing | Partial. Latency spans existed (`ai.tabpfn`, `gen_ai.chat`, `gen_ai.tts`) and skipped prompts. | Working | Score is an `gen_ai.invoke_agent` span in both Nest and FastAPI. Gemma chats and ElevenLabs use `gen_ai.operation.name`, `gen_ai.system`, and `gen_ai.request.model`. No prompts, phones, or addresses. |
| Order detail | Missing as a page. Detail was only inside the queue card. | Working | `/app/orders/[id]` shows score, reasons, address quality, WhatsApp, voice, and pincode context. |
| Demo recordings | Placeholder paths in the README. The GIF files were not in the repo. | Still open | The landing page is the live demo. Recording three GIFs needs a running shop and a screen capture; the files are still not in `docs/demo/`. |
| Billing | Informational ₹499. | Unchanged | Still no card checkout, on purpose. |
| TabPFN / Gemma / ElevenLabs / SerpApi without keys | Honest fallbacks. | TabPFN client is now in the ML image. | With `TABPFN_TOKEN` set, `/health` reports `tabpfn-client`. An API error still falls back to scikit-learn. Gemma, ElevenLabs, and SerpApi stay optional. |

## Tests added

- API: `POST /api/auth/demo` creates a scored shop and a second seller sees none of those orders.
- Existing Jest, Vitest, and pytest suites still cover crypto, CSV, the blueprint, and the model.
