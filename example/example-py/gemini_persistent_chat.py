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

        session_regex = re.compile(r"^\s*(\d+)\.\s+.*\[(.+?)\]\s*$")
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
