import Anthropic from '@anthropic-ai/sdk';

import type { Settings } from './types';

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export const DEFAULT_MODELS: Record<Settings['aiProvider'], string> = {
  anthropic: 'claude-opus-5-5',
  openai: 'gpt-5',
  custom: '',
};

/**
 * The only network path that carries vehicle data off the device: a direct request
 * from this device to the provider the user configured, authenticated with their key.
 */
export async function askAssistant(opts: {
  settings: Settings;
  apiKey: string;
  system: string;
  turns: Turn[];
}): Promise<string> {
  const { settings, apiKey, system, turns } = opts;
  if (!apiKey && settings.aiProvider !== 'custom') throw new Error('No API key set. Add one in Settings.');
  const model = settings.aiModel || DEFAULT_MODELS[settings.aiProvider];
  if (!model) throw new Error('No model name set. Add one in Settings.');
  return settings.aiProvider === 'anthropic'
    ? askClaude(apiKey, model, system, turns)
    : askOpenAiCompatible(settings, apiKey, model, system, turns);
}

async function askClaude(apiKey: string, model: string, system: string, turns: Turn[]): Promise<string> {
  // The key belongs to the person using this device, so calling from the client is the intended design.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  try {
    const res = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      system,
      messages: turns,
      // If the model declines a request, let the API retry it on its default fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    if (res.stop_reason === 'refusal') {
      throw new Error(`The model declined this request${res.stop_details?.explanation ? `: ${res.stop_details.explanation}` : '.'}`);
    }
    const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n');
    if (!text) throw new Error('The model returned no text.');
    return res.stop_reason === 'max_tokens' ? `${text}\n\n[Reply cut off at the length limit]` : text;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('The API key was rejected (401). Check it in Settings.');
    if (e instanceof Anthropic.PermissionDeniedError) throw new Error('This key is not allowed to use that model (403).');
    if (e instanceof Anthropic.NotFoundError) throw new Error(`Model "${model}" was not found (404). Check the model name in Settings.`);
    if (e instanceof Anthropic.RateLimitError) throw new Error('Rate limited by the provider (429). Try again shortly.');
    if (e instanceof Anthropic.APIConnectionError) throw new Error('Could not reach api.anthropic.com. Check the network connection.');
    if (e instanceof Anthropic.APIError) throw new Error(`Provider error ${e.status ?? ''}: ${e.message}`);
    throw e;
  }
}

async function askOpenAiCompatible(
  settings: Settings,
  apiKey: string,
  model: string,
  system: string,
  turns: Turn[],
): Promise<string> {
  const base =
    settings.aiProvider === 'openai' ? 'https://api.openai.com/v1' : settings.aiBaseUrl.trim().replace(/\/+$/, '');
  if (!base) throw new Error('No base URL set for the custom endpoint. Add one in Settings.');
  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...turns] }),
    });
  } catch {
    throw new Error(`Could not reach ${base}. Check the network connection and that the endpoint allows this origin.`);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Provider error ${res.status}: ${body?.error?.message ?? res.statusText}`);
  const text = body?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text) throw new Error('The model returned no text.');
  return text;
}
