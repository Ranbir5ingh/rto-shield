import { SiteHeader } from '@/components/SiteHeader';

export default function PrivacyPage() {
  return (
    <div>
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 pb-28 pt-16 sm:px-8 md:pb-16 md:pt-32">
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
          Scoring does not send the phone, the buyer’s name, or the pincode to TabPFN, Gemma, or SerpApi. A WhatsApp
          send gives the phone to Meta. A live call gives the phone to ElevenLabs so it can dial. Browser mode and a
          Simulated call do not dial. Addresses go to the platform ML service for quality, and to Gemini on the API
          when a reply is parsed. Shops do not paste a Gemini key. Empty Gemini falls back to templates.
        </p>
        <p>
          Ollama is the privacy-max option: Gemma runs on a machine the platform controls, including fully offline.
          The platform GEMINI_API_KEY serves the same open-weight Gemma family when Ollama is not set. If neither
          answers, notes and drafts use built-in templates. Closed-model APIs are not on the scoring path.
        </p>
        <p>Uploads are capped (about 5 MB, 5,000 rows). CSV export prefixes cells that start with =, +, -, or @ so a spreadsheet does not treat them as formulas.</p>
      </div>
      </div>
    </div>
  );
}
