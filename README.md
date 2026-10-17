# RTO Shield

Stop paying ₹150 for every cash-on-delivery order that comes back.

RTO Shield is for small Indian sellers on Meesho, Instagram, WhatsApp, and small Shopify stores (about 20–500 orders a day). It scores which COD orders are likely to be refused **before** they ship, then helps you confirm the risky ones with the buyer.

Suggested price: **₹499/month**. This open-source build does not charge a card.

## The problem

A refused COD parcel still costs reverse shipping. This product uses **₹150** as the default cost per return-to-origin (RTO). You can change it. The dashboard estimates rupees saved as: risky orders you cancelled × that cost. That is a planning number, not a payout.

Example, labeled as an example: 40 COD orders a day, 8 come back, ₹150 each → ₹1,200 a day. Preventing a handful covers a ₹499 month.

## Demo

Recordings belong in `docs/demo/` (see that folder). Until you drop them in:

![Sample data and score](docs/demo/01-sample-and-score.gif)

![Confirmation queue](docs/demo/02-action-queue.gif)

![Dashboard](docs/demo/03-dashboard.gif)

What those should show:

1. Sign up, press **Try with sample data**, then **Score pending orders**.
2. Open a High-risk card, WhatsApp click-to-chat (nothing is auto-sent), play the Hindi script, mark confirmed / cancelled / no response.
3. Dashboard: weekly RTO rate, rupees saved, risk mix, plain-language reasons.

The product runs with **zero API keys**. Sample buyers are synthetic.

## Architecture

```mermaid
flowchart LR
  browser[Seller browser]
  web[Next.js on Vercel]
  api[NestJS API]
  ml[FastAPI ML]
  db[(MongoDB)]
  browser --> web
  web -->|same-origin /api proxy| api
  api --> db
  api -->|features and address text, never phone| ml
  ml -->|optional| tabpfn[TabPFN client]
  ml -->|optional open weights| gemma[Gemma via AI Studio or Ollama]
  ml -->|fallback| sk[scikit-learn]
  api -->|optional, script only| voice[ElevenLabs]
  api -->|pincode only| serp[SerpApi]
```

| Piece | Role |
| --- | --- |
| `apps/web` | Next.js 15 App Router, TypeScript, Tailwind, deployed on Vercel. Landing, auth, history upload, scoring, queue, settings. |
| `apps/api` | NestJS on the Express adapter. JWT httpOnly cookies, CSRF double-submit, `@nestjs/throttler`, helmet, Zod pipes, Mongoose. |
| `apps/ml` | FastAPI. TabPFN in-context on the seller’s history, then local TabPFN, then scikit-learn, then a rules prior. |
| MongoDB | Atlas in production (`MONGODB_URI`). In-memory Mongo when the URI is unset outside production. |

