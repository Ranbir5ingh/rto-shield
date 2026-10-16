import { SiteHeader } from '@/components/SiteHeader';

export default function PrivacyPage() {
  return (
    <div>
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">Privacy</p>
      <h1 className="mt-3 font-display font-medium text-display-2">What leaves the shop</h1>
      <div className="mt-8 space-y-5 text-base leading-7 text-ink/80">
        <p>
          Buyer phone numbers and street addresses are encrypted at rest with AES-GCM. The key comes from
          ENCRYPTION_KEY. If that variable is missing, the API uses a development key and says so in the product.
          Do not store real orders in that mode.
        </p>
        <p>
          Every order query is scoped to the logged-in seller. Export and delete live in Settings. Phone numbers are
          masked in lists. Logs are not supposed to contain phones, addresses, passwords, or tokens.
        </p>
        <p>
          The model sees numbers: order value, COD or prepaid, time of day, how often this buyer has ordered and
          returned, address-quality flags, and how often your own earlier orders to that pincode came back. It does
          not see the phone, the buyer’s name, or the pincode itself. A pincode can be shown as courier context. It
          is never a ban.
        </p>
        <p>
          Phone numbers are not sent to TabPFN, Gemma, SerpApi, or ElevenLabs. The Hindi voice script is shop name
          and amount only. Addresses are sent to your own ML service so it can score quality. From there they reach
          Gemma only when GEMINI_API_KEY or OLLAMA_BASE_URL is set.
        </p>
        <p>
          Ollama is the privacy-max option: Gemma runs on a machine you control, including fully offline. AI Studio
          serves the same open-weight Gemma family when you prefer not to host it. Closed-model APIs are not on the
          scoring path.
        </p>
        <p>Uploads are capped (about 5 MB, 5,000 rows). CSV export prefixes cells that start with =, +, -, or @ so a spreadsheet does not treat them as formulas.</p>
      </div>
      </div>
    </div>
  );
}
