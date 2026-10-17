# Shopify production checklist

The app runs today as a **custom distribution** app on development stores. A public App Store listing is a separate Partner app. Distribution method cannot be changed later.

## Now (dev stores)

- Create the app in the Partner Dashboard with custom distribution.
- App URL: `https://www.rtoshield.tech/shopify`
- Allowed redirection URL: `https://www.rtoshield.tech/api/shopify/callback`
- Webhook API version: `2026-10` (override with `SHOPIFY_API_VERSION`).
- Scopes: `read_orders`, `write_orders`, `read_fulfillments`, `read_customers`.
- On a dev store, select the protected customer fields (name, phone, address) in the Partner Dashboard. They return data without Level 2 approval. Until that access is on, the import status says `Shopify hasn't approved customer-data access for this app yet`. The API log keeps the GraphQL code and a scrubbed message. It never stores the access token, email, or phone.
- Set `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SHOPIFY_SCOPES` on Render (API) and the same secret plus `SHOPIFY_API_SECRET` on Vercel (webhook HMAC).
- `NEXT_PUBLIC_SHOPIFY_API_KEY` on Vercel is the public client id for the embedded App Bridge page. It is the same value as `SHOPIFY_API_KEY`, not the secret.

## Before real merchant stores

Protected customer data on orders, fulfillments, and their webhooks requires **Level 2** approval. Until that is granted, the orders query that asks for name, phone, or address is rejected, and the import shows the reason above.

Level 2 asks for the Level 1 controls plus encrypted backups, separate test and production data, data-loss prevention, restricted staff access, and a data-protection review. This app already encrypts buyer fields (`ENCRYPTION_KEY`) and shop tokens (`KEY_ENCRYPTION_KEY`), and it deletes shop data on `shop/redact`.

`read_orders` only covers the last 60 days. Request `read_all_orders` only if a merchant needs older history. That scope is a separate Shopify approval.

## Public app

- Create a **new** Partner app for public distribution. Do not convert the dev app.
- Complete App Store review (embedded App Bridge, session behavior, privacy policy, and the compliance webhooks already implemented).
- Compliance topics `customers/data_request`, `customers/redact`, and `shop/redact` are declared in `shopify.app.toml` and accepted at `/api/shopify/webhooks`. Do not subscribe to `CUSTOMERS_DATA_REQUEST`, `CUSTOMERS_REDACT`, or `SHOP_REDACT` with `webhookSubscriptionCreate`. Shopify rejects those topics from the Admin API. They belong in the app config and the Partner Dashboard. The handlers stay in place for when Shopify delivers them.
- The embedded page at `/shopify` deep-links to the dashboard. Frame ancestors allow `admin.shopify.com` and `*.myshopify.com`.

## Webhook registration

Orders, fulfillments, refunds, and `app/uninstalled` are created with `webhookSubscriptionCreate` after install. The callback is the `uri` field (`https://www.rtoshield.tech/api/shopify/webhooks`). Resync lists current subscriptions and creates any of those topics that are missing. `userErrors` are logged. "Address for this topic has already been taken" counts as already registered.

## Webhook path

Shopify calls `https://www.rtoshield.tech/api/shopify/webhooks`. That Vercel route checks the HMAC, writes the raw body to the Mongo `inbox` collection (unique on the webhook id), and returns 200. The API drains the inbox on boot, every 30 seconds, and when Vercel calls `POST /api/inbox/drain` with `INBOX_DRAIN_SECRET`. Old webhook timestamps are accepted so Shopify retries still land.
