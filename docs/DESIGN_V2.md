# Gemini CLI Web UI - V2 Design Document (Shadow Sessions)

## 1. 愿景 (Vision)
将 Gemini CLI 转化为一个全功能的远程 Web 工作站。不仅是终端的中转站，更是会话的管理中心，提供“秒级历史回溯”和“沉浸式对话体验”。

## 2. 核心架构变更 (V2 Architecture)

### 2.1 影子会话 (Shadow Sessions)
*   **痛点**: 只有通过 `--resume` 启动进程后才能看到历史，速度慢且消耗资源。
*   **方案**: 
    *   **后端主动扫描**: 监测 `~/.gemini/history/` 目录。
    *   **离线预览**: 直接解析 `gemini-cli` 存储在磁盘上的 `state.json` 或日志文件，获取会话的历史对话流。
    *   **按需激活**: 用户点击“继续会话”时，后端才真正拉起 `gemini --resume` 进程。

### 2.2 混合交互 UI (Hybrid UI)
*   **左侧会话池**: 展示所有历史记录，支持搜索和删除。
*   **右侧主面板**:
    *   **历史视图**: 使用 Markdown 渲染从磁盘读取的对话记录，布局类似 ChatGPT。
    *   **实时终端**: 在页面底部或侧边提供一个可收放的 `xterm.js` 窗口，用于显示 Agent 正在进行的底层操作（编译、执行脚本）。

### 2.3 状态同步 (State Sync)
*   当 Web 端断开时，后端维持 PTY 进程。
*   新的 WebSocket 协议支持下发“同步点”，确保前端重连后能区分哪些是新产生的内容。

## 3. 技术路线图 (Roadmap)

### 第一阶段：后端升级 (History Scraper)
- 实现对 `~/.gemini/history/` 的深度递归扫描。
- 提供 `/history/:id/transcript` 接口，返回该会话的所有对话文本，无需启动 PTY。

### 第二阶段：前端重构 (Chat Layout)
- 引入 `react-markdown` 渲染历史记录。
- 实现“阅读模式”与“交互模式”的无缝切换。

### 第三阶段：体验增强 (Advanced Integration)
- 支持文件管理与对话的上下文联动。
- 手机端专属快捷指令面板。