The browser talks to Next.js at [https://www.rtoshield.tech](https://www.rtoshield.tech) for the app. Next proxies `/api/*` to the Nest API at [https://api.rtoshield.tech](https://api.rtoshield.tech) and forwards `Set-Cookie`, so the session stays first-party. The ML service is [https://ml.rtoshield.tech](https://ml.rtoshield.tech). Both backends are on Render’s free plan and sleep after about 15 minutes. Opening any page sends a direct browser request to each health URL and holds it open, which is what actually spins a free instance up. The wake-up screen stays until both health checks return `{ ok: true }`.

### Scoring

Address quality (incomplete, landmark-only, junk, pincode mismatch) is a **feature**. Gemma produces it when configured. Priority: **Ollama (privacy-max, can be offline) → Gemma on Google AI Studio → local rules**.

TabPFN then scores the numeric features in-context. The UI always names the model that ran, including the scikit-learn fallback when `TABPFN_TOKEN` is missing.

**A pincode is not a model feature and never a ban.** SerpApi, if configured, only adds cached locality / courier-search context. The fairness note is returned by the API.

Phone numbers are not sent to TabPFN, Gemma, SerpApi, or ElevenLabs. The Hindi voice script is shop name and amount only. WhatsApp is a `wa.me` link the seller clicks.

Confirmed orders are treated as accepted (label 0) and cancelled orders as refused (label 1) the next time you score. No-response is excluded.

### Why open-source AI

- **Buyer privacy.** Phone and street address are encrypted at rest (AES-GCM). Lists mask the phone. Ollama keeps address text on a machine you control.
- **No per-call model bill on the default path.** With no keys, scoring is scikit-learn on your own history.
- **Small data.** TabPFN is built to train in-context on hundreds of rows, which is what a 20–500 order/day shop actually has.
- **Offline Gemma.** `OLLAMA_BASE_URL` runs Gemma locally. AI Studio is the hosted open-weight option, not a closed model.

## Model evaluation

Held-out split on the synthetic shop (`apps/ml`, seed 42, 360 labelled orders). No API keys, so this is the scikit-learn fallback. Re-run with `python -m app.eval_sample` from `apps/ml`. GitHub Actions workflow **Model evaluation** does that every Monday and on demand.

| Metric | Result |
| --- | --- |
| Model | scikit-learn gradient boosting |
| AUC | **0.793** |
| Precision in the riskiest 10% | **1.00** |
| Train / test | 288 / 72 |
| COD RTO rate in the generator | 70% |
| Prepaid RTO rate in the generator | 18% |

These numbers describe the synthetic set, which was built so COD, weak addresses, new buyers, and repeat refusers return more often. They are not a claim about a live shop. Each seller’s dashboard shows their own held-out AUC after they score.

## Setup

Requirements: Node.js 22, Python 3.12, and optionally Docker.

```bash
cp .env.example .env
npm ci
python3 -m pip install -r apps/ml/requirements-dev.txt

# three terminals
npm run dev:api
npm run dev:web
cd apps/ml && python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open http://localhost:3000. Create a shop, open History, press **Try with sample data**, then Score.

Without `MONGODB_URI` the API uses an in-memory database and warns you. Without `JWT_SECRET` / `ENCRYPTION_KEY` it uses development secrets and says so. `NODE_ENV=production` refuses to boot without `MONGODB_URI`, `JWT_SECRET`, and `ENCRYPTION_KEY`.

### Docker Compose

```bash
docker compose up --build
```

Web http://localhost:3000, API http://localhost:4000, ML http://localhost:8000, Mongo on 27017.

Privacy-max Gemma:

```bash
docker compose --profile ollama up --build
docker compose exec ollama ollama pull gemma3:4b
```

Then set `OLLAMA_BASE_URL=http://ollama:11434` on the ML service.

### Tests

```bash
npm test          # Jest (API, including in-memory Mongo) and Vitest (web)
npm run lint
npm run typecheck
npm run build
cd apps/ml && ruff check app tests && pytest
```

### CSV columns

Column mapping is a step after upload. Presets:

| Source | Identity columns |
| --- | --- |
| Generic | `order_id`, `buyer_name`, `phone`, `address`, `pincode`, `order_value`, `payment_type`, `outcome` |
| Shopify export | `Name`, `Shipping Name`, `Shipping Address1`, `Shipping Zip`, `Total`, `Payment Method` |
| Meesho-style | `Sub Order No`, `Customer Name`, `Mobile`, `Address`, `Pincode`, `Price`, `Payment Mode`, `Order Status` |

Files: `apps/web/public/samples/`. History rows need a delivered or RTO outcome. Empty payment is treated as COD. Shopify `paid` is prepaid; `pending` is treated as COD. `prior_orders` and `prior_rtos` default to 0. Re-importing the same order id skips the duplicate. **Try with sample data** replaces previous sample rows and leaves real uploads.

Upload cap: 5 MB, 5,000 rows. Export prefixes cells that start with `=`, `+`, `-`, or `@`.

## Deploy on Vercel

The Next.js app is the Vercel project. The API and ML service stay on Render.

In the Vercel dashboard: Add New → Project → this repo, then set:

| Setting | Value |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | `apps/web` |
| Include source files outside of the Root Directory | On |
| Install Command | `cd ../.. && npm ci` |
| Build Command | `npm run build` |
| Output | Next.js default (do not set a static output directory) |

`apps/web/vercel.json` already sets the install command, the build command, and a 60 second max duration on the `/api` proxy. The browser calls same-origin `/api/*`. The server route proxies to `API_URL` and forwards every `Set-Cookie`, so auth cookies stay on the Vercel host.

Production environment variables:

| Name | Value |
| --- | --- |
| `API_URL` | `https://api.rtoshield.tech` |
| `NEXT_PUBLIC_API_HEALTH_URL` | Optional. Defaults to `https://api.rtoshield.tech/api/health`. |
| `NEXT_PUBLIC_ML_HEALTH_URL` | Optional. Defaults to `https://ml.rtoshield.tech/health`. |
| `SENTRY_DSN` | Optional. Server-side Sentry for the Next server. Leave empty to disable. |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional. Browser Sentry. Leave empty to disable. |

Leave `API_URL` as a server variable. It has no `NEXT_PUBLIC_` prefix. The browser does not need either `NEXT_PUBLIC_*_HEALTH_URL`: production hosts already call `https://api.rtoshield.tech/api/health` and `https://ml.rtoshield.tech/health` directly. The same-origin proxy is only the readiness check and the authenticated API.

Vercel Hobby request bodies are about 4.5 MB. Keep CSV uploads under that even though the app allows 5 MB. Authenticated proxy calls wait up to 55 seconds. Health polls through the proxy give up after 9 seconds so a cold start cannot pin the function; the browser's direct request is the one that stays open for the spin-up.

## Deploy on Render

`render.yaml` is a Blueprint with two free web services. The Next.js app is not in the file.

1. **rto-shield-ml** — Python, `uvicorn`, health `/health`, `plan: free`.
2. **rto-shield-api** — Node, `npm run start -w @rto/api`, health `/api/health`, `plan: free`.

In the Render dashboard: New → Blueprint → this repo.

After the first create:

1. Set **MONGODB_URI** on the API to a MongoDB Atlas connection string.
2. Set **WEB_ORIGIN** on the API to `https://www.rtoshield.tech`. Add more origins separated by commas (`https://www.rtoshield.tech,http://localhost:3000`) when a local web app should call this API. No trailing slash.
3. `ML_SERVICE_URL` on the API is wired with `fromService` to the ML service’s Render URL. The public name of that service is `https://ml.rtoshield.tech`. Either URL reaches the same process.
4. Optional keys (`GEMINI_API_KEY`, `OLLAMA_BASE_URL`, `ELEVENLABS_API_KEY`, `SERPAPI_KEY`, `SENTRY_DSN`) can stay empty. The shop still scores. `TABPFN_TOKEN`, when set, is used by `tabpfn-client` (installed in `apps/ml/requirements.txt`). `GET /health` then reports `active_predictor: tabpfn-client`. If the TabPFN API errors, scoring falls back to scikit-learn. The local `tabpfn` package is left out so the 512MB instance does not install PyTorch.
5. `JWT_SECRET`, `ENCRYPTION_KEY`, and `ML_INTERNAL_TOKEN` are generated by the Blueprint. Keep them.

Free instances sleep after about 15 minutes. The first request after idle can take 50 seconds or more, and Render only starts the instance if that request stays connected. A 3 second abort from the Vercel proxy does not count. On `rtoshield.tech` and `*.vercel.app`, the page holds a no-cors browser request open against `https://api.rtoshield.tech/api/health` and `https://ml.rtoshield.tech/health` for up to 75 seconds, and repeats it until both answer. The loader treats HTTP 502, 503, 504, and timeouts as “still waking”. It hides only after both return `{ ok: true }`, either from those direct calls or from the same-origin proxy. `GET /api/health` does not touch MongoDB, so it can answer as soon as the process boots. `GET /health` on the ML service is public, skips the model, and allows the web origins. Atlas network access must allow Render.

## Environment variables

See `.env.example`. Every integration degrades when its key is missing.

| Variable | Used by | Required |
| --- | --- | --- |
| `MONGODB_URI` | API | Production only. Dev falls back to in-memory Mongo. |
| `JWT_SECRET` | API | Production only. Dev uses a warning secret. |
| `ENCRYPTION_KEY` | API | Production only. 64 hex chars, 32-byte base64, or any passphrase (scrypt). Dev uses a warning key. |
| `WEB_ORIGIN` | API | CORS. Default `http://localhost:3000`. Comma-separated. Production: `https://www.rtoshield.tech`. |
| `ML_SERVICE_URL` | API | Default `http://127.0.0.1:8000`. Production public URL: `https://ml.rtoshield.tech`. |
| `ML_INTERNAL_TOKEN` | API and ML | Optional shared secret. If set on ML, predict/messages require the header. |
| `COOKIE_SAMESITE` | API | `lax` (default), `strict`, or `none`. |
| `COOKIE_SECURE` | API | `true` in production behind HTTPS. |
| `SENTRY_DSN` | API, web, ML | Optional. Spans record latency and token counts for Gemma and TabPFN. PII is stripped. |
| `SENTRY_TRACES_SAMPLE_RATE` | API, web, ML | Default `0.2`. |
| `ELEVENLABS_API_KEY` | API | Hindi audio and the Conversational AI agent. The server creates or updates the agent on boot and stores the id. Never commit the key. |
| `ELEVENLABS_AGENT_ID` | API | Optional. When set, boot updates this agent instead of searching by name. |
| `ELEVENLABS_WEBHOOK_SECRET` | API | HMAC secret from the post-call webhook. Set it from `node --experimental-strip-types scripts/elevenlabs-agent.mjs`. |
| `ELEVENLABS_PHONE_NUMBER_ID` | API | Optional Twilio number id in ElevenLabs. Without it, calls stay in the browser. |
| `ELEVENLABS_WEBHOOK_URL` | API | Optional. Default `https://api.rtoshield.tech/api/elevenlabs/webhook`. |
| `ELEVENLABS_VOICE_ID` | API | Optional. Default multilingual voice for the script player. |
| `ELEVENLABS_MODEL_ID` | API | Default `eleven_multilingual_v2`. |
| `SERPAPI_KEY` | API | Optional pincode search. Without it, embedded localities and PIN-prefix regions. |
| `RATE_LIMIT_MAX` | API | Default 300 / minute. |
| `AUTH_RATE_LIMIT_MAX` | API | Default 30 / 15 minutes on auth routes. |
| `BCRYPT_ROUNDS` | API | Default 12. |
| `API_URL` | Web server (Vercel) | Nest origin for the proxy. Production: `https://api.rtoshield.tech`. Server-side only. |
| `NEXT_PUBLIC_API_HEALTH_URL` | Web | Optional. Defaults to `https://api.rtoshield.tech/api/health`. |
| `NEXT_PUBLIC_ML_HEALTH_URL` | Web | Optional. Defaults to `https://ml.rtoshield.tech/health`. |
| `NEXT_PUBLIC_SENTRY_DSN` | Web | Optional browser Sentry. |
| `ML_CORS_ORIGINS` | ML | Extra browser origins for `GET /health`, comma-separated. `https://www.rtoshield.tech` and localhost are already allowed. |
| `TABPFN_TOKEN` | ML | Optional Prior Labs TabPFN. |
| `TABPFN_MAX_ROWS` | ML | Default 500 in-context rows. |
| `GEMINI_API_KEY` | ML | Optional Gemma via AI Studio. |
| `GEMMA_MODEL` | ML | Default `gemma-4-26b-a4b-it`. A 404 tries the other hosted Gemma ids. |
| `OLLAMA_BASE_URL` | ML | Optional. If set, preferred over AI Studio. |
| `OLLAMA_MODEL` | ML | Default `gemma3:4b`. |
| `MIN_TRAIN_ROWS` | ML | Default 30 labelled rows before a trained model. Below that, a rules prior. |
| `PORT` | API and web | Render sets this. Local defaults 4000 and 3000. |
| `KEY_ENCRYPTION_KEY` | API, Vercel | Master key that wraps Shopify, WhatsApp, and Gemini secrets. 64 hex chars, 32-byte base64, or a passphrase. Production will not store those secrets until it is set. Generate it yourself and keep it out of git. |
| `SHOPIFY_API_KEY` | API | Partner app client id. |
| `SHOPIFY_API_SECRET` | API, Vercel | Partner app secret. Vercel uses it to verify webhook HMAC before the API wakes. |
| `SHOPIFY_APP_URL` | API | Public app origin, `https://www.rtoshield.tech`. OAuth redirect is `{SHOPIFY_APP_URL}/api/shopify/callback`. |
| `SHOPIFY_SCOPES` | API | Default `read_orders,write_orders,read_fulfillments,read_customers,write_draft_orders`. Reinstall the app after adding `write_draft_orders`. |
| `SHOPIFY_API_VERSION` | API | Default `2026-10`. GraphQL Admin only. |
| `INBOX_DRAIN_SECRET` | API, Vercel | Shared secret for `POST /api/inbox/drain` and `POST /api/elevenlabs/agent`. |
| `WHATSAPP_VERIFY_TOKEN` | API, Vercel | Value you paste into the Meta webhook verify token field. |
| `META_GRAPH_VERSION` | API | Default `v23.0`. |
| `NEXT_PUBLIC_SHOPIFY_API_KEY` | Vercel | Public client id for the embedded App Bridge page. Same as `SHOPIFY_API_KEY`. |
| `MONGODB_URI` | Vercel | Same Atlas database, so the webhook route can write the `inbox` collection. |
| `ENCRYPTION_KEY` | Vercel | Same value as the API, so the inbox payload can be decrypted later. |

## Connect a dev store and a WhatsApp test number

Shopify (custom distribution, development store):

1. In the Partner Dashboard create an app and set the App URL to `https://www.rtoshield.tech/shopify`.
2. Allowed redirection URL: `https://www.rtoshield.tech/api/shopify/callback`.
3. Webhook URL is not pasted by hand for the order topics. After install the app subscribes with GraphQL. The endpoint that must answer is `https://www.rtoshield.tech/api/shopify/webhooks` (API version `2026-10`). Compliance topics can also be set to that same URL in the Partner Dashboard.
4. Put `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, and `KEY_ENCRYPTION_KEY` on the Render API. Put `SHOPIFY_API_SECRET`, `MONGODB_URI`, `ENCRYPTION_KEY`, `INBOX_DRAIN_SECRET`, and `KEY_ENCRYPTION_KEY` on Vercel.
5. In the app, open shop setup, enter `your-store.myshopify.com`, and approve the install. The last 60 days backfill on their own. CSV upload stays on the history page.

WhatsApp Cloud API (your own number):

1. In the Meta app, add the WhatsApp product and use the test number, or a number you verified.
2. Create a System User token with `whatsapp_business_messaging` and `whatsapp_business_management`.
3. In Settings, paste the permanent token, Phone Number ID, WABA ID, and the app secret. Press **Send test message** (the `hello_world` template) to a number allowed on the test app.
4. Press **Submit template** for `order_confirmation` (English and Hindi) and `order_confirmation_hinglish`. Wait until the status is `APPROVED`.
5. Callback URL: `https://www.rtoshield.tech/api/whatsapp/webhook`. Verify token: the value of `WHATSAPP_VERIFY_TOKEN` (set the same value on Vercel and Render). Subscribe to the `messages` field.
6. In the queue, **Approve & send** uses that template. Confirm and Cancel buttons mark the order and tag it in Shopify. Auto-cancel in Shopify stays off until you turn it on. If WhatsApp is not connected, the queue keeps the `wa.me` link.

The demo shop is already marked Shopify-connected (`asha-studio.myshopify.com`) with no live token, so the flow is visible without a Partner install. Gemini notes for a real shop use that seller's key. The platform `GEMINI_API_KEY` is only the demo fallback.

See `docs/shopify-production.md` for the public app, Level 2 protected data, and `read_all_orders`.

## Create the voice agent

`ELEVENLABS_API_KEY` stays on the Render API. On boot the server creates or updates the agent named `RTO Shield order desk` and stores the id under the platform flag `elevenlabs.agentId`. Boot does not register the webhook, so a restart does not rotate the secret.

From a machine that has the key (the key is never printed):

```bash
ELEVENLABS_API_KEY=... npm run elevenlabs:agent
```

After the API is deployed, the same sync can run with the key that is already on Render. The caller does not send the key:

```bash
curl -sS -X POST https://api.rtoshield.tech/api/elevenlabs/agent \
  -H "x-inbox-secret: $INBOX_DRAIN_SECRET"
```

Both print `agentId`. `webhookSecret` appears only when ElevenLabs issues a new one. Put that value in `ELEVENLABS_WEBHOOK_SECRET` on Render, and put `agentId` in `ELEVENLABS_AGENT_ID`. For real outbound calls, import a Twilio number in ElevenLabs and set `ELEVENLABS_PHONE_NUMBER_ID`. Without that id, Call the buyer stays in the browser. Reinstall the Shopify app so `write_draft_orders` is granted, then resync webhooks so `orders/paid` is subscribed. The post-call URL is `https://api.rtoshield.tech/api/elevenlabs/webhook`.

## Security notes

- Passwords: bcrypt. Access JWT 15 minutes, refresh 7 days, both httpOnly. Logout bumps a token version.
- CSRF: cookie compared to `x-csrf-token` with a timing-safe check on every mutating request.
- Seller id is part of every order query. A missing order is a 404 for other sellers too.
- Settings can export or delete orders, or delete the account (password required).
- Rate limits are in-memory. More than one API instance needs a shared store; this build is one instance.

## Credits

- [TabPFN](https://github.com/PriorLabs/TabPFN) by Prior Labs (Hollmann et al.) — in-context tabular model. Optional client or local package.
- [Gemma](https://ai.google.dev/gemma) by Google — open-weight address notes and confirmation drafts, via AI Studio or Ollama.
- scikit-learn gradient boosting — deterministic fallback when TabPFN is not configured.
- NestJS, Next.js, FastAPI, MongoDB, Tailwind, Sentry, and the optional ElevenLabs and SerpApi clients.
- PIN-prefix regions and the embedded locality list are public postal geography, written for this repo. They are context, not a risk score.

MIT License. Copyright (c) 2026 Ranbir Singh.

## Still missing

- No card checkout. ₹499/month is the suggested price, not a billed plan.
- Demo GIFs are still not recorded in `docs/demo/`. Use **Open the demo shop** on the landing page instead.
- `tabpfn-client` is installed with the ML service. With `TABPFN_TOKEN` set, `GET /health` reports `active_predictor: tabpfn-client` (shown in the app as TabPFN) and scoring calls the Prior Labs API. A TabPFN API error falls back to scikit-learn. The local `tabpfn` package is optional and pulls PyTorch (`apps/ml/requirements-optional.txt`).
- Rate limiting and sessions are single-process.
- Render free spin-down for the API and ML service is expected. The Vercel app stays up and shows a wake-up screen. Atlas IP access is an operator step.
