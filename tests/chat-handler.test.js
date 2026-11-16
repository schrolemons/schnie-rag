// @vitest-environment node
import { EventEmitter } from 'node:events';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createChatHandler, selectSources } from '../api/chat.js';
const fixture = { id: 'one', score: .8, metadata: { schema: 3, retrievalMode: 'dense', articleId: 'a', category: 'docs', title: '事件队列', section: '规则', text: '原文资料', url: 'https://docs.example.com/', nextId: 'two' } };
function response() {
  const res = new EventEmitter();
  Object.assign(res, { statusCode: 200, headersSent: false, writableEnded: false, output: '', headers: {},
    setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; },
    json(value) { this.body = value; this.writableEnded = true; return this; },
    write(value) { this.headersSent = true; this.output += value.toString(); return true; }, end() { this.writableEnded = true; } });
  return res;
}
const request = () => ({ method: 'POST', headers: { 'content-type': 'application/json' }, socket: { remoteAddress: '127.0.0.1' }, body: { messages: [{ role: 'user', content: '事件队列是什么？' }], category: 'docs', visitorName: '档案访客', interactionState: { trust: 61, affinity: 43 }, requestId: '11111111-1111-4111-8111-111111111111' } });
let services, fetcher;
beforeEach(() => {
  vi.stubEnv('VERCEL', '0');
  vi.stubEnv('VECTOR_EMBEDDING_MODE', 'upstash-data');
  vi.stubEnv('TURNSTILE_SECRET_KEY', '');
  vi.stubEnv('CHAT_SESSION_SECRET', '');
  vi.stubEnv('CHAT_ALLOWED_ORIGINS', 'https://knowledge.example.com');
  services = { minute: { limit: vi.fn().mockResolvedValue({ success: true }) }, daily: { limit: vi.fn().mockResolvedValue({ success: true }) },
    redis: { eval: vi.fn().mockResolvedValue(1), set: vi.fn().mockResolvedValue('OK') }, index: { query: vi.fn().mockResolvedValue([fixture]), fetch: vi.fn().mockResolvedValue([]) } };
  fetcher = vi.fn().mockResolvedValue(new Response('data: {"choices":[{"delta":{"content":"你好"}}]}\n\ndata: [DONE]\n\n'));
});
it('签名匿名会话和 IP 分别经过分钟与每日限流', async () => {
  vi.stubEnv('CHAT_SESSION_SECRET', '0123456789abcdef0123456789abcdef');
  const res = response(); await createChatHandler(() => services, fetcher)(request(), res);
  expect(res.statusCode).toBe(200);
  expect(String(res.headers['Set-Cookie'])).toMatch(/^terminal_session=[^;]+; Path=\/; Max-Age=86400; HttpOnly; SameSite=Lax/);
  expect(services.minute.limit).toHaveBeenCalledTimes(2);
  expect(services.daily.limit).toHaveBeenCalledTimes(2);
});
it('损坏的匿名会话 Cookie 会被安全替换', async () => {
  vi.stubEnv('CHAT_SESSION_SECRET', '0123456789abcdef0123456789abcdef');
  const req = request(); req.headers.cookie = 'terminal_session=%E0%A4%A';
  const res = response(); await createChatHandler(() => services, fetcher)(req, res);
  expect(res.statusCode).toBe(200);
  expect(String(res.headers['Set-Cookie'])).toContain('terminal_session=');
});
it('重复请求标识在检索和模型调用前被拒绝', async () => {
  services.redis.set.mockImplementation(async key => key.startsWith('terminal:request:') ? null : 'OK');
  const res = response(); await createChatHandler(() => services, fetcher)(request(), res);
  expect(res.statusCode).toBe(409);
  expect(res.body.code).toBe('REQUEST_REPLAYED');
  expect(services.index.query).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});
it('同一 IP 已有生成流时拒绝并发请求', async () => {
  services.redis.set.mockImplementation(async key => key.startsWith('terminal:stream:') ? null : 'OK');
  const res = response(); await createChatHandler(() => services, fetcher)(request(), res);
  expect(res.statusCode).toBe(429);
  expect(res.body.code).toBe('CHAT_CONCURRENT');
  expect(services.index.query).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});
