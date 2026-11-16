# 本地运行与部署

本地入口为npm start，监听127.0.0.1:8787；浏览器开发入口npm run dev监听127.0.0.1:5173并代理API。请复制.env.example后配置自己的服务，并把前端实际Origin加入CHAT_ALLOWED_ORIGINS。仅有页面或health响应不能证明数据库与模型正常。

三个后端入口是/api/chat、/api/knowledge、/api/content-update。chat使用Redis、Vector和生成模型；knowledge只使用Redis、Vector与构建总览；content-update在显式配置后才校验签名并派发更新。Cloudflare仅承担可选Turnstile，不承载本项目API。

Vercel构建命令npm run build，静态目录dist。环境变量配置在自己的部署项目；私密Key和CHAT_SYSTEM_PROMPT不得使用PUBLIC_前缀。只有公开Turnstile站点Key进入前端构建。用户填写的模型Key只放当前页面内存，刷新即清除，使用时会发送到你部署的后端。

上线前用一段已知语料分别测试实际检索片段、生成回答、来源链接和取消。模型访问、索引嵌入方式、Redis配置和Turnstile都需各自验证，离线替身通过不等于生产服务已验收。升级到0.2.0请使用新的kb-分区并重新入库，不覆盖旧站点分区。
