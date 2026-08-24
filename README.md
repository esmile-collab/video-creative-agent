# Video Creative Agent（视频创意 Agent）

一个面向中文口播内容的公开工程基线：把 Brief（任务简报）编译成有事实边界的脚本请求，再把确认脚本转换成可审阅、可校验、可导出的分镜。

## 当前闭环

```text
Brief（任务简报）
→ 策略卡硬过滤与 Top-1（第一名）召回
→ 脚本请求编译
→ 确认脚本
→ 确定性语义切分与时间预算
→ 画面类型与 Caption（画面描述）
→ 结构校验
→ JSON / Markdown（结构化数据 / 可读文档）导出
```

仓库默认使用 Mock Provider（模拟模型供应方），无需 API Key（接口密钥）即可运行完整 Demo（演示）。`core/providers/openai-compatible.mjs` 提供真实模型适配器，密钥只从服务端环境变量读取。

完整产品范围、前端信息架构和上线验收见 [`docs/PRD.md`](docs/PRD.md)，公开迁移取舍见 [`MIGRATION_REPORT.md`](MIGRATION_REPORT.md)。

## 快速开始

```bash
npm test
npm run demo
npm run safety
```

Demo 输出写入 `outputs/demo_001/`，该目录默认不进入 Git。

## 脚本生成 Web 界面

```bash
npm start
```

打开 http://localhost:4173 （可用 `PORT` 环境变量修改端口）。界面分为三步：

1. **填写需求**：标题、脚本类型、目标受众、核心产品、产品卖点、核心事实、想表达的内容，以及可选的"不能说的内容"。
2. **校对文案**：先只生成口播文案，可在页面上直接修改，确认后再进入下一步。
3. **调整分镜**：基于确认后的文案生成分镜表（时间戳、画面类型、画面 Caption），画面类型与 Caption 可直接编辑，语速和每段最大字数可调整后重新切分，支持导出 Markdown。

界面默认使用 Mock Provider，无需 API Key；「填充示例」按钮可一键填入 `examples/demo_001/` 的演示内容。

界面由 `app/` 目录承载：静态页面与交互（`index.html`、`styles.css`、`app.js`）、零依赖 Node HTTP 服务（`server.mjs`，暴露 `POST /api/script`、`POST /api/storyboard` 与 `GET /health`）、以及复用核心管线的生成逻辑（`generate.mjs`）。

## 真实公开视频 Demo

`examples/demo_001/public-sources.json` 保存三个 C 端可访问的视频 URL（链接）、视频 ID 和标题，用于说明策略来源与外部参考关系。

仓库不再分发视频二进制、完整字幕或抽帧。公开视频的展示与播放由来源页面承接。若项目所有者取得明确再分发许可，可在自己的部署中把媒体接入对象存储。

## 核心目录

```text
core/strategy/       策略卡校验、召回与脚本请求编译
core/storyboard/     脚本切分、画面规划与分镜渲染
core/evaluation/     结构门禁与切点评测
core/providers/      Mock 与兼容模型适配器
app/                 脚本生成 Web 界面（表单、静态服务与生成 API）
contracts/           可公开的数据契约
examples/demo_001/   无内部业务数据的演示输入
scripts/             Demo、脱敏扫描和验证入口
tests/               核心行为测试
docs/                产品范围与数据边界
```

## 当前边界

- 已提供：策略召回、回退、脚本请求编译、确认脚本到分镜、自动结构门禁、外部公开视频引用。
- 尚未提供：自动视频理解、策略卡自动生产、真实素材召回、TTS（语音合成）、多渲染器和成片合成。
- 自动门禁只说明结构可用，画面质量仍需人工确认或受控盲评。

## 许可证

代码采用 [MIT License](LICENSE)。`package.json` 保持 `private: true`，用于防止误发布为 npm（Node 包管理器）软件包。
