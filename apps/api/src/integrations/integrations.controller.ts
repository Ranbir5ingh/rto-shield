import { BadRequestException, Controller, Get, Logger, NotFoundException, Param, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CurrentUser } from '../common/current-user';
import { CryptoService } from '../common/crypto.service';
import { safeVoiceScript } from '../common/messages';
import { Order } from '../database/order.schema';
import type { UserDocument } from '../database/user.schema';
import { MlService } from '../ml/ml.service';
import { PincodeService } from './pincode.service';
import { VoiceService } from './voice.service';

@Controller()
export class IntegrationsController {
  private readonly logger = new Logger(IntegrationsController.name);
  private lastDevNotice = '';

  constructor(
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly ml: MlService,
    private readonly voices: VoiceService,
    private readonly pincodes: PincodeService,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
  ) {}

  @Get('integrations')
  async status(@CurrentUser() user: UserDocument) {
    const ml = await this.ml.health(4_000);
    const body = !vendorPanel(user.email)
      ? {
          sellerView: true,
          encryption: this.crypto.mode,
          mongodb: process.env.MONGODB_MODE === 'memory' ? 'memory' : 'configured',
          sentry: false,
          elevenlabs: false,
          serpapi: false,
          ml: ml
            ? {
                reachable: true,
                // The settings panel stays hidden. These two flags are what the notice reads.
                activePredictor: null,
                tabpfnToken: false,
                gemini: ml.gemini,
                gemmaReady: ml.gemma_ready ?? null,
                ollama: ml.ollama_configured,
                tabpfnClientInstalled: false,
                tabpfnLocalInstalled: false,
              }
            : {
                reachable: false,
                activePredictor: null,
                tabpfnToken: false,
                gemini: false,
                gemmaReady: null,
                ollama: false,
                tabpfnClientInstalled: false,
                tabpfnLocalInstalled: false,
              },
        }
      : {
          sellerView: false,
          encryption: this.crypto.mode,
          mongodb: process.env.MONGODB_MODE === 'memory' ? 'memory' : 'configured',
          sentry: Boolean(this.config.get<string>('SENTRY_DSN')),
          elevenlabs: this.voices.configured(),
          serpapi: this.pincodes.configured(),
          ml: ml
            ? {
                reachable: true,
                activePredictor: ml.active_predictor,
                tabpfnToken: ml.tabpfn_token,
                gemini: ml.gemini,
                gemmaReady: ml.gemma_ready ?? null,
                ollama: ml.ollama_configured,
                tabpfnClientInstalled: ml.tabpfn_client_installed,
                tabpfnLocalInstalled: ml.tabpfn_local_installed,
              }
            : {
                reachable: false,
                activePredictor: null,
                tabpfnToken: false,
                gemini: false,
                gemmaReady: null,
                ollama: false,
                tabpfnClientInstalled: false,
                tabpfnLocalInstalled: false,
              },
        };
    this.noteDevSetup(body);
    return body;
  }

  /** Production keeps these off the yellow bar. The same lines go to the API log once per change. */
  private noteDevSetup(status: Parameters<typeof integrationDevNotices>[0]) {
    if (process.env.NODE_ENV !== 'production') return;
    const line = integrationDevNotices(status).join(' | ');
    if (!line || line === this.lastDevNotice) return;
    this.lastDevNotice = line;
    this.logger.warn(line);
  }

  @Get('pincode/:pincode')
  pincode(@Param('pincode') pincode: string) {
    if (!/^[1-9][0-9]{5}$/.test(pincode)) {
      throw new BadRequestException('Enter a 6-digit Indian pincode');
    }
    return this.pincodes.lookup(pincode);
  }

  @Post('orders/:id/voice')
  async voice(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    const order = await this.orders.findOne({ _id: id, sellerId: user._id });
    if (!order) throw new NotFoundException('Order not found');
    const script = order.messages?.voice_script_hi || safeVoiceScript(user.shopName, order.orderValue);
    return this.voices.synthesize(script, user.shopName, order.orderValue);
  }
}

export function integrationDevNotices(status: {
  encryption: string;
  mongodb: string;
  ml: { reachable: boolean; activePredictor: string | null; gemini: boolean; gemmaReady?: boolean | null; ollama: boolean };
}): string[] {
  const notes = [
    status.encryption === 'development-fallback' ? 'Encryption key is unset. Set ENCRYPTION_KEY before real buyer data.' : null,
    status.mongodb === 'memory' ? 'Orders are in memory and disappear on restart.' : null,
    !status.ml.reachable ? 'The scoring service is not reachable. Uploads still save.' : null,
    status.ml.reachable && status.ml.activePredictor?.includes('sklearn')
      ? 'Scores use the scikit-learn fallback until TABPFN_TOKEN is set.'
      : null,
    gemmaQuiet(status.ml) ? 'Address notes and drafts use local templates until the platform Gemini key is set.' : null,
  ];
  return notes.filter((note): note is string => Boolean(note));
}

function gemmaQuiet(ml: { reachable: boolean; gemini: boolean; ollama: boolean; gemmaReady?: boolean | null }) {
  if (!ml.reachable || ml.ollama) return false;
  if (ml.gemmaReady === false) return true;
  return ml.gemmaReady == null && !ml.gemini;
}

function vendorPanel(email: string) {
  const allow = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (allow.includes(email.toLowerCase())) return true;
  return process.env.NODE_ENV !== 'production';
}
