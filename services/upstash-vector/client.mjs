import { Index } from '@upstash/vector';
import { retrieveSources } from '../../server/retrieval.js';
export function createVectorRetriever(env = process.env) {
  const { UPSTASH_VECTOR_REST_URL: url, UPSTASH_VECTOR_REST_TOKEN: token, UPSTASH_VECTOR_NAMESPACE: namespace } = env;
  if (!url || !token || !namespace) throw new Error('UPSTASH_VECTOR_NOT_CONFIGURED');
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash) throw new Error('UPSTASH_VECTOR_ENDPOINT_INVALID');
  return async ({ message, signal }) => {
    const index = new Index({ url, token, retry: false, signal: () => signal });
    return (await retrieveSources({ index, namespace, query: message, question: message, category:'all', site:'all', mode:'chat', signal }))
      .map((source, i) => ({ ...source, id: `source-${i + 1}` }));
  };
}
