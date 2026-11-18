# Markdown向量问答：个人实现参考

[维护与检查](docs/MAINTENANCE.md) · [协议说明](docs/protocol.md)

这是从个人网站中整理出的RAG后端示范，保留文档元数据、向量检索、受控模型调用与增量更新的实现思路。它不是开箱即用的产品：使用者需要配置自己的资料、Upstash Vector账号和LLM接口，并根据部署环境替换模拟基础设施。

项目不包含聊天页面，输入与输出独立于DSH及任何前端。命令行、HTTP调用方和可视化插件使用同一条处理链；其他前端只需消费公开的SSE协议。

## 整体链路

```text
Markdown → 提取标题、路径、标签、关键词、字数与文章哈希
         → 元数据总览 + 文档分块 → 真实Upstash Vector

命令行或HTTP参数（message/request_id）
  → Vercel处理入口
  → Cloudflare Turnstile模拟验证
  → Redis模拟协调：限流、去重、并发锁、保守预算预留
  → Upstash Vector检索及相邻片段补取
  → Vercel组织证据、拼接公开通用提示词、调用部署者配置的LLM
  → 校验answer/info_card与本轮来源白名单
  → 纯文本增量 + JSON来源（SSE），或命令行汇总JSON
```

三类基础机制均有独立目录。`services/cloudflare-turnstile`仅比对配置的演示令牌，不做人机识别；`services/redis`仅使用当前进程内存，不连接Redis，不提供跨实例原子性与持久化；`services/vercel`包含实际业务代码，本地由明确标记的Vercel模拟执行器运行。配置中的Key用于表达服务边界，不意味着已调用真实Cloudflare或Redis。服务端CLI调用可使用模拟验证器自己的演示令牌，此行为不能用于公开站点防机器人。

只有Vector与LLM在正常问答路径中进行真实外部调用。缺少配置会报错，不回退到作者服务；离线示例显式注入替身。Upstash Vector存放向量和文章元数据，Redis模拟层只管理短期协调状态，两者职责不同。

## 本地检查与离线示例

需要Node.js22.19+：

```sh
npm ci
npm test
npm run check
npm run sync:vector:check
npm run demo:offline
npm run privacy:check
```

`demo:offline`经过真实HTTP和业务函数，但Vector与LLM都是明确标注的测试替身，不连接云服务，不代表模型效果已经验证。项目没有UI，访问根路径返回404；`/health`只说明模拟执行器存活，不证明外部服务可用。

需要持续运行供插件验收时，执行`npm run demo:serve`：回环接口为`http://127.0.0.1:8789/api/chat`，演示Bearer令牌为`offline-fixture-key`。此模式仍使用显式替身。两个仓库同时检出后，可运行`node scripts/verify-dsh-plugin.mjs /path/to/schnie-harness-plugin`核对协议副本与真实HTTP对接；它不读取任何DSH用户配置。

## 配置真实Vector与LLM

1. 复制`.env.example`为`.env`。设置Vercel入口访问令牌、模拟层配置，以及自己的LLM接口、Key和模型标识。
2. 在自己的Upstash账号创建Dense向量索引，把REST URL和Token填入配置。选用支持托管文本嵌入的索引时使用`VECTOR_EMBEDDING_MODE=upstash-data`；自带Embeddings接口时选`external`，入库与查询必须使用相同模型、维度及模式。使用独立的`kb-`前缀namespace，避免影响其他应用资料。
3. 调整`lib/source-sites.js`的来源定义；将已授权公开的Markdown放在`src/content/<来源ID>/`，frontmatter填写真实标题与HTTPS原文url。需要从仓库采集时按[内容链路](docs/content-pipeline.md)设置。
4. 运行`npm run content:overview`与`npm run sync:vector:check`。确认范围后运行`npm run sync:vector`正式入库；此步骤产生真实外部写入和费用。
5. 使用命令行或接口查询已知文章，检查答案、卡片原文和日志。仓库不附送真实账号、私有资料或生产凭据。

## 输入与输出

命令行直接传问题，无DSH或前端依赖：

```sh
npm run ask -- "文档如何组织？"
npm run ask -- "文档如何组织？" --json
```

默认向标准输出写SSE；`--json`在完整校验后输出`{"answer":"...","info_card":[...]}`。CLI会启动临时回环Vercel模拟执行器并调用同一个处理函数，结束后关闭。

需要供其他程序调用时：

```sh
npm start
```

`POST http://127.0.0.1:8787/api/chat`，Content-Type为application/json，Authorization为`Bearer <VERCEL_DEMO_API_KEY>`，请求体：

```json
{"message":"如何安装？","request_id":"client-request-1"}
```

返回[info-card-sse/1](docs/protocol.md)：meta、可选status、text_delta、info_card、done。来源卡片包含id、title、url、excerpt、used、order。只展示used=true的卡片，按order排序；没有引用也返回空数组。模型仅返回正文和来源ID/采用声明，标题、网址和摘要从检索证据中补齐，避免由模型杜撰链接。

本实现先等待LLM返回完整结构化JSON，通过合法性与来源校验后再分块发送。因此SSE是已验证结果的分块交付，不宣称上游模型逐token实时输出。插件可以消费真正逐token输出的其他服务，二者只共享协议。

## Vercel与内容更新

`api/chat.js`是Vercel入口，复用`services/vercel`业务代码。部署时选择无前端框架，Output Directory留空并设置自己的服务端环境变量。当前Cloudflare与Redis仍为模拟层，在多实例Vercel中状态不会共享，公开生产部署前需替换为真实基础设施；不能因代码放上云便宣称拥有全局限流或预算保障。

内容更新为：源仓库push → Vercel签名Webhook验签与来源白名单 → Redis模拟去重 → 向使用者指定仓库发送repository_dispatch → 使用者的采集任务读取源文档 → 重算统计与分块 → 新增/变化内容入库、确认可查询后清理当前分区旧版本。也可完全手动运行。详情见[内容链路](docs/content-pipeline.md)。仓库不启用任何自动Actions，docs中的工作流仅作参考。

若使用DSH插件，它只是此后端的一种可替换客户端；后端没有DSH依赖。其他SSE客户端或命令行同样可用。见[验证边界](VALIDATION.md)和[安全说明](SECURITY.md)。
