/** Structured address from a buyer reply. The phone number never enters this module. */

export interface ParsedAddress {
  street: string;
  landmark: string;
  city: string;
  state: string;
  pin: string;
}

export interface PostOffice {
  Name?: string;
  District?: string;
  State?: string;
  Block?: string;
  Division?: string;
}

export function stripReplyPhones(text: string) {
  return text
    .replace(/(?:\+?\s*91[\s-]*)?[6-9](?:[\s-]*\d){9}/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 400);
}

export function parseAddressJson(raw: string): ParsedAddress | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let body: unknown;
  try {
    body = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!body || typeof body !== 'object') return null;
  const row = body as Record<string, unknown>;
  const pin = String(row.pin || row.pincode || '').replace(/\D/g, '').slice(0, 6);
  return {
    street: clip(row.street),
    landmark: clip(row.landmark),
    city: clip(row.city),
    state: clip(row.state),
    pin: pin.length === 6 ? pin : '',
  };
}

function clip(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 160);
}

export function normPlace(value: string) {
  return value.toLowerCase().replace(/[^a-z]/g, '');
}

function placeMatch(wanted: string, candidates: Array<string | undefined>) {
  const needle = normPlace(wanted);
  if (!needle) return false;
  return candidates.some((candidate) => {
    const hay = normPlace(candidate || '');
    if (!hay) return false;
    return hay === needle || hay.includes(needle) || needle.includes(hay);
  });
}

export function matchPostOffices(
  parsed: ParsedAddress,
  offices: PostOffice[],
): { ok: true; address: ParsedAddress } | { ok: false; why: string } {
  if (!/^\d{6}$/.test(parsed.pin)) return { ok: false, why: 'The reply had no 6-digit pin' };
  if (!offices.length) return { ok: false, why: 'India Post does not list this pin' };
  const cityWanted = parsed.city.trim();
  const stateWanted = parsed.state.trim();
  const cityOffices = cityWanted
    ? offices.filter((office) => placeMatch(cityWanted, [office.Name, office.District, office.Block, office.Division]))
    : offices;
  if (cityWanted && !cityOffices.length) return { ok: false, why: 'The city does not match this pin' };
  const stateOffices = stateWanted
    ? cityOffices.filter((office) => placeMatch(stateWanted, [office.State]))
    : cityOffices;
  if (stateWanted && !stateOffices.length) return { ok: false, why: 'The state does not match this pin' };
  const office = stateOffices[0] || cityOffices[0];
  if (!parsed.street && !parsed.landmark) return { ok: false, why: 'The reply had no street' };
  return {
    ok: true,
    address: {
      street: parsed.street,
      landmark: parsed.landmark,
      city: cityWanted || office?.District || office?.Name || '',
      state: stateWanted || office?.State || '',
      pin: parsed.pin,
    },
  };
}

export function indiaPostOffices(body: unknown): PostOffice[] {
  const row = Array.isArray(body) ? body[0] : body;
  if (!row || typeof row !== 'object') return [];
  const record = row as { Status?: string; PostOffice?: PostOffice[] | null };
  if (record.Status !== 'Success' || !Array.isArray(record.PostOffice)) return [];
  return record.PostOffice;
}

export async function fetchIndiaPost(pin: string, fetchImpl: typeof fetch = fetch): Promise<PostOffice[]> {
  if (!/^\d{6}$/.test(pin)) return [];
  const response = await fetchImpl(`https://api.postalpincode.in/pincode/${pin}`, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) return [];
  return indiaPostOffices(await response.json());
}

const PARSE_PROMPT = `Extract one Indian delivery address from the buyer message.
Reply with JSON only: {"street":"","landmark":"","city":"","state":"","pin":""}
pin is six digits or empty. Do not include a phone number.
Message:
`;

export async function askGeminiForAddress(key: string, message: string, fetchImpl: typeof fetch = fetch): Promise<ParsedAddress | null> {
  const text = stripReplyPhones(message);
  if (!key || text.length < 6) return null;
  const response = await fetchImpl(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${PARSE_PROMPT}${text.slice(0, 500)}` }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(12_000),
    },
  );
  if (!response.ok) return null;
  const body = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const raw = body.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
  return parseAddressJson(raw);
}
