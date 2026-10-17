import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { VaultService } from './vault.service';

@Global()
@Module({
  providers: [CryptoService, VaultService],
  exports: [CryptoService, VaultService],
})
export class CryptoModule {}
