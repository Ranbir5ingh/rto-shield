import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { embeddedLocality, FAIRNESS_NOTE, regionFor } from '../common/pincodes';
import { traceSpan } from '../common/trace';
import { PincodeCache } from '../database/pincode-cache.schema';

export interface PincodeView {
  pincode: string;
  region: string | null;
  locality: string | null;
  state: string | null;
  snippets: Array<{ title: string; snippet: string }>;
  source: string;
  notice: string | null;
  fairness: string;
}

@Injectable()
export class PincodeService {
  private readonly logger = new Logger(PincodeService.name);

  constructor(
    @InjectModel(PincodeCache.name) private readonly cache: Model<PincodeCache>,
    private readonly config: ConfigService,
  ) {}

  configured() {
    return Boolean(this.config.get<string>('SERPAPI_KEY'));
  }

  async lookup(pincode: string): Promise<PincodeView> {
    const cached = await this.cache.findOne({ pincode, expiresAt: { $gt: new Date() } }).lean();
    if (cached?.payload) {
      return { ...(cached.payload as unknown as PincodeView), source: 'cache' };
    }
    const embedded = embeddedLocality(pincode);
    const base: PincodeView = {
      pincode,
      region: regionFor(pincode),
      locality: embedded?.locality ?? null,
      state: embedded?.state ?? null,
      snippets: [],
      source: embedded ? 'embedded-locality' : 'pin-prefix',
      notice: null,
      fairness: FAIRNESS_NOTE,
    };
    const apiKey = this.config.get<string>('SERPAPI_KEY');
    if (!apiKey) {
      return {
        ...base,
        notice: 'Live courier-issue search needs SERPAPI_KEY. Showing public locality context only.',
      };
    }
    try {
      const snippets = await traceSpan('serpapi.pincode', 'http.client', { pincode }, () => this.search(pincode, apiKey));
      const view: PincodeView = { ...base, snippets, source: 'serpapi', notice: null };
      await this.cache.updateOne(
        { pincode },
        { $set: { payload: view, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } },
        { upsert: true },
      );
      return view;
    } catch (error) {
      this.logger.warn(`SerpApi failed: ${error instanceof Error ? error.name : 'error'}`);
      return { ...base, notice: 'SerpApi lookup failed. Showing public locality context only.' };
    }
  }

  private async search(pincode: string, apiKey: string) {
    const query = encodeURIComponent(`${pincode} pincode courier delivery`);
    const response = await fetch(`https://serpapi.com/search.json?engine=google&q=${query}&api_key=${apiKey}`, {
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const body = (await response.json()) as { organic_results?: Array<{ title?: string; snippet?: string }> };
    return (body.organic_results || []).slice(0, 3).map((item) => ({
      title: String(item.title || '').slice(0, 180),
      snippet: String(item.snippet || '').slice(0, 280),
    }));
  }
}
