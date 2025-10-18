import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { OpenAiProvider } from './openai.provider';
import { GeminiProvider } from './gemini.provider';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [OpenAiProvider, GeminiProvider],
  exports: [OpenAiProvider, GeminiProvider],
})
export class ExternalApisModule {}