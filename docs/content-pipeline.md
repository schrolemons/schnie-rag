# 内容采集与增量更新

## 文档与元数据

将已授权公开的Markdown放在src/content/<来源ID>/，并在lib/source-sites.js设置来源。运行npm run content:overview生成元数据总览，运行npm run sync:vector:check离线检查分块与入库计划。程序保留标题、路径、标签、关键词、字数与文章哈希；文章数和片段数分别统计。总览辅助全局认识，不把检索到的几段资料当作全站完整统计。

需要只读采集自己的源仓库时，配置repository、branch、url与contentDir（默认source）；各来源检出至CONTENT_SOURCES_DIR/<来源ID>/。普通Markdown仓库可将contentDir设为.或docs。npm run content:refresh先验证所有来源，再仅写入本仓库的内容副本；源仓库保持只读。目录逃逸、外部链接以及draft、private、未发布、带密码或加密资料被拒绝或排除。

原文url应显式填写，Hexo资料也可按permalink推导。无法推导完整文章地址时仅标为站点入口，不声称是原文直达地址。

## 真实向量同步

upstash-data要求真实Upstash索引支持托管文本嵌入；external要求使用者提供兼容Embeddings接口、模型和相同维度。模型身份进入版本指纹。配置必须使用自己的账号与独立kb-分区。

增量过程比较文章与片段哈希：新增或变化记录先上传，等待可查询，再清理当前分区旧版本；上传失败或尚在嵌入时保留旧版本，不清空其他分区。正式同步会发生真实外部写入并产生费用。离线dry-run只检查计划，不证明外部索引已经同步。

## 更新触发

源仓库push → Vercel的/api/content-update读取原始字节 → HMAC验签、来源仓库与分支白名单 → Redis模拟层根据已签名正文摘要去重 → repository_dispatch到指定目标仓库 → 使用者自行配置的采集任务 → 重新统计、分块与增量入库。

Webhook需要CONTENT_SYNC_WEBHOOK_SECRET（至少32字符）、CONTENT_SYNC_GITHUB_TOKEN、CONTENT_SYNC_TARGET_REPOSITORY，以及REDIS_SIMULATOR_KEY。派发失败会释放去重占位，接受派发不等于已经完成入库。

当前去重只在单进程内存生效，重启或多个Vercel实例之间不共享；这不是生产分布式去重服务。Cloudflare模拟验证用于问答入口，Webhook使用HMAC签名，不依赖浏览器验证码。

本仓库没有启用Actions。docs/upstream/sync-vector.yml仅为部署者可选的参考文件，需替换示例来源、分支、目录与Secrets后自行采用。无需自动化时，手动运行content:refresh与sync:vector即可。不要提交真实提示词、Webhook密钥或GitHub令牌。
