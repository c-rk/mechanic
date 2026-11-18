import Anthropic from '@anthropic-ai/sdk';

import { DEFAULT_MODELS } from './ai';
import type { ResearchItem, ResearchKind } from './proxy';
import type { Settings, Vehicle } from './types';

const KINDS: ResearchKind[] = ['manual', 'forum', 'reddit', 'video', 'web', 'wiki'];

/**
 * Finds manuals, forum threads and guides with Claude's web search tool, using the owner's key.
 * Only year, make, model, trim, engine and the optional topic are sent.
 */
export async function aiResearch(v: Vehicle, settings: Settings, apiKey: string, topic = ''): Promise<ResearchItem[]> {
  if (settings.aiProvider !== 'anthropic') throw new Error('Web research with AI needs the Claude provider (Setup → Mechanic AI).');
  if (!apiKey) throw new Error('No API key set. Add one in Setup.');
  const model = settings.aiModel || DEFAULT_MODELS.anthropic;
  const vehicle = [v.year, v.make, v.model, v.trim, v.engine].filter(Boolean).join(' ');
  const system = [
    'You find reference material for a car owner. Use web search, then reply with one JSON array and nothing else (no prose, no code fences).',
    'Each element: {"kind": one of "manual" | "forum" | "reddit" | "video" | "web", "title": string, "url": string, "source": site name, "snippet": one or two factual sentences about what it contains}.',
    '"manual" = owner\'s manuals, service/repair/workshop manuals, maintenance schedules, wiring diagrams, technical service bulletins; prefer direct PDF links from manufacturers or reputable archives.',
    '"forum" = enthusiast forum threads; "reddit" = Reddit threads; "web" = articles, guides and reviews.',
    'Only include URLs you actually found in search results. Skip pirated downloads, link farms and pages behind a paywall. Return 12 to 25 items.',
  ].join('\n');
  const ask = topic
    ? `Vehicle: ${vehicle}. Find manuals, forum threads, Reddit threads and guides about: ${topic}.`
    : `Vehicle: ${vehicle}. Find: the owner's manual (PDF if available), service or repair manual sources, maintenance schedule, known common problems and fixes on enthusiast forums and Reddit, and good DIY guides.`;

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: ask }];
  let text = '';
  try {
    // Server tools can pause a long turn; continue it a few times if needed.
    for (let i = 0; i < 4; i++) {
      const res = await client.beta.messages.create({
        model,
        max_tokens: 16000,
        system,
        messages,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }],
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
      if (res.stop_reason === 'refusal') throw new Error('The model declined this request.');
      if (res.stop_reason === 'pause_turn') {
        messages.push({ role: 'assistant', content: res.content });
        continue;
      }
      text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
      break;
    }
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('The API key was rejected (401). Check it in Setup.');
    if (e instanceof Anthropic.RateLimitError) throw new Error('Rate limited by the provider (429). Try again shortly.');
    if (e instanceof Anthropic.APIConnectionError) throw new Error('Could not reach api.anthropic.com. Check the network connection.');
    if (e instanceof Anthropic.APIError) throw new Error(`Provider error ${e.status ?? ''}: ${e.message}`);
    throw e;
  }
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('The AI reply did not contain a result list.');
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error('The AI reply could not be read. Try again.');
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
    .map((x) => ({
      kind: (KINDS.includes(x.kind as ResearchKind) ? x.kind : 'web') as ResearchKind,
      title: String(x.title ?? '').slice(0, 200),
      url: String(x.url ?? ''),
      source: String(x.source ?? '').slice(0, 80) || hostOf(String(x.url ?? '')),
      snippet: x.snippet ? String(x.snippet).slice(0, 400) : undefined,
    }))
    .filter((x) => /^https?:\/\//.test(x.url) && x.title);
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'web';
  }
};
