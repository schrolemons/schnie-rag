// Edit these public source definitions before importing your own documents.
export const SOURCE_SITES = [
  { id: 'blog', name: '技术博客', repository: 'example-owner/blog', branch: 'main', url: 'https://blog.example.com/' },
  { id: 'docs', name: '开发文档', repository: 'example-owner/docs', branch: 'main', url: 'https://docs.example.com/' },
  { id: 'notes', name: '学习笔记', repository: 'example-owner/notes', branch: 'main', url: 'https://notes.example.com/' },
];
const seen = new Set();
for (const site of SOURCE_SITES) {
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(site.id) || site.id === 'all' || seen.has(site.id)) throw new Error('来源ID需唯一，并使用小写字母、数字和连字符；all为保留值。');
  seen.add(site.id);
}
if (!SOURCE_SITES.length) throw new Error('至少配置一个知识来源。');
export const SOURCE_IDS = SOURCE_SITES.map(site => site.id);
export const SOURCE_NAMES = Object.fromEntries(SOURCE_SITES.map(site => [site.id, site.name]));
export const LAUNCHER_REPOSITORY = 'example-owner/knowledge-rag';