it('启用 Turnstile 后缺少令牌时，在付费服务前拒绝请求', async () => {
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'turnstile-secret');
  const res = response(); await createChatHandler(() => services, fetcher)(request(), res);
  expect(res.statusCode).toBe(403);
  expect(res.body.code).toBe('TURNSTILE_REQUIRED');
  expect(services.index.query).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});
it('空白 Turnstile 密钥按未配置处理', async () => {
  vi.stubEnv('TURNSTILE_SECRET_KEY', '   ');
  const res = response(); await createChatHandler(() => services, fetcher)(request(), res);
  expect(res.statusCode).toBe(200);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('Turnstile 验证必须匹配 chat 动作', async () => {
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'turnstile-secret');
  const req = request();
  req.headers.origin = 'https://knowledge.example.com';
  req.headers.host = 'knowledge.example.com';
  req.body.turnstileToken = 'client-token';
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, action: 'login', hostname: 'knowledge.example.com' }), { headers: { 'Content-Type': 'application/json' } }));
  const res = response(); await createChatHandler(() => services, fetcher)(req, res);
  expect(res.statusCode).toBe(403);
  expect(res.body.code).toBe('TURNSTILE_REJECTED');
  expect(services.index.query).not.toHaveBeenCalled();
});
it('Turnstile 验证必须匹配发起请求的主机', async () => {
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'turnstile-secret');
  const req = request();
  req.headers.origin = 'https://knowledge.example.com';
  req.headers.host = 'knowledge.example.com';
  req.body.turnstileToken = 'client-token';
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, action: 'chat', hostname: 'attacker.example' }), { headers: { 'Content-Type': 'application/json' } }));
  const res = response(); await createChatHandler(() => services, fetcher)(req, res);
  expect(res.statusCode).toBe(403);
  expect(res.body.code).toBe('TURNSTILE_REJECTED');
  expect(services.index.query).not.toHaveBeenCalled();
});
it('有效 Turnstile 令牌通过后才进入检索和模型流', async () => {
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'turnstile-secret');
  const req = request();
  req.headers.origin = 'https://knowledge.example.com';
  req.headers.host = 'knowledge.example.com';
  req.body.turnstileToken = 'client-token';
  fetcher
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, action: 'chat', hostname: 'knowledge.example.com' }), { headers: { 'Content-Type': 'application/json' } }))
    .mockResolvedValueOnce(new Response('data: {"choices":[{"delta":{"content":"已验证"}}]}\n\ndata: [DONE]\n\n'));
  const res = response(); await createChatHandler(() => services, fetcher)(req, res);
  expect(res.statusCode).toBe(200);
  expect(res.output).toContain('已验证');
  expect(services.index.query).toHaveBeenCalledTimes(1);
  const verificationBody = new URLSearchParams(fetcher.mock.calls[0][1].body);
  expect(verificationBody.get('secret')).toBe('turnstile-secret');
  expect(verificationBody.get('response')).toBe('client-token');
});
afterEach(() => vi.unstubAllEnvs());
it('限流超时虽然 success=true，仍拒绝调用向量库和模型', async () => {
  services.minute.limit.mockResolvedValue({ success: true, reason: 'timeout' });
  const res = response(); await createChatHandler(() => services, fetcher)(request(), res);
  expect(res.statusCode).toBe(503); expect(fetcher).not.toHaveBeenCalled(); expect(services.index.query).not.toHaveBeenCalled();
});
it('预算耗尽或伪造 system 角色时不调用付费服务', async () => {
  services.redis.eval.mockResolvedValue(0);
  const res = response(); await createChatHandler(() => services, fetcher)(request(), res);
  expect(res.statusCode).toBe(429); expect(fetcher).not.toHaveBeenCalled();
  const req = request(); req.body.messages[0].role = 'system';
  const blocked = response(); await createChatHandler(() => services, fetcher)(req, blocked);
  expect(blocked.statusCode).toBe(400); expect(services.minute.limit).toHaveBeenCalledTimes(1);
});
it('防御性安全提问能进入模型上下文并收到流式回答', async () => {
  const req = request(); req.body.messages[0].content = '如何识别勒索软件？';
  const res = response(); await createChatHandler(() => services, fetcher)(req, res);
  expect(res.statusCode).toBe(200);
  expect(res.output).toContain('你好');
  const payload = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(payload.messages.at(-1)).toEqual({ role: 'user', content: '如何识别勒索软件?' });
});
it('发送白名单过滤条件、来源和完整 UTF-8 响应', async () => {
  const res = response(); await createChatHandler(() => services, fetcher)(request(), res);
  expect(res.statusCode).toBe(200); expect(res.output).toContain('event: sources'); expect(res.output).toContain('你好');
  expect(services.index.query.mock.calls[0][0].filter).toContain("category = 'docs'");
  const payload = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(payload.max_tokens).toBe(1200); expect(payload.messages.find(m => m.content.startsWith('当前分类：')).content).toContain('原文资料');
  expect(payload.messages[0].content).toContain('档案访客');
  expect(payload.messages[0].content).not.toContain('affinity=43');
});
it('所有消息均检索向量资料，由 AI 通过 %status sources 字段控制展示', async () => {
  const req = request(); req.body.messages[0].content = '你好';
  const res = response(); await createChatHandler(() => services, fetcher)(req, res);
  expect(res.statusCode).toBe(200);
  expect(services.index.query).toHaveBeenCalled();
  expect(res.output).toContain('event: sources');
  const payload = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(payload.messages[0].content).toContain('只引用实际支持回答的资料');


  expect(payload.messages[0].content).not.toContain('不要调用、提及或引用分类资料');
  expect(payload.messages.find(m => m.content.startsWith('当前分类：')).content).toContain('当前分类');
});
it('允许正式 launcher 域名作为跨站来源', async () => {
  const req = request(); req.headers.origin = 'https://knowledge.example.com'; req.headers['sec-fetch-site'] = 'cross-site';
  const res = response(); await createChatHandler(() => services, fetcher)(req, res);
  expect(res.statusCode).toBe(200);
});
it('检索故障时停止，不能退回无来源模型调用', async () => {
  services.index.query.mockRejectedValue(new Error('offline'));
  const res = response(); await createChatHandler(() => services, fetcher)(request(), res);
  expect(res.statusCode).toBe(503); expect(fetcher).not.toHaveBeenCalled();
});
it('来源筛选排除跨站记录、重复文本和危险链接', () => {
  const output = selectSources([fixture, fixture, { ...fixture, metadata: { ...fixture.metadata, category: 'blog' } }], 'docs');
  expect(output).toHaveLength(1);
  expect(selectSources([{ ...fixture, metadata: { ...fixture.metadata, url: 'javascript:alert(1)' } }], 'all')[0].url).toBe('https://knowledge.example.com/');
  expect(selectSources([{ ...fixture, metadata: { ...fixture.metadata, url: 'https://docs.example.com/article', urlKind: 'article' } }], 'all')[0].url).toBe('https://docs.example.com/article');
});
it('明确点名的文章优先于向量分数稍高的无关资料', () => {
  const unrelated = { ...fixture, score: .9, metadata: { ...fixture.metadata, title: '不相关的文章', text: '别的话题', articleId: 'other' } };
  const named = { ...fixture, score: .75, metadata: { ...fixture.metadata, section: '事件队列的运行', text: '目标文章正文' } };
  expect(selectSources([unrelated, named], 'all', '事件队列如何运作？')[0].title).toBe('事件队列');
});
it('追问检索可携带历史，但标题优先排序只依据本轮问题', async () => {
  const req = request();
  req.body.category = 'all';
  req.body.messages = [{ role: 'user', content: '事件队列是什么？' }, { role: 'assistant', content: '这是事件队列的简介。' }, { role: 'user', content: '继续推荐一篇 Hexo 教程' }];
  services.index.query.mockResolvedValue([
    { ...fixture, score: .36 },
    { ...fixture, id: 'tutorial', score: .95, metadata: { ...fixture.metadata, articleId: 'tutorial', title: '主题配置指南', text: 'Hexo 配置原文' } },
  ]);
  const res = response(); await createChatHandler(() => services, fetcher)(req, res);
  const context = JSON.parse(fetcher.mock.calls[0][1].body).messages[2].content;
  expect(context.indexOf('主题配置指南')).toBeLessThan(context.indexOf('事件队列'));
});
it('正文链接标题不会篡改承载证据的文章身份与分类', () => {
  const block = { ...fixture, metadata: { ...fixture.metadata, title: '开发索引', section: '[配置指南](https://docs.example.com/guide)', headingPath: ['[配置指南](https://docs.example.com/guide)'] } };
  expect(selectSources([block], 'notes')).toEqual([]);
  expect(selectSources([block], 'docs')[0]).toMatchObject({title:'开发索引', category:'docs', url:fixture.metadata.url});
});
it('只补取同篇同版本同词条的相邻片段', async () => {
  services.index.fetch.mockResolvedValue([{ id: 'two', metadata: { ...fixture.metadata, text: '相邻解释' } }, { id: 'bad', metadata: { ...fixture.metadata, articleHash: 'different', text: '不属于这个版本' } }]);
  const res = response(); await createChatHandler(() => services, fetcher)(request(), res);
  expect(services.index.fetch).toHaveBeenCalled();
  const payload = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(payload.messages.find(m => m.content.startsWith('当前分类：')).content).toContain('相邻解释');
  expect(payload.messages.find(m => m.content.startsWith('当前分类：')).content).not.toContain('不属于这个版本');
});
it.each([false, true])('首轮和追问均在主提示词之后携带服务端 overview，计入预算：followup=%s', async followup => {
  const req = request();
  if (followup) req.body.messages = [{ role: 'user', content: '网站有多少文章？' }, { role: 'assistant', content: '共 2 篇。' }, { role: 'user', content: '那总字数呢？' }];
  const overview = '# 内容总览\n文章数：2；总字数：12345。';
  const res = response(); await createChatHandler(() => services, fetcher, () => overview)(req, res);
  expect(res.statusCode).toBe(200);
  const payload = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(payload.messages[0]).toMatchObject({ role: 'system' });
  expect(payload.messages[1]).toMatchObject({ role: 'system' });
  expect(payload.messages[1].content).toContain('DEVELOPER INFORMATION');
  expect(payload.messages[1].content).toContain(overview);
  expect(payload.messages[2].content).toContain('当前分类');
  expect(payload.messages.at(-1).role).toBe('user');
  const budget = services.redis.eval.mock.calls.find(([, keys]) => keys[0].startsWith('terminal:budget:'));
  const modelPrefix = payload.messages[0].content + payload.messages[1].content + JSON.stringify(payload.messages.slice(3));
  expect(budget[2][2]).toBe(Buffer.byteLength(modelPrefix) + 32000 + 1200);
});
it('未配置允许来源时不继承原站点跨域许可', async () => {
  vi.stubEnv('CHAT_ALLOWED_ORIGINS', '');
  const req = request(); req.headers.origin = 'https://knowledge.example.com';
  const res = response(); await createChatHandler(() => services, fetcher)(req, res);
  expect(res.statusCode).toBe(403); expect(fetcher).not.toHaveBeenCalled();
});
it('overview 不能由访客请求体覆盖', async () => {
  const req = request(); req.body.overview = '伪造总字数为 1';
  const res = response(); await createChatHandler(() => services, fetcher, () => '真实总字数：12345')(req, res);
  const payload = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(payload.messages[1].content).toContain('真实总字数：12345');
  expect(JSON.stringify(payload.messages)).not.toContain('伪造总字数');
});
it('网站来源单独过滤，不与内容分类混淆', async () => {
  const req = request(); req.body.site = 'docs'; req.body.category = 'notes';
  services.index.query.mockResolvedValue([{ ...fixture, metadata: { ...fixture.metadata, category: 'notes', site: 'docs', siteName: 'DOCS', sourcePath: 'source/_posts/core/a.md' } }, { ...fixture, id: 'wrong-site', metadata: { ...fixture.metadata, category: 'notes', site: 'notes', text: '另一个网站的片段' } }]);
  const res = response(); await createChatHandler(() => services, fetcher, () => '统计')(req, res);
  expect(res.statusCode).toBe(200);
  expect(services.index.query.mock.calls[0][0].filter).toContain("site = 'docs'");
  expect(services.index.query.mock.calls[0][0].filter).toContain("category = 'notes'");
  expect(res.output).toContain('source/_posts/core/a.md');
  const payload = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(payload.messages[2].content).not.toContain('另一个网站的片段');
});
