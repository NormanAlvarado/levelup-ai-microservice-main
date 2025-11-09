import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DietController } from './diet.controller';
import { DietService } from './diet.service';
import { ExternalApisModule } from '../external-apis/external-apis.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { RateLimitModule } from '../shared/services/rate-limit.module';

@Module({
  imports: [ConfigModule, ExternalApisModule, SupabaseModule, RateLimitModule],
  controllers: [DietController],
  providers: [DietService],
  exports: [DietService],
})
export class DietModule {}