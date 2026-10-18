import {
  addressFixSkipDetail,
  askGeminiForAddress,
  indiaPostOffices,
  matchPostOffices,
  parseAddressJson,
  stripReplyPhones,
} from './address-intake';
import { DEMO_DEV_ADDRESS } from './demo-address';

const offices = [
  {
    Name: 'Indiranagar',
    District: 'Bengaluru',
    State: 'Karnataka',
    Block: 'Bangalore North',
    Division: 'Bengaluru East',
  },
];

describe('address intake', () => {
  it('strips a phone before the reply is parsed', () => {
    expect(stripReplyPhones('12 Indira Nagar 9845012345 Bengaluru')).toBe(
      '12 Indira Nagar Bengaluru',
    );
  });

  it('reads Gemini JSON', () => {
    const parsed = parseAddressJson(
      '```json\n{"street":"12 4th Main","landmark":"near cafe","city":"Bengaluru","state":"Karnataka","pin":"560038"}\n```',
    );
    expect(parsed).toEqual({
      street: '12 4th Main',
      landmark: 'near cafe',
      city: 'Bengaluru',
      state: 'Karnataka',
      pin: '560038',
    });
  });

  it('accepts a pin only when India Post agrees on city and state', () => {
    const parsed = {
      street: '12 4th Main',
      landmark: 'near cafe',
      city: 'Bengaluru',
      state: 'Karnataka',
      pin: '560038',
    };
    const matched = matchPostOffices(
      parsed,
      indiaPostOffices([{ Status: 'Success', PostOffice: offices }]),
    );
    expect(matched.ok).toBe(true);
    if (matched.ok) expect(matched.address.pin).toBe('560038');
    expect(matchPostOffices({ ...parsed, city: 'Mumbai' }, offices).ok).toBe(false);
    expect(matchPostOffices({ ...parsed, state: 'Delhi' }, offices).ok).toBe(false);
    expect(matchPostOffices(parsed, []).ok).toBe(false);
  });

  it('treats renamed cities as the same place, including case and spacing', () => {
    const bangalore = [
      {
        Name: 'Indiranagar S.O',
        District: 'Bangalore',
        State: 'Karnataka',
        Division: 'Bangalore East',
      },
    ];
    const matched = matchPostOffices({ ...DEMO_DEV_ADDRESS, city: '  Bengaluru ' }, bangalore);
    expect(matched.ok).toBe(true);
    if (matched.ok) expect(matched.address.city).toBe('Bengaluru');

    const pairs = [
      ['Mumbai', 'Bombay'],
      ['Gurugram', 'Gurgaon'],
      ['Kolkata', 'Calcutta'],
      ['Chennai', 'Madras'],
      ['Prayagraj', 'Allahabad'],
      ['Pune', 'Poona'],
      ['Kochi', 'Cochin'],
      ['Vadodara', 'Baroda'],
      ['Varanasi', 'Benares'],
      ['Mysuru', 'Mysore'],
      ['Thiruvananthapuram', 'Trivandrum'],
      ['Kozhikode', 'Calicut'],
    ];
    for (const [city, district] of pairs) {
      const result = matchPostOffices(
        { street: '1 Main Road', landmark: '', city, state: 'Karnataka', pin: '560038' },
        [{ Name: 'Head Post Office', District: district, State: 'Karnataka' }],
      );
      expect(result.ok).toBe(true);
    }

    const odisha = matchPostOffices(
      { street: '1 Main Road', landmark: '', city: 'Cuttack', state: 'Odisha', pin: '753001' },
      [{ Name: 'Cuttack', District: 'Cuttack', State: 'Orissa' }],
    );
    expect(odisha.ok).toBe(true);
  });

  it('accepts the pin district or state when the office name differs', () => {
    const offices = [{ Name: 'Indiranagar S.O', District: 'Bangalore', State: 'Karnataka' }];
    const byDistrict = matchPostOffices(
      {
        street: '12 Main',
        landmark: '',
        city: 'Bangalore Urban',
        state: 'Karnataka',
        pin: '560038',
      },
      offices,
    );
    expect(byDistrict.ok).toBe(true);
    const byState = matchPostOffices(
      { street: '12 Main', landmark: '', city: 'Karnataka', state: 'Karnataka', pin: '560038' },
      offices,
    );
    expect(byState.ok).toBe(true);
    const missed = matchPostOffices(
      { street: '12 Main', landmark: '', city: 'Mumbai', state: 'Karnataka', pin: '560038' },
      offices,
    );
    expect(missed.ok).toBe(false);
    if (!missed.ok) {
      expect(missed.why).toContain('Mumbai vs Bangalore');
      expect(addressFixSkipDetail(missed.why)).toBe(`Address fix skipped: ${missed.why}`);
    }
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
