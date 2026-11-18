# Markdown向量问答：实际网站工作流的简化参考

[维护与检查](docs/MAINTENANCE.md) · [协议说明](docs/protocol.md)

本仓库整理自我实际部署运行的个人网站RAG项目。原项目包含React聊天前端、Cloudflare Turnstile验证、Vercel后端、真实Upstash Redis与Vector，以及由Webhook和GitHub Actions连接的内容更新流程。

**本仓库是这套实际工作流的一份脱敏、简化参考。**它保留文档处理、元数据总览、向量检索、模型调用与增量同步逻辑，将Cloudflare验证和Redis协调替换为显式模拟层，并将输入输出从原网站前端中独立出来。下面分别说明原网站实际做了什么，以及运行本仓库时实际会执行什么。

使用者需要配置自己的资料、Upstash Vector账号与接口凭据。独立问答配置自己的LLM；接入DSH当前会话模型时，后端只提供检索证据，无需LLM配置。本仓库不是原网站的完整生产工程，也不是无需配置的开箱即用产品。

## 原网站：实际部署的数据流

### 1. 文档处理与检索

从多个内容源采集Markdown，按标题与段落分块，提取来源、路径、标签、关键词、字数和内容哈希。一条输出是可供全局统计与范围判断使用的元数据总览，另一条输出是写入真实Upstash Vector的文档片段与元数据。检索支持分类与来源筛选，并补取相邻片段以保留上下文。

```text
内容源Markdown
  → 采集、清洗、提取元数据与分块
  ├─ 元数据总览 → 随问答上下文交给LLM，辅助统计与整体认识
  └─ 文档片段与元数据 → Upstash Vector → 检索、筛选与相邻片段补取
```

### 2. 问答与来源展示

```text
React聊天前端获取Cloudflare Turnstile令牌，提交问题与受限会话历史
  → Vercel问答入口：输入校验、Turnstile令牌核验与Redis访问控制
  → Upstash Vector检索原文片段、筛选来源并补取相邻片段
  → Vercel组合问题、会话历史、检索片段、元数据总览与服务端提示词
  → 调用LLM（原站默认DeepSeek），接收模型流
  → 向前端发送来源信息并转发模型流
  → React逐步展示正文，结合回答中的引用展示原文来源
```

Cloudflare Turnstile位于访问验证层：浏览器取得令牌，Vercel调用Cloudflare的Siteverify接口核验。真实Upstash Redis位于运行时协调层，承担限流、请求去重、并发锁与保守预算预留；Upstash Vector位于知识检索层，保存文档向量与元数据。Redis不承担文档语义检索，Cloudflare也不参与模型生成。

原网站的前端、验证、访问控制、模型调用与来源展示均属于实际项目工作。公开版对部分机制的简化，不表示原网站没有实现这些部分。

### 3. 内容增量更新

```text
源仓库推送文章
  → Vercel Webhook：HMAC验签、来源仓库与分支白名单
  → 真实Redis按已签名正文摘要去重
  → repository_dispatch触发原网站仓库的GitHub Actions
  → 采集源文档，重算元数据总览、内容哈希与分块
  → 向Upstash Vector上传新增或变化的记录
  → 等待新向量可查询，再清理当前分区的旧记录
  → 回写并推送生成的内容缓存、来源清单与总览
  → 衔接原网站的Vercel部署更新
```

Webhook只负责验证和派发任务，文章采集与批量同步由Actions执行。上传失败或新向量尚未就绪时保留旧记录，避免更新过程中先删掉可用资料。原网站已接入这套自动更新链路；本仓库的自动化状态另见下文。

## 本仓库：简化后的实际执行流程

### 1. 文档处理与检索

将使用者自己的公开Markdown放入`src/content/<来源ID>/`，或配置来源后执行`content:refresh`采集。`content:overview`生成元数据总览，`sync:vector:check`检查计划，`sync:vector`按哈希增量同步至使用者自己的真实Upstash Vector分区。仍保留新增或变化记录先上传、就绪后清理旧记录的顺序。

### 2. 独立问答与DSH接入

```text
命令行或HTTP参数（message/request_id）
  → Vercel处理函数：Bearer鉴权与输入检查
  → Cloudflare Turnstile模拟验证
  → Redis模拟协调：限流、去重、并发控制、保守预算预留
  → 真实Upstash Vector检索及相邻片段补取
  ├─ /api/chat：组合问题、片段、总览与公开格式说明，调用自配LLM
  │    → 校验完整answer/info_card及本轮来源白名单
  │    → 分块交付正文与JSON来源（SSE），或由CLI汇总为JSON
  └─ /api/retrieve：返回来源片段与总览（JSON），不调用LLM
       → 调用方自行使用；DSH插件可交给当前会话模型生成答案
       → 插件校验并在DSH中展示正文与引用卡片
```

本仓库不包含原网站的React聊天页面。命令行与HTTP可独立完成问答；DSH插件是另一种可替换客户端。DSH模式的模型、凭据和思考设置由DSH管理，检索后端不接收模型凭据、不再次调用模型。

