import { Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { SupabaseModule } from '../../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}
