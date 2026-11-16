import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { articleRecords, capacityPlan, collectRecords, markdownFilesUnder, prepareRecords, recommendations } from './vector-content.js';

describe('语义分片', () => {
  it('把文章头部统计保留在向量元数据中', () => {
    const [record] = articleRecords('---\ntitle: 统计\ncontent_stats:\n  schema: 1\n  word_count: 2\n  character_count: 3\n---\n你好。', 'blog', 'blog/a.md');
    expect(record.metadata.contentStats).toMatchObject({ schema: 1, word_count: 2, character_count: 3 });
  });
  it('保留短词条、标题路径和分类，代码中的标题不分节', () => {
    const records = articleRecords('---\ntitle: 宇宙\n---\n## 规则\n简短定义。\n### 例子\n```js\n# not heading\n```', 'docs', 'nested/a.md');
    expect(records.some(r => r.data.includes('简短定义'))).toBe(true);
    expect(records.some(r => r.metadata.section === '规则 / 例子')).toBe(true);
    expect(records.every(r => r.metadata.category === 'docs')).toBe(true);
    expect(records.every(r => r.metadata.site === 'docs')).toBe(true);
    expect(records[0].metadata.categoryName).toBe('开发文档');
    expect(records.some(r => r.metadata.section.includes('not heading'))).toBe(false);
  });
  it('缺少标题仍可同步；长段落不会丢失；跨站 ID 不冲突', () => {
    const raw = '## 长文\n' + '甲乙丙丁。'.repeat(800);
    const a = articleRecords(raw, 'blog', 'a.md');
    const b = articleRecords(raw, 'notes', 'a.md');
    expect(a[0].metadata.title).toBe('a');
    expect(a.every(r => r.data.length <= 1800)).toBe(true);
    expect(a.map(r => r.metadata.text).join('')).toBe('甲乙丙丁。'.repeat(800));
    expect(a[0].id).not.toBe(b[0].id);
  });
  it('跳过草稿，拒绝危险 URL 并回退到 launcher', () => {
    expect(articleRecords('---\ndraft: true\n---\nsecret', 'blog', 'draft.md')).toEqual([]);
    const [r] = articleRecords('---\nurl: javascript:alert(1)\n---\n正文', 'blog', 'a.md');
    expect(r.metadata.url).toBe('https://knowledge.example.com/');
    expect(r.metadata.urlKind).toBe('kb-home');
  });
  it('把 frontmatter url 原样写入每个向量片段的元数据', () => {
    const [r] = articleRecords('---\ntitle: 可跳转\nurl: https://docs.example.com/archives/ke-tiao-zhuan\ncategories: [设定集]\n---\n正文', 'docs', 'a.md');
    expect(r.metadata.url).toBe('https://docs.example.com/archives/ke-tiao-zhuan');
    expect(r.metadata.urlKind).toBe('article');
    expect(r.metadata.categories).toEqual(['设定集']);
  });
  it('允许 frontmatter category 按内容性质覆盖默认文件夹分类', () => {
    const [r] = articleRecords('---\ntitle: 方法论\ncategory: blog\n---\n正文', 'docs', 'a.md');
    expect(r.metadata.category).toBe('blog');
    expect(r.metadata.categoryName).toBe('技术博客');
  });


  it('以当前全库占用和新增记录判断本地保护阈值', () => {
    expect(() => capacityPlan({ vectorCount: 98000, indexSize: 0, dimension: 1024 }, [{ data: 'x', metadata: {} }], 1)).toThrow(/容量/);
    expect(capacityPlan({ vectorCount: 598, indexSize: 4000000, dimension: 1024 }, [], 0).recordLimit).toBe(98000);
  });
  it('跨操作系统产生稳定日期和 ID，关联能指向文章内相邻片段', () => {
    const raw = '---\ntitle: 世界\nupdated: 2026-08-25\n---\n## 规则\n第一条。\n## 例子\n第二条。';
    const a = articleRecords(raw, 'docs', 'a.md');
    const b = articleRecords(raw.replaceAll('\n', '\r\n'), 'docs', 'a.md');
    expect(a.map(r => r.id)).toEqual(b.map(r => r.id));
    expect(a[0].metadata.updatedAt).toBe('2026-08-25T00:00:00.000Z');
    expect(a[0].metadata.nextId).toBe(a[1].id);
    expect(a[1].metadata.previousId).toBe(a[0].id);
    expect(a[0].metadata.summaryMethod).toBe('source-excerpt');
  });
  it('嵌入模型身份写入 metadata，切换模型会生成新版本 ID', () => {
    const source = articleRecords('---\ntitle: 可切换\n---\n正文', 'docs', 'a.md');
    const first = prepareRecords(source, 'dense', 'provider/model-a');
    const second = prepareRecords(source, 'dense', 'provider/model-b');
    expect(first[0].metadata.embeddingIdentity).toBe('provider/model-a');
    expect(first[0].id).not.toBe(second[0].id);
  });
  it('推荐问题不会因条目同时有入口和解读段落而重复', () => {
    const base = { metadata: { category: 'notes', title: '配置约定' } };
    const prompts = recommendations([{ ...base, metadata: { ...base.metadata, articleId: 'entry' } }, { ...base, metadata: { ...base.metadata, articleId: 'overview' } }]);
    expect(prompts).toHaveLength(3);
    expect(new Set(prompts.map(p => p.mode)).size).toBe(3);
  });
  it('推荐保留物理网站和规范分类，不把技术博客套成虚构设定', () => {
    const prompts = recommendations([
      { metadata: { site: 'docs', category: 'notes', title: '状态管理' } },
      { metadata: { site: 'blog', category: 'blog', title: 'Hexo 配置' } },
    ]);
    expect(prompts.filter(p => p.site === 'docs')).toHaveLength(3);
    expect(prompts.find(p => p.site === 'docs')).toMatchObject({ category: 'notes', title: '状态管理' });
    expect(prompts.find(p => p.site === 'blog' && p.mode === 'chat').question).toBe('《Hexo 配置》主要讲什么？');
    expect(prompts.every(p => !p.question.includes('核心设定'))).toBe(true);
  });
  it('各网站优先推荐本站主题的文章，跨分类入口仍保留正确归属', () => {
    const prompts = recommendations([
      { metadata: { site: 'docs', category: 'notes', title: '状态管理' } },
      { metadata: { site: 'docs', category: 'docs', title: '事件队列' } },
    ]);
    expect(prompts[0]).toMatchObject({ site: 'docs', title: '事件队列', mode: 'chat' });
    expect(prompts.some(p => p.title === '状态管理' && p.site === 'docs' && p.category === 'notes')).toBe(true);
  });
  it('递归读取三类目录内任意层级的 Markdown，嵌套文件夹不改变分类', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-content-'));
    try {
      const fixtures = [
        ['blog/_posts/Hexo/入门.md', '博客文章'],
        ['docs/core/create/设定.mdx', '世界设定'],
        ['notes/哲学/内核/条目.md', '核心条目'],
      ];
      for (const [relative, title] of fixtures) {
        const target = path.join(root, ...relative.split('/'));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, `---\ntitle: ${title}\n---\n正文`, 'utf8');
      }
      fs.writeFileSync(path.join(root, 'blog', '_posts', '说明.txt'), '忽略', 'utf8');

      expect(markdownFilesUnder(path.join(root, 'blog')).map(file => path.basename(file))).toEqual(['入门.md']);
      const { records, articles } = collectRecords(root);
      expect(articles).toBe(3);
      expect(records.map(record => [record.metadata.source, record.metadata.category])).toEqual([
        ['blog/_posts/Hexo/入门.md', 'blog'],
        ['docs/core/create/设定.mdx', 'docs'],
        ['notes/哲学/内核/条目.md', 'notes'],
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});


it('部署者可以调整同步保护阈值，非法配置会在写入前失败', () => {
  try {
    vi.stubEnv('VECTOR_MAX_RECORDS', '2');
    expect(capacityPlan({vectorCount: 1,indexSize: 0,dimension: 1024}, [], 0).recordLimit).toBe(2);
    expect(() => capacityPlan({vectorCount: 2,indexSize: 0,dimension: 1024}, [], 1)).toThrow(/容量/);
    vi.stubEnv('VECTOR_MAX_RECORDS', '-1');
    expect(() => capacityPlan({vectorCount: 0,indexSize: 0,dimension: 1024}, [], 0)).toThrow(/Invalid capacity limit/);
  } finally { vi.unstubAllEnvs(); }
});