三类基础机制均有独立目录。`services/cloudflare-turnstile`仅比对配置的演示令牌，不做人机识别；`services/redis`仅使用当前进程内存，不连接Redis，不提供跨实例原子性与持久化；`services/vercel`包含实际业务代码，本地由明确标记的Vercel模拟执行器运行。配置中的Key用于表达服务边界，不意味着已调用真实Cloudflare或Redis。服务端调用可使用模拟验证器自己的演示令牌，此行为不能用于公开站点防机器人。

独立问答路径真实调用Vector与LLM；检索出口仅真实调用Vector。缺少配置会报错，不回退到作者服务；离线示例显式注入替身。Upstash Vector存放向量和文章元数据，Redis模拟层只管理短期协调状态，两者职责不同。

### 3. 内容更新与自动化

本仓库可手动运行采集、统计和增量同步；也保留签名Webhook入口，在配置完成后向使用者指定的仓库派发`repository_dispatch`。Webhook去重使用内存模拟层，不能视为真实Redis的分布式去重。

本仓库**没有启用GitHub Actions，也没有连接作者原网站的自动部署链路**。`docs/upstream/sync-vector.yml`只是使用者可自行配置的参考。派发成功仅表示任务通知被接受，不表示下游已采集、入库或部署；完整更新需要使用者接上自己的任务与部署配置。详见[内容链路](docs/content-pipeline.md)。

### 原网站与公开仓库的对应关系

| 环节 | 原网站实际部署 | 本仓库的简化实现 |
| --- | --- | --- |
| 前端 | React聊天、流式正文与来源展示 | 无聊天UI；提供CLI和HTTP接口，可另接DSH插件或自建前端 |
| 访问验证 | 真实Cloudflare Turnstile与服务端Siteverify | 配置令牌比对的模拟层 |
| 运行时协调 | 真实Upstash Redis，包含限流、去重、并发锁和预算预留 | 单进程内存模拟，不具备跨实例原子性与持久化 |
| 文档与检索 | 原网站语料、元数据总览与真实Upstash Vector | 使用者自配语料、总览与真实Vector；不附带作者私有资料 |
| 模型与输出 | 原站服务端组织上下文，转发模型实时流并附来源 | 独立问答先校验完整JSON再分块发送；DSH模式只提供检索证据 |
| 内容更新 | Webhook、真实Redis去重、已接入的Actions与网站部署更新 | 手动命令与可配置Webhook；工作流仅作参考，无默认自动部署 |
| 提示词与配置 | 原网站自己的业务规则、提示词与服务凭据 | 公开通用格式说明与示例配置，不包含原站私有提示词或密钥 |

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
   仅独立问答读取`LLM_*`配置。可选`LLM_THINKING_MODE`用于显式控制兼容接口，留空时采用接口默认值；DSH接入不读取此项、不改动会话思考模式。后端只采用正文`content`，不会把`reasoning_content`冒充最终回答。
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

只需检索证据时，将同一请求发送至`/api/retrieve`。返回`info-card-evidence/1`的JSON：`{protocol,version,request_id,sources:[{id,title,url,text}],overview}`，不调用LLM、不生成答案。DSH插件默认配置此地址，后端无需LLM配置。

`/api/chat`返回[info-card-sse/1](docs/protocol.md)：meta、可选status、text_delta、info_card、done。来源卡片包含id、title、url、excerpt、used、order。只展示used=true的卡片，按order排序；没有引用也返回空数组。模型仅返回正文和来源ID/采用声明，标题、网址和摘要从检索证据中补齐，避免由模型杜撰链接。

本实现先等待LLM返回完整结构化JSON，通过合法性与来源校验后再分块发送。因此SSE是已验证结果的分块交付，不宣称上游模型逐token实时输出。插件可以消费真正逐token输出的其他服务，二者只共享协议。

## 本仓库的Vercel部署与内容更新

`api/chat.js`和`api/retrieve.js`是Vercel入口，复用`services/vercel`业务代码。部署时选择无前端框架，Output Directory留空并设置自己的服务端环境变量。当前Cloudflare与Redis仍为模拟层，在多实例Vercel中状态不会共享，公开生产部署前需替换为真实基础设施；不能因代码放上云便宣称拥有全局限流或预算保障。

内容更新为：源仓库push → Vercel签名Webhook验签与来源白名单 → Redis模拟去重 → 向使用者指定仓库发送repository_dispatch → 使用者的采集任务读取源文档 → 重算统计与分块 → 新增/变化内容入库、确认可查询后清理当前分区旧版本。也可完全手动运行。详情见[内容链路](docs/content-pipeline.md)。仓库不启用任何自动Actions，docs中的工作流仅作参考。

若使用DSH插件，它只是此后端的一种可替换客户端；后端没有DSH依赖。其他SSE客户端或命令行同样可用。见[验证边界](VALIDATION.md)和[安全说明](SECURITY.md)。
