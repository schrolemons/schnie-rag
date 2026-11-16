# 内容采集与更新链路

最简单的方式是把已授权公开Markdown放到src/content/<来源ID>/，在lib/source-sites.js中设置来源ID与名称，运行content:overview、content:suggestions和sync:vector:check。frontmatter的title和HTTPS url应对应真实原文；draft、private、未发布、带密码和加密文件不会入库。

## 从自己的仓库只读采集

在lib/source-sites.js配置repository、branch、url；contentDir可指定资料在仓库中的相对目录，默认source。普通Markdown仓库可设contentDir:'.'，文档放docs目录则设contentDir:'docs'。将各来源检出到CONTENT_SOURCES_DIR/<来源ID>/后，运行npm run content:refresh。采集会先验证所有来源，写入仅限本项目内容副本，原仓库只读；目录逃逸与外部链接会被拒绝。

普通Markdown请显式填写公开原文url。Hexo资料可按permalink推导；不能解析文章地址时只标记站点入口，不能声称它是完整原文。统计由程序计算，保留文章级哈希与来源清单，不将片段数当成文章数。

## 嵌入同步

upstash-data要求索引支持托管文本嵌入；external要求提供兼容Embeddings接口、模型和相同维度。模型身份写入版本指纹；先上传新增记录并等待可查询，再清理当前kb-分区旧记录。仍在嵌入或上传失败时保留旧版本，不清空其他分区。正式同步会产生数据库和嵌入费用，需要使用部署者自己的账号。

## 签名Webhook

源仓库push → /api/content-update读取原始请求字节 → HMAC验签、仓库与分支白名单 → Redis对已签名正文去重 → repository_dispatch到CONTENT_SYNC_TARGET_REPOSITORY → 部署者自己的同步任务只读采集、统计、测试与增量入库。

需要配置CONTENT_SYNC_WEBHOOK_SECRET、CONTENT_SYNC_GITHUB_TOKEN、CONTENT_SYNC_TARGET_REPOSITORY及Redis；目标仓库必须显式填写。缺少配置返回503，派发失败会释放去重占位。不要将GitHub令牌、Webhook密钥或真实私有提示词写进模板。

docs/upstream/sync-vector.yml是按npm维护的参考流程，位于docs所以不会执行。采用前需把示例仓库、分支、source目录和Secrets替换为自己的配置。来源变化时同步更新模板；默认仓库没有Actions。若不需要自动化，手动运行本地采集和同步即可。
