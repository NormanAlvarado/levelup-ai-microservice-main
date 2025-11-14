import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

interface TokenUsage {
  workoutTokensUsed: number;
  dietTokensUsed: number;
}

interface SubscriptionLimits {
  plan: string;
  workoutTokensPerMonth: number;
  dietTokensPerMonth: number;
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('supabase.url');
    const supabaseKey = this.configService.get<string>('supabase.serviceKey');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async checkAndIncrementTokens(
    userId: string,
    type: 'workout' | 'diet',
  ): Promise<void> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // 1. Obtener límites de suscripción del usuario
    const { data: subscription } = await this.supabase
      .from('user_subscriptions')
      .select('plan')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    const plan = subscription?.plan || 'free';

    const { data: limits } = await this.supabase
      .from('subscription_limits')
      .select('workout_tokens_per_month, diet_tokens_per_month')
      .eq('plan', plan)
      .single();

    if (!limits) {
      throw new HttpException('Plan de suscripción no encontrado', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // 2. Obtener o crear registro de uso mensual
    let { data: usage } = await this.supabase
      .from('user_token_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', month)
      .single();

    if (!usage) {
      const { data: newUsage, error } = await this.supabase
        .from('user_token_usage')
        .insert([{
          user_id: userId,
          year,
          month,
          workout_tokens_used: 0,
          diet_tokens_used: 0,
        }])
        .select()
        .single();

      if (error) {
        this.logger.error('Error creating token usage record:', error);
        throw new HttpException('Error al crear registro de uso', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      usage = newUsage;
    }

    // 3. Verificar límites (salta validación si el plan es ilimitado con -1)
    const currentWorkoutTokens = usage.workout_tokens_used || 0;
    const currentDietTokens = usage.diet_tokens_used || 0;

    const isWorkoutUnlimited = limits.workout_tokens_per_month === -1;
    const isDietUnlimited = limits.diet_tokens_per_month === -1;

    // Solo verificar límites si NO es ilimitado
    if (type === 'workout' && !isWorkoutUnlimited && currentWorkoutTokens >= limits.workout_tokens_per_month) {
      throw new HttpException(
        `Has alcanzado tu límite mensual de ${limits.workout_tokens_per_month} rutinas. Mejora tu plan a Premium para generar rutinas ilimitadas.`,
        HttpStatus.FORBIDDEN,
      );
    }

    if (type === 'diet' && !isDietUnlimited && currentDietTokens >= limits.diet_tokens_per_month) {
      throw new HttpException(
        `Has alcanzado tu límite mensual de ${limits.diet_tokens_per_month} planes de dieta. Mejora tu plan a Premium para generar planes ilimitados.`,
        HttpStatus.FORBIDDEN,
      );
    }

    // 4. Incrementar contador
    const { error: updateError } = await this.supabase
      .from('user_token_usage')
      .update({
        [type === 'workout' ? 'workout_tokens_used' : 'diet_tokens_used']:
          type === 'workout' ? currentWorkoutTokens + 1 : currentDietTokens + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', usage.id);

    if (updateError) {
      this.logger.error('Error updating token usage:', updateError);
      throw new HttpException('Error al actualizar uso de tokens', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const newCount = type === 'workout' ? currentWorkoutTokens + 1 : currentDietTokens + 1;
    const limit = type === 'workout' ? limits.workout_tokens_per_month : limits.diet_tokens_per_month;
    const limitDisplay = limit === -1 ? 'ilimitado' : limit;

    this.logger.log(
      `✅ Token ${type} incrementado para usuario ${userId}: ${newCount}/${limitDisplay}`,
    );
  }

  async getUserTokenUsage(userId: string): Promise<{
    plan: string;
    workoutTokensUsed: number;
    workoutTokensLimit: number;
    dietTokensUsed: number;
    dietTokensLimit: number;
    month: number;
    year: number;
  }> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const { data: subscription } = await this.supabase
      .from('user_subscriptions')
      .select('plan')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    const plan = subscription?.plan || 'free';

    const { data: limits } = await this.supabase
      .from('subscription_limits')
      .select('workout_tokens_per_month, diet_tokens_per_month')
      .eq('plan', plan)
      .single();

    const { data: usage } = await this.supabase
      .from('user_token_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', month)
      .single();

    return {
      plan,
      workoutTokensUsed: usage?.workout_tokens_used || 0,
      workoutTokensLimit: limits?.workout_tokens_per_month || 0,
      dietTokensUsed: usage?.diet_tokens_used || 0,
      dietTokensLimit: limits?.diet_tokens_per_month || 0,
      month,
      year,
    };
  }
}
