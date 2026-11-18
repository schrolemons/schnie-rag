import { expect, it } from 'vitest';
import { validateModelAnswer } from '../services/vercel/structured-answer.mjs';
const sources = [{ id: 'doc-1', title: '安装说明', url: 'https://docs.example.com/setup', text: '先安装依赖。' }];
it('模型只声明采用与顺序；卡片标题、网址和摘录来自本轮证据', () => {
  expect(validateModelAnswer(JSON.stringify({ answer: '先安装依赖。[1]', info_card: [{ id: 'doc-1', used: true, order: 1 }] }), sources))
    .toEqual({ answer: '先安装依赖。[1]', info_card: [{ id: 'doc-1', title: '安装说明', url: 'https://docs.example.com/setup', excerpt: '先安装依赖。', used: true, order: 1 }] });
});
it.each([
  'not json',
  { answer: '假资料。[1]', info_card: [{ id: 'fabricated', used: true, order: 1 }] },
  { answer: '没有引用', info_card: [{ id: 'doc-1', used: true, order: 1 }] },
  { answer: '错误编号。[2]', info_card: [{ id: 'doc-1', used: true, order: 1 }] },
  { answer: '篡改地址。[1]', info_card: [{ id: 'doc-1', used: true, order: 1, url: 'https://attacker.example/' }] },
])('拒绝格式错误、伪造来源、引用声明不一致和模型越权填写网址', value => {
  expect(() => validateModelAnswer(typeof value === 'string' ? value : JSON.stringify(value), sources)).toThrow();
});
