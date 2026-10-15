import { BadRequestException, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
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
  constructor(
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly ml: MlService,
    private readonly voices: VoiceService,
    private readonly pincodes: PincodeService,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
  ) {}

  @Get('integrations')
  async status() {
    const ml = await this.ml.health();
    return {
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
            ollama: ml.ollama_configured,
            tabpfnClientInstalled: ml.tabpfn_client_installed,
            tabpfnLocalInstalled: ml.tabpfn_local_installed,
          }
        : {
            reachable: false,
            activePredictor: null,
            tabpfnToken: false,
            gemini: false,
            ollama: false,
            tabpfnClientInstalled: false,
            tabpfnLocalInstalled: false,
          },
    };
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
