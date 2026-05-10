# API 接口说明

## 1. 会话管理 (Sessions)

### 获取所有活跃会话
- **URL**: `/sessions`
- **Method**: `GET`
- **Response**: `string[]` (Session ID 数组)

## 2. 文件系统 (File System)

### 获取目录列表
- **URL**: `/files`
- **Method**: `GET`
- **Query Params**:
  - `path`: 可选。目标目录的绝对路径，默认为后端运行的工作目录。
- **Response**:
  ```json
  [
    {
      "name": "src",
      "isDirectory": true,
      "path": "/abs/path/to/src"
    },
    ...
  ]
  ```

### 获取文件内容
- **URL**: `/file/content`
- **Method**: `GET`
- **Query Params**:
  - `path`: 必填。文件的绝对路径。
- **Response**: 文件的原始内容（String）。

## 3. 实时终端 (WebSocket)

- **URL**: `ws://localhost:3001?sessionId={id}`
- **消息协议**:
  - **后端发送给前端**:
    ```json
    { "type": "output", "data": "终端输出的字符流" }
    ```
  - **前端发送给后端**:
    - 输入数据:
      ```json
      { "type": "input", "data": "用户按键/粘贴的内容" }
      ```
    - 调整窗口大小:
      ```json
      { "type": "resize", "cols": 80, "rows": 24 }
      ```
