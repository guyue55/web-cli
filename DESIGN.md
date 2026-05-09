# Gemini CLI Web UI - Design Document

## 1. 概述 (Overview)
旨在打造一个 Web 版的 Gemini CLI 管理面板，使用户可以通过浏览器远程操作、管理多个会话，同时实现“后台常驻、断线重连”的无缝开发体验。

## 2. 核心特性 (Key Features)
- **多会话管理**: 支持创建多个独立的 Gemini CLI 会话，每个会话都有持久化的历史记录。
- **后台常驻与断线重连**: 浏览器关闭或刷新不影响正在执行的 CLI 任务（如编译、Agent 深度思考等）。重新打开网页可立即恢复当前终端状态。
- **对话式/终端混合 UI**: 提供类似 Chat 的直观交互，同时保留终端的原始输出格式。
- **文件管理器**: 在网页端直接浏览、编辑当前工作区的文件。

## 3. 架构设计 (Architecture)

### 3.1 技术栈选型
- **后端 (Daemon)**: Node.js + Express + WebSocket (`ws` 或 `socket.io`)
  - 理由: Node.js 拥有强大的进程管理能力，并且与前端生态统一。
  - PTY 管理: 使用 `node-pty` 库生成伪终端（Pseudo-Terminal）并执行 `gemini-cli` 命令。
  - 存储: SQLite（使用 `better-sqlite3`）或简单的 JSON 文件，用于记录会话元数据（ID、名称、工作目录等）。
- **前端 (Web UI)**: Vite + React + Vanilla CSS (无外部 UI 库，追求轻量)
  - 终端渲染: 使用 `xterm.js` 在网页渲染底层 PTY 输出，保证 100% 兼容 CLI 样式和交互。
  - 布局: 类似主流 IDE（左侧资源管理器/会话列表，右侧主终端/聊天区）。

### 3.2 进程与通信模型
1. **守护进程 (Daemon)**: 后端服务器启动后，维护一个基于 Session ID 的 PTY 进程字典。
2. **状态缓冲 (Buffer)**: 当客户端断开连接时，后端记录 PTY 产生的 stdout 输出；当客户端重连时，下发最新的缓冲区内容，实现无缝衔接。
3. **WebSocket**: 负责键盘输入（stdin）和终端输出（stdout）的实时双向流动。
4. **REST API**: 负责非实时的操作（例如：获取会话列表、读取文件目录树、读写文件内容）。

## 4. 实施阶段 (Implementation Phases)

- **阶段 1: 基础设施搭建**
  - 初始化代码仓库。
  - 搭建 Node.js 后端基础框架及 Vite React 前端框架。
- **阶段 2: 核心 PTY 与会话管理**
  - 后端实现 `node-pty` 的进程创建与销毁。
  - 实现 WebSocket 转发流以及简单的内存缓冲区（重连恢复）。
- **阶段 3: Web UI 主体**
  - 前端引入 `xterm.js` 并与 WebSocket 对接。
  - 实现侧边栏：创建新会话、切换现有会话。
- **阶段 4: 文件系统与增强体验**
  - 后端实现文件列表查询、读写 API。
  - 前端增加简单的文件浏览器侧边栏面板。
