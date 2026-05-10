# Gemini CLI Web UI

这是一个专为远程使用 Gemini CLI 设计的 Web 管理后台。它支持多会话管理、后台常驻运行、断线重连以及基础的文件浏览功能，非常适合在手机、平板或异地电脑上远程操作 Gemini CLI 进行编码和会话。

## 🌟 核心特性

- **多会话持久化**: 后端采用 `node-pty` 维护真实的终端进程。浏览器关闭或重启不影响 CLI 任务进度。
- **断线重连**: 重新打开网页时，自动拉取最近的终端输出缓冲区，实现无缝衔接。
- **100% 终端体验**: 集成 `xterm.js`，支持颜色、快捷键和复杂的命令行交互。
- **文件管理**: 内置文件浏览器，可随时查看工作区目录结构。
- **跨平台访问**: 部署在服务器上后，可通过任意设备的浏览器访问。

## 🏗 架构说明

- **前端 (Frontend)**: React + Vite + TypeScript + xterm.js
- **后端 (Backend)**: Node.js (Express) + WebSocket + node-pty
- **通信**:
  - REST API: 用于会话列表获取、文件系统操作。
  - WebSocket: 用于终端输入输出流的双向实时同步。

## 🚀 快速开始

### 环境要求
- Node.js v18+
- 已安装 `gemini` CLI (`npm install -g @google/gemini-cli`)

### 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 启动服务

建议开启两个终端窗口分别运行：

```bash
# 启动后端 (默认端口 3001)
cd backend
npm run dev

# 启动前端 (默认端口 5173)
cd frontend
npm run dev
```

访问地址: [http://localhost:5173](http://localhost:5173)

## 文件夹结构

```
.
├── backend/            # 后端服务代码 (PTY 逻辑, WebSocket, API)
├── frontend/           # 前端 UI 代码 (React, xterm.js)
├── docs/               # 项目文档与设计图 (DESIGN.md, API.md)
└── README.md
```

## 🔒 安全建议
本项目目前为开发原型。如果你计划在公网远程访问，请务必在后端增加身份验证（如 Basic Auth 或 JWT），并使用 HTTPS 部署。
