import { buildAnswerMessages } from './structured-answer.mjs';
export function createLlmClient({ endpoint, apiKey, model, fetcher = fetch } = {}) {
  if (!endpoint || !apiKey || !model) throw new Error('LLM_NOT_CONFIGURED');
  const url = new URL(endpoint);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname))) || url.username || url.password || url.search || url.hash) throw new Error('LLM_ENDPOINT_INVALID');
  return async ({ message, sources, overview, signal }) => {
    const response = await fetcher(url, { method: 'POST', headers: { 'Content-Type':'application/json', Authorization:`Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: buildAnswerMessages(message,sources,overview), stream: false, temperature: 0.2, max_tokens: 4096, response_format: { type: 'json_object' } }), signal, redirect: 'error' });
    if (!response.ok) { await response.body?.cancel(); throw new Error('LLM_UNAVAILABLE'); }
    if (!response.body) throw new Error('LLM_FORMAT_INVALID');
    const reader = response.body.getReader(), chunks = []; let bytes = 0;
    try {
      while (true) {
        const item = await reader.read(); if (item.done) break;
        bytes += item.value.byteLength;
        if (bytes > 512*1024) throw new Error('LLM_RESPONSE_TOO_LARGE');
        chunks.push(item.value);
      }
    } finally { await reader.cancel().catch(()=>{}); reader.releaseLock(); }
    const raw = Buffer.concat(chunks).toString('utf8');
    let value; try { value = JSON.parse(raw); } catch { throw new Error('LLM_FORMAT_INVALID'); }
    const text = value?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('LLM_FORMAT_INVALID');
    return text;
  };
}
