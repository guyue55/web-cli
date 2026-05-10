# Gemini CLI 多轮对话工具（Python，会话 ID 复用）

## 简介
基于官方 gemini-cli 封装的 Python 多轮对话工具。

解决传统“单轮脚本”模式痛点：
- 无法自然地延续多轮上下文
- 会话管理（创建/删除）不统一

本工具采用 **Gemini Session UUID 复用**：
- 每轮调用使用 headless 模式（`-p` + `--output-format json`），便于脚本化与解析输出
- 通过 `--resume <session-id>` 复用同一个会话 UUID，保证多轮对话上下文连续
- 支持绑定项目根目录（cwd），让 Gemini CLI 感知项目文件与代码结构
- 会话分为 **软关闭（只清内存映射）** 与 **硬删除（删除本地会话记录）**

## 核心特性
1. **多轮上下文复用**：通过 `--resume` 延续同一会话 UUID
2. **脚本友好输出**：`--output-format json` 便于稳定解析
3. **项目文件感知**：绑定项目根目录（cwd）
4. **会话分离管理**
   - 软关闭：仅清空程序内存映射，**不影响磁盘会话记录**
   - 硬删除：删除 gemini-cli 本地会话记录（按 index 删除）
5. 跨平台兼容：Windows / macOS / Linux

## 前置环境
- Python 3.8 及以上
- 安装 Node.js
- 全局安装 Gemini CLI 并完成登录授权

## 安装与配置
### 1. 安装 Gemini CLI
```bash
npm install -g @google/gemini-cli
```

### 2. 首次运行并完成授权
首次运行 `gemini` 时会提示认证，按提示完成即可。

```bash
gemini --version
```

### 3. 环境验证（可选）
```bash
gemini --list-sessions
```
## 完整 Python 源码
文件名：gemini_persistent_chat.py
```python
import subprocess
import uuid
import os
import json
import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


@dataclass(frozen=True)
class _SessionInfo:
    """In-memory session record for mapping local session_id to Gemini session UUID."""

    gemini_session_id: str
    project_root: str


class GeminiCliPersistentChat:
    """Gemini CLI 多轮对话封装（基于会话 ID 复用上下文）。

    说明：
    - gemini-cli 新版本已不再支持旧参数（如 --session/--no-tools/--plain）。
    - 该实现使用 headless 模式（-p + --output-format json），每轮对话启动一次 CLI，
      但通过 --resume 复用同一个会话 UUID，保证多轮上下文连续。
    """

    def __init__(self, timeout_seconds: int = 180):
        self._sessions: Dict[str, _SessionInfo] = {}
        self._timeout_seconds = timeout_seconds

    def _run_gemini(self, args: List[str], cwd: str) -> Tuple[int, str, str]:
        """Runs gemini-cli with capture_output and returns (code, stdout, stderr)."""
        completed = subprocess.run(
            ["gemini", *args],
            cwd=cwd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=self._timeout_seconds,
            shell=False,
            check=False,
        )
        return completed.returncode, completed.stdout, completed.stderr

    def _bootstrap_session(self, gemini_session_id: str, project_root: str) -> None:
        """Creates the session on disk by issuing a no-op prompt once."""
        args = [
            "--session-id",
            gemini_session_id,
            "--skip-trust",
            "--approval-mode",
            "yolo",
            "--output-format",
            "json",
            "-p",
            " ",
        ]
        self._run_gemini(args=args, cwd=project_root)

    def create_session(self, project_root: str) -> str:
        """
        创建会话并绑定项目目录
        :param project_root: 项目根目录
        :return: 唯一 session_id
        """
        project_root = os.path.abspath(project_root)

        sess_id = str(uuid.uuid4())[:16]
        gemini_session_id = str(uuid.uuid4())
        self._bootstrap_session(gemini_session_id=gemini_session_id, project_root=project_root)

        self._sessions[sess_id] = _SessionInfo(
            gemini_session_id=gemini_session_id,
            project_root=project_root,
        )
        return sess_id

    def chat(self, session_id: str, prompt: str) -> str:
        """多轮对话，复用 Gemini 会话上下文。"""
        if session_id not in self._sessions:
            return "会话不存在，请先创建会话"

        sess_info = self._sessions[session_id]

        args = [
            "--resume",
            sess_info.gemini_session_id,
            "--skip-trust",
            "--approval-mode",
            "yolo",
            "--output-format",
            "json",
            "-p",
            prompt,
        ]
        code, stdout, stderr = self._run_gemini(args=args, cwd=sess_info.project_root)
        if code != 0:
            msg = (stderr or stdout).strip()
            return f"Gemini 调用失败（exit={code}）：{msg}" if msg else f"Gemini 调用失败（exit={code}）"

        try:
            payload = json.loads(stdout)
        except json.JSONDecodeError:
            return stdout.strip()

        response = str(payload.get("response", "")).strip()
        if response:
            return response

        error = payload.get("error")
        if error:
            return f"Gemini 返回错误：{error}"
        return ""

    def close_session(self, session_id: str) -> bool:
        """
        软关闭会话
        仅从内存移除记录，不杀进程、不删除磁盘会话文件
        """
        if session_id in self._sessions:
            self._sessions.pop(session_id)
            return True
        return False

    def delete_session(self, session_id: str) -> bool:
        """
        硬删除会话
        删除 Gemini 本地会话记录 + 清空内存
        """
        if session_id not in self._sessions:
            return False

        sess_info = self._sessions[session_id]

        code, stdout, _ = self._run_gemini(
            args=["--list-sessions"],
            cwd=sess_info.project_root,
        )
        if code != 0:
            return False

        session_regex = re.compile(r"^\\s*(\\d+)\\.\\s+.*\\[(.+?)\\]\\s*$")
        index_to_delete: Optional[str] = None
        for line in stdout.splitlines():
            match = session_regex.match(line.strip())
            if not match:
                continue
            idx, uuid_text = match.group(1), match.group(2)
            if uuid_text.strip() == sess_info.gemini_session_id:
                index_to_delete = idx
                break

        if not index_to_delete:
            self._sessions.pop(session_id, None)
            return False

        delete_code, _, _ = self._run_gemini(
            args=["--delete-session", index_to_delete],
            cwd=sess_info.project_root,
        )
        if delete_code != 0:
            return False

        self._sessions.pop(session_id, None)
        return True


if __name__ == "__main__":
    chat = GeminiCliPersistentChat()
    PROJECT_PATH = os.getcwd()

    sid = chat.create_session(PROJECT_PATH)
    print("会话ID：", sid)

    res1 = chat.chat(sid, "简要分析当前项目目录结构")
    print("\n=== 第一轮回复 ===")
    print(res1)

    res2 = chat.chat(sid, "给出目录结构优化建议")
    print("\n=== 第二轮回复 ===")
    print(res2)

    # 软关闭
    # chat.close_session(sid)

    # 彻底删除
    # chat.delete_session(sid)
```
## 快速使用示例
```python
from gemini_persistent_chat import GeminiCliPersistentChat
import os

if __name__ == "__main__":
    chat = GeminiCliPersistentChat()
    # 指定项目根目录
    proj_dir = os.getcwd()

    # 创建会话
    sid = chat.create_session(proj_dir)

    # 多轮对话
    print(chat.chat(sid, "帮我梳理项目结构"))
    print(chat.chat(sid, "哪些文件可以精简"))

    # 仅本地关闭，保留会话历史
    chat.close_session(sid)

    # 彻底销毁会话
    # chat.delete_session(sid)
```

