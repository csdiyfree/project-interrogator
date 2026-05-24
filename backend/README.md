# 项目拷打器后端

BE0 只提供后端地基:FastAPI 应用、同步 SQLAlchemy、Pydantic 契约模型、LLM 客户端、提示词注册表和空路由桩。业务端点由 BE1/BE2/BE3 在各自路由与 service 中补齐。

## 启动

```bash
cd backend
python --version  # 需要 Python 3.11+
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

`backend/.env` 已由项目负责人预置真实密钥,不要用 `.env.example` 覆盖,也不要提交真实 `.env`。

启动时会自动创建 `data/` 目录并执行建表。默认数据库为 `sqlite:///./data/app.db`。

## 给后续模块的接口

共享 import:

```python
from app.db import get_db, SessionLocal
from app.llm import chat, stream_chat, complete_json, DEFAULT_MODEL, AVAILABLE_MODELS, LLMError
from app.prompts.registry import render
from app.main import require_session
from app import schemas, models
```

各模块只在自己的 `routers/<name>.py` 加端点;业务逻辑放在自建的 `services/<name>_service.py`。BE1 的 PDF 转文本工具预期放在 `app/pdf.py`。BE0 不创建 `services/` 与 `pdf.py`。

DB 操作为同步 SQLAlchemy;LLM/IO 为 async。后台任务可用 `asyncio.create_task(...)` 或 FastAPI `BackgroundTasks`,任务内必须用 `SessionLocal()` 自开会话并负责关闭。

业务错误统一抛:

```python
raise HTTPException(status_code=404, detail={"code": "not_found", "message": "资源不存在"})
```

全局异常处理会包装为契约格式:

```json
{"error": {"code": "not_found", "message": "资源不存在"}}
```

## 已留空的路由

- `app/routers/resumes.py`: BE1 填充简历解析端点。
- `app/routers/interrogations.py`: BE2 填充拷问与 SSE 端点。
- `app/routers/guides.py`: BE3 填充指南与 todo 端点。
