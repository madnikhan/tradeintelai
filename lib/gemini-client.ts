/**
 * Server-side Google Gemini client wrapper.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  getGeminiKeyFromEnv,
  getGeminiTextModel,
  getGeminiVisionModel,
} from '@/lib/gemini-key-fingerprint';

export type GeminiGenerateOptions = {
  system?: string;
  user: string;
  json?: boolean;
  model?: string;
};

export type GeminiVisionOptions = GeminiGenerateOptions & {
  imageBase64: string;
  mimeType?: string;
};

function getClient(): GoogleGenerativeAI {
  const apiKey = getGeminiKeyFromEnv();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY missing in .env.local');
  }
  return new GoogleGenerativeAI(apiKey);
}

function buildPrompt(system: string | undefined, user: string): string {
  if (system?.trim()) {
    return `${system.trim()}\n\n${user}`;
  }
  return user;
}

export async function generateGeminiText(
  options: GeminiGenerateOptions
): Promise<{ text: string }> {
  const genAI = getClient();
  const modelName = options.model || getGeminiTextModel();
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048,
      ...(options.json ? { responseMimeType: 'application/json' } : {}),
    },
  });

  const result = await model.generateContent(buildPrompt(options.system, options.user));
  const text = result.response.text();
  return { text: text || '' };
}

export async function generateGeminiWithImage(
  options: GeminiVisionOptions
): Promise<{ text: string }> {
  const genAI = getClient();
  const modelName = options.model || getGeminiVisionModel();
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
      ...(options.json ? { responseMimeType: 'application/json' } : {}),
    },
  });

  const mimeType = options.mimeType || 'image/png';
  const result = await model.generateContent([
    buildPrompt(options.system, options.user),
    {
      inlineData: {
        mimeType,
        data: options.imageBase64,
      },
    },
  ]);

  const text = result.response.text();
  return { text: text || '' };
}