## 创建会话参数说明

方法签名：

```python
def create_session(self, project_root: str) -> str
```

参数说明：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| project_root | str | 是 | 项目根目录（相对/绝对路径均可）。gemini-cli 会以该目录作为工作区（cwd）。 |

返回值：
- 16 位 `session_id`（本工具内部使用，用于映射 Gemini session UUID）。

## API 接口说明
- `create_session(project_root)`：创建会话映射，并在本地初始化一个 Gemini session UUID。
- `chat(session_id, prompt)`：发送提问，通过 `--resume` 复用同一 session UUID，延续多轮上下文。
- `close_session(session_id)`：软关闭（仅移除内存映射，不删除磁盘会话记录）。
- `delete_session(session_id)`：硬删除（调用 `gemini --delete-session <index>` 删除磁盘会话记录，并清理内存映射）。

## Gemini CLI 参数说明（与示例一致）
- `--session-id <uuid>`：创建一个指定 UUID 的新会话
- `--resume <uuid>`：继续指定 UUID 的历史会话
- `--list-sessions`：列出当前项目下的会话（带 index）
- `--delete-session <index>`：按 index 删除会话
- `-p/--prompt "<text>"`：headless 模式执行（脚本化）
- `--output-format json`：结构化输出，便于解析
- `--skip-trust`：跳过工作区信任确认
- `--approval-mode yolo`：自动审批工具执行（谨慎使用）

## 会话存储路径
会话数据由 gemini-cli 统一管理，通常在用户目录的 `.gemini` 下（不同版本/配置可能略有差异）：
- macOS / Linux：`~/.gemini/`
- Windows：`C:\Users\<用户名>\.gemini\`

特点：
- 跨终端/跨程序可复用（同项目下可通过 `gemini --list-sessions` 查看）
- “软关闭”不会删除磁盘会话记录

## 注意事项
- `--approval-mode yolo` 会自动允许工具执行，风险较高；如需更安全，可将代码中该参数改为 `default` 或 `plan`。
- 默认超时为 180 秒，可通过 `GeminiCliPersistentChat(timeout_seconds=...)` 调整。
- 若遇到工作区信任提示导致阻塞，可使用 `--skip-trust`（示例已默认启用）。

## 常见问题
- 会话不存在：未创建会话直接调用，或已执行硬删除。
- 无法读取项目文件：`project_root` 路径错误，或工作区未被信任（可用 `--skip-trust` 规避交互）。
- 等待认证/认证失败：首次运行 `gemini` 完成认证；或检查网络/账号状态。
- 为什么不是“真常驻进程”：gemini-cli 交互模式是全屏 TUI。脚本化、稳定复用上下文的方式是 headless + session UUID；若需要真正的 PTY 常驻复用，建议使用 `node-pty`（本仓库 backend 已采用该方式）。
