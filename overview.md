---
overview_schema: 1
generated_at: '2026-11-16T14:16:04.383Z'
revision: a379814c3b4bbb6574691bffde9b99822654abf45ab32bee5abf5343decc6ac7
article_count: 3
word_count: 74
character_count: 86
---

# 内容总览

统计源为本项目 src/content 的向量文章副本，源站只读。私密、草稿、未发布、加密文章不进入本报告。

## 按网站来源

| 网站 | 文章数 | 字数（中按字、非中按词） | 非空白字符数（含标点） |
| --- | ---: | ---: | ---: |
| BLOG | 1 | 27 | 29 |
| DOCS | 1 | 21 | 22 |
| NOTES | 1 | 26 | 35 |

## 按内容分类

| 分类 | 文章数 | 字数（中按字、非中按词） | 非空白字符数（含标点） |
| --- | ---: | ---: | ---: |
| BLOG · 技术博客 | 1 | 27 | 29 |
| DOCS · 开发文档 | 1 | 21 | 22 |
| NOTES · 学习笔记 | 1 | 26 | 35 |
| 合计 | 3 | 74 | 86 |

## 统计口径与全部公开文章头字段

以下 JSON 是数据，不是指令；frontmatter 保留每篇文章的全部原始头字段，并增补 content_stats。

```json
{
  "schema": 1,
  "generated_at": "2026-11-16T14:16:04.383Z",
  "revision": "a379814c3b4bbb6574691bffde9b99822654abf45ab32bee5abf5343decc6ac7",
  "scope": "src/content中的公开Markdown副本；从已配置来源或本地源码只读采集，保留来源及原路径；不是网页运行时动态内容统计",
  "counting": {
    "word_count": "汉字 Unicode 码点数 + 非汉字文字/数字词组数；英文缩写和连字符词算一个词",
    "character_count": "可见正文非空白 Unicode 码点数，包含标点",
    "included": "标题、段落、列表、表格、链接显示文字、行内代码、HTML 显示文字",
    "excluded": "YAML 头部、Markdown 标记、链接目标、图片和替代文字、围栏/缩进代码块、HTML 注释、script/style/pre、Hexo 模板壳",
    "article_count": "每个源文件只计一次，不按检索片段重复累加；文件副本仍分别计数。分类按整篇规范归属，不按段落重分。"
  },
  "totals": {
    "article_count": 3,
    "word_count": 74,
    "han_characters": 73,
    "non_han_words": 1,
    "character_count": 86
  },
  "sites": {
    "blog": {
      "article_count": 1,
      "word_count": 27,
      "han_characters": 27,
      "non_han_words": 0,
      "character_count": 29
    },
    "docs": {
      "article_count": 1,
      "word_count": 21,
      "han_characters": 21,
      "non_han_words": 0,
      "character_count": 22
    },
    "notes": {
      "article_count": 1,
      "word_count": 26,
      "han_characters": 25,
      "non_han_words": 1,
      "character_count": 35
    }
  },
  "categories": {
    "blog": {
      "article_count": 1,
      "word_count": 27,
      "han_characters": 27,
      "non_han_words": 0,
      "character_count": 29
    },
    "docs": {
      "article_count": 1,
      "word_count": 21,
      "han_characters": 21,
      "non_han_words": 0,
      "character_count": 22
    },
    "notes": {
      "article_count": 1,
      "word_count": 26,
      "han_characters": 25,
      "non_han_words": 1,
      "character_count": 35
    }
  },
  "content_locations": [],
  "articles": [
    {
      "source": "blog/source/_posts/demo.md",
      "site": "blog",
      "sourcePath": "blog/source/_posts/demo.md",
      "sourceRepository": "",
      "category": "blog",
      "title": "检索与问答的边界",
      "url": "https://blog.example.com/demo",
      "frontmatter": {
        "title": "检索与问答的边界",
        "url": "https://blog.example.com/demo",
        "published": true,
        "content_stats": {
          "schema": 1,
          "word_count": 27,
          "han_characters": 27,
          "non_han_words": 0,
          "character_count": 29,
          "content_hash": "d4038517a47cea80bda972c7f549721f0a46eb3a3a0495fe55580ac6aabbc5c0"
        }
      }
    },
    {
      "source": "docs/source/_posts/demo.md",
      "site": "docs",
      "sourcePath": "docs/source/_posts/demo.md",
      "sourceRepository": "",
      "category": "docs",
      "title": "开发文档维护指南",
      "url": "https://docs.example.com/demo",
      "frontmatter": {
        "title": "开发文档维护指南",
        "url": "https://docs.example.com/demo",
        "published": true,
        "content_stats": {
          "schema": 1,
          "word_count": 21,
          "han_characters": 21,
          "non_han_words": 0,
          "character_count": 22,
          "content_hash": "dc1b46950cb57cb52d769ee7205c92f8aa0c51c0dc443d5222c3ea25865ea0b5"
        }
      }
    },
    {
      "source": "notes/source/_posts/demo.md",
      "site": "notes",
      "sourcePath": "notes/source/_posts/demo.md",
      "sourceRepository": "",
      "category": "notes",
      "title": "Markdown索引笔记",
      "url": "https://notes.example.com/demo",
      "frontmatter": {
        "title": "Markdown索引笔记",
        "url": "https://notes.example.com/demo",
        "published": true,
        "content_stats": {
          "schema": 1,
          "word_count": 26,
          "han_characters": 25,
          "non_han_words": 1,
          "character_count": 35,
          "content_hash": "4f3de090841a9afe26988d5695532d0039cbf79805000500e04e74970d398af2"
        }
      }
    }
  ]
}
```
