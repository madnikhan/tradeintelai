import {
  getOpenAIKeyFromEnv,
  getOpenAITextModel,
  getOpenAIVisionModel,
} from '@/lib/openai-key-fingerprint';
import type { AIChatBody } from '@/lib/ai-types';

function getApiKey(): string {
  const key = getOpenAIKeyFromEnv();
  if (!key) throw new Error('OPENAI_API_KEY missing in .env.local');
  return key;
}

async function chatCompletion(body: Record<string, unknown>): Promise<{ text: string }> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data: { choices?: { message?: { content?: string } }[]; error?: { message?: string } } = {};
  try {
    data = JSON.parse(text);
  } catch {
    if (!response.ok) throw new Error(text.slice(0, 300) || `HTTP ${response.status}`);
  }

  if (!response.ok) {
    throw new Error(data.error?.message || `HTTP ${response.status}`);
  }

  return { text: data.choices?.[0]?.message?.content || '' };
}

export async function generateOpenAIText(
  options: Pick<AIChatBody, 'system' | 'user' | 'json'>
): Promise<{ text: string }> {
  const messages: { role: string; content: string }[] = [];
  if (options.system?.trim()) {
    messages.push({ role: 'system', content: options.system.trim() });
  }
  messages.push({ role: 'user', content: options.user });

  return chatCompletion({
    model: getOpenAITextModel(),
    messages,
    temperature: 0.4,
    max_completion_tokens: 2048,
    ...(options.json ? { response_format: { type: 'json_object' } } : {}),
  });
}

export async function generateOpenAIWithImage(
  options: Pick<AIChatBody, 'system' | 'user' | 'json'> & { imageBase64: string }
): Promise<{ text: string }> {
  const messages: { role: string; content: string | unknown[] }[] = [];
  if (options.system?.trim()) {
    messages.push({ role: 'system', content: options.system.trim() });
  }
  messages.push({
    role: 'user',
    content: [
      { type: 'text', text: options.user },
      {
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${options.imageBase64}` },
      },
    ],
  });

  return chatCompletion({
    model: getOpenAIVisionModel(),
    messages,
    temperature: 0.3,
    max_completion_tokens: 2048,
    ...(options.json ? { response_format: { type: 'json_object' } } : {}),
  });
}
