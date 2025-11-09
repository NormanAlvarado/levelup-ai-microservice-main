import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WorkoutController } from './workout.controller';
import { WorkoutService } from './workout.service';
import { ExternalApisModule } from '../external-apis/external-apis.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { RateLimitModule } from '../shared/services/rate-limit.module';

@Module({
  imports: [ConfigModule, ExternalApisModule, SupabaseModule, RateLimitModule],
  controllers: [WorkoutController],
  providers: [WorkoutService],
  exports: [WorkoutService],
})
export class WorkoutModule {}