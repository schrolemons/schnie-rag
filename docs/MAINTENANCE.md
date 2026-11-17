# 维护与检查

[返回项目说明](../README.md)

## 本地检查

Node.js24与npm。

在仓库根目录运行：

```sh
npm ci
npm run check
npm test
npm run privacy:check
npm run sync:vector:check
npm run demo:offline
npm run build
```

检查只使用本地资料和明确的替身服务，不配置真实模型或数据库凭据，不运行正式向量同步。

## 发布与下载

当前使用入口是README中的源码安装和部署说明。本次维护不创建稳定版Release，也不改变package.json的版本号。

## 反馈

使用[Issues](https://github.com/schrolemons/schnie-rag/issues)报告问题，提供使用环境、操作步骤和预期／实际结果。日志中的密钥、账号、聊天记录与个人配置应先移除。已有仓库规则和安全说明优先于个人账号的通用模板。

## 项目标识

`docs/assets/project-cover.svg`是封面源文件，PNG用于README和链接分享。封面是项目标识，不是实际运行截图。版式由schrolemons的项目封面统一约定组成；修改时保留文字可读性和1280×640画布。
