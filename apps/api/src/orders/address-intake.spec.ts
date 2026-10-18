import { askGeminiForAddress, indiaPostOffices, matchPostOffices, parseAddressJson, stripReplyPhones } from './address-intake';

const offices = [
  { Name: 'Indiranagar', District: 'Bengaluru', State: 'Karnataka', Block: 'Bangalore North', Division: 'Bengaluru East' },
];

describe('address intake', () => {
  it('strips a phone before the reply is parsed', () => {
    expect(stripReplyPhones('12 Indira Nagar 9845012345 Bengaluru')).toBe('12 Indira Nagar Bengaluru');
  });

  it('reads Gemini JSON', () => {
    const parsed = parseAddressJson('```json\n{"street":"12 4th Main","landmark":"near cafe","city":"Bengaluru","state":"Karnataka","pin":"560038"}\n```');
    expect(parsed).toEqual({
      street: '12 4th Main',
      landmark: 'near cafe',
      city: 'Bengaluru',
      state: 'Karnataka',
      pin: '560038',
    });
  });

  it('accepts a pin only when India Post agrees on city and state', () => {
    const parsed = { street: '12 4th Main', landmark: 'near cafe', city: 'Bengaluru', state: 'Karnataka', pin: '560038' };
    const matched = matchPostOffices(parsed, indiaPostOffices([{ Status: 'Success', PostOffice: offices }]));
    expect(matched.ok).toBe(true);
    if (matched.ok) expect(matched.address.pin).toBe('560038');
    expect(matchPostOffices({ ...parsed, city: 'Mumbai' }, offices).ok).toBe(false);
    expect(matchPostOffices({ ...parsed, state: 'Delhi' }, offices).ok).toBe(false);
    expect(matchPostOffices(parsed, []).ok).toBe(false);
  });

  it('fills city and state from the post office when the reply omitted them', () => {
    const matched = matchPostOffices(
      { street: '12 4th Main', landmark: '', city: '', state: '', pin: '560038' },
      offices,
    );
    expect(matched.ok).toBe(true);
    if (matched.ok) {
      expect(matched.address.city).toBe('Bengaluru');
      expect(matched.address.state).toBe('Karnataka');
    }
  });

  it('does not send the reply to Gemini without a key', async () => {
    const seen: string[] = [];
    const fetchImpl = (async (url: string) => {
      seen.push(url);
      return new Response('{}');
    }) as typeof fetch;
    expect(await askGeminiForAddress('', '12 Main Bengaluru 560038', fetchImpl)).toBeNull();
    expect(seen).toEqual([]);
  });
});
