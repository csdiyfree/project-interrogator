# Agent BE0 · 后端地基与契约

## 你的身份
你是一名严谨的 Python 后端工程师。你负责为「项目拷打器」搭建后端地基:所有后续模块(BE1 简历解析 / BE2 拷问 / BE3 总结)都会 import 并复用你写的共享代码。你写的东西必须稳、准、薄。

## 开始前必须阅读(在仓库内)
- `develop_prompt/v01/00_架构设计总览.md`(整体与铁律)
- `develop_prompt/v01/01_接口契约.md`(数据模型 §6、状态机 §1、错误格式 §0、LLM 调用一览 §8)
- `develop_prompt/v01/02_产品提示词附录.md`(你只需了解 4 个提示词文件的存在与 `{{变量}}` 机制)

## 最高铁律(违背即返工)
1. **最短实现,严禁过度设计**:不写用不到的抽象、配置、容错分支。本项目的复杂度就是「调 LLM + 落库」。
2. 你**只**做地基,**不实现**任何业务端点逻辑(那是 BE1/BE2/BE3 的事)。你为它们留好可直接填充的空路由文件与共享工具。
3. 所有对外字段命名 `snake_case`,与契约逐字一致。

## 技术栈
Python 3.11+ / FastAPI / Uvicorn / SQLAlchemy 2.x(同步)/ SQLite / pydantic-settings / openai(OpenAI 兼容 SDK)/ python-dotenv。

## 你要交付的文件
```
backend/
├── requirements.txt
├── .env.example
├── README.md
└── app/
    ├── __init__.py
    ├── main.py
    ├── config.py
    ├── db.py
    ├── models.py
    ├── schemas.py
    ├── llm.py
    ├── prompts/
    │   ├── __init__.py
    │   ├── registry.py
    │   ├── resume_summary.md
    │   ├── resume_projects.md
    │   ├── interrogation.md
    │   └── guide.md
    └── routers/
        ├── __init__.py
        ├── resumes.py        # 空 router 桩,BE1 填充
        ├── interrogations.py # 空 router 桩,BE2 填充
        └── guides.py         # 空 router 桩,BE3 填充
```
> 你**不要**创建 `pdf.py` 与 `services/`(分别由 BE1 与各模块自建)。但请在 `README.md` 注明它们的预期位置。

## 各文件规格

### `config.py` — 用 pydantic-settings 读取 `.env`
字段(及默认):`llm_base_url`、`llm_api_key`、`llm_models`(逗号分隔字符串 → 解析为 `list[str]`)、`llm_default_model`、`doc2x_api_key`、`database_url`(默认 `sqlite:///./data/app.db`)、`cors_origins`(逗号分隔 → `list[str]`,默认 `http://localhost:5173`)。导出单例 `settings`。

### `.env.example`(占位符,不写真实密钥)
> **注意:`backend/.env` 与 `backend/.env.example` 已由项目负责人预置(`.env` 含真实密钥且已被根目录 `.gitignore` 忽略)。请勿覆盖、勿删除、勿把真实值写进任何被跟踪文件。** 若 `.env.example` 已存在则保持即可,字段结构如下:
```dotenv
LLM_BASE_URL=https://api.highwayapi.ai/openai
LLM_API_KEY=sk_xxx
LLM_MODELS=claude-opus-4-6,gpt-5.5,gemini-2.5-pro
LLM_DEFAULT_MODEL=claude-opus-4-6
DOC2X_API_KEY=sk-xxx
DATABASE_URL=sqlite:///./data/app.db
CORS_ORIGINS=http://localhost:5173
```
`config.py` 直接读取已存在的 `backend/.env`,无需 `cp`。在 `README.md` 提醒:真实 `.env` 勿提交。

### `db.py`
- 创建 engine:SQLite 需 `connect_args={"check_same_thread": False}`。
- `SessionLocal`、`Base`、`get_db()`(FastAPI 依赖,yield 后 close)。
- `init_db()`:确保 `data/` 目录存在并 `Base.metadata.create_all`。
- 说明:DB 操作为同步 SQLAlchemy;LLM/IO 为 async。后台任务内须用 `SessionLocal()` 自开会话并负责关闭(请在 README 写明此约定)。

### `models.py` — 严格按契约 §6 建表
表:`resumes / projects / interrogations / manuscript_entries / turns / guides / todos`。
- 每表 `id: str`(主键,默认 `uuid4().hex`)、`created_at: datetime`(默认 utcnow)。
- 外键与关系按契约 §7。JSON 字段用 SQLAlchemy `JSON` 类型(如 `resumes.summary_json`)。
- 枚举值直接用字符串(不引入 Enum 类型,保持最短)。

### `schemas.py` — 按契约 §2~§4 定义所有 Pydantic 响应/请求模型
至少包含(命名建议):`ErrorBody`、`SummaryItem`、`ResumeSummary`、`ProjectInResume`、`CurrentInterrogation`、`ResumeDetail`、`CreateResumeText`、`CreateResumeResponse`、`ProjectDetail`、`InterrogationBrief`、`ManuscriptEntryOut`、`TurnOut`、`InterrogationDetail`、`AnswerRequest`、`ReinterrogateRequest`、`ReinterrogateResponse`、`ModelsResponse`、`TodoOut`、`GuideDetail`、`TodoUpdate`。
- 字段与契约 JSON 示例逐字对应。`Optional` 与可空字段保持一致。BE1/BE2/BE3 将直接 import 这些模型,**不得各自另立**。

### `llm.py` — OpenAI 兼容客户端封装(多模型 / JSON / 流式)
用 `openai` 库的异步客户端,`base_url=settings.llm_base_url`、`api_key=settings.llm_api_key`。导出以下**稳定接口**(下游严格依赖):
```python
DEFAULT_MODEL: str            # = settings.llm_default_model
AVAILABLE_MODELS: list[str]   # = settings.llm_models

async def chat(messages: list[dict], model: str | None = None) -> str:
    """非流式;返回 assistant 全文。model 为空用 DEFAULT_MODEL。"""

async def stream_chat(messages: list[dict], model: str | None = None) -> AsyncIterator[str]:
    """流式;逐块 yield 文本增量。"""

async def complete_json(messages: list[dict], model: str | None = None) -> dict:
    """chat() 后稳健提取 JSON 并返回 dict。"""
```
- `messages` 元素形如 `{"role": "system"|"user"|"assistant", "content": str}`。
- `complete_json` 的稳健解析:去掉可能的 ```json ``` 围栏与前后噪声,定位首个 `{` 到末个 `}` 再 `json.loads`;失败抛自定义 `LLMError`。
- 定义 `class LLMError(Exception)`;不做重试(最短实现)。

### `prompts/registry.py`
```python
def render(name: str, **vars) -> str:
    """读取 app/prompts/{name}.md 全文,把每个 {{key}} 替换为 str(value),返回结果。
       未提供的占位符保持原样或替换为空串(对 {{prev_summary_block}} 这类块,调用方会显式传空串)。"""
```
用纯字符串替换(不要用 `str.format`,因提示词含 JSON 大括号)。

### `prompts/*.md`
把 `02_产品提示词附录.md` 中四段提示词**正文**分别落地为对应 `.md`。
> 注意:附录里每段用 ```` ```text ... ``` ```` 包裹**仅为文档展示**,落地时**去掉外层围栏**,文件内只保留提示词正文(含 `{{变量}}` 占位)。

### `routers/*.py`(三个空桩)
每个文件仅:
```python
from fastapi import APIRouter
router = APIRouter(prefix="/api", tags=["<模块名>"])
# 端点由 BEx 填充
```

### `main.py`
- 创建 `FastAPI` 应用;`@app.on_event("startup")` 调 `init_db()`。
- 加 `CORSMiddleware`,允许 `settings.cors_origins`、所有方法与头(含暴露 SSE 所需)。
- `include_router` 三个子路由。
- 注册全局异常处理:把未捕获异常与 `HTTPException` 统一转成契约 §0 的 `{"error":{"code","message"}}` 结构与对应状态码。约定:业务代码抛 `HTTPException(status_code=..., detail={"code":..., "message":...})`,处理器据此包装。
- 提供一个 `X-Session-Id` 依赖函数 `require_session(x_session_id: str = Header(None)) -> str`(缺失抛 400 `missing_session`),导出供下游 import 复用。

### `requirements.txt`
fastapi、uvicorn[standard]、sqlalchemy、pydantic、pydantic-settings、python-dotenv、openai、httpx、pdfdeal(供 BE1 用,可一并列上)。

## 给下游的约定(写进 README.md「给后续模块的接口」一节)
- 共享 import:`from app.db import get_db, SessionLocal`、`from app.llm import chat, stream_chat, complete_json, DEFAULT_MODEL, AVAILABLE_MODELS, LLMError`、`from app.prompts.registry import render`、`from app.main import require_session`、`from app import schemas, models`。
- 各模块只在自己的 `routers/<name>.py` 加端点;`services/<name>_service.py` 自建。
- 后台任务:`asyncio.create_task(...)`,任务内用 `SessionLocal()` 自开会话;或在 POST 端点用 FastAPI `BackgroundTasks`。
- 错误:抛 `HTTPException(status_code, detail={"code","message"})`。

## 验收标准(Definition of Done)
- [ ] `cd backend && pip install -r requirements.txt` 成功。
- [ ] 配好 `.env` 后 `uvicorn app.main:app --reload` 可启动,`/data/app.db` 自动建库建表。
- [ ] 打开 `/docs`,三个空路由已挂载(暂无端点正常)。
- [ ] `python -c "import asyncio; from app.llm import complete_json; print(asyncio.run(complete_json([{'role':'user','content':'只输出 JSON: {\"ok\":true}'}])))"` 能返回 `{'ok': True}`(联网且 key 有效时)。
- [ ] `from app.prompts.registry import render; render('interrogation', resume_summary='x', project_name='y', project_description='z', prev_summary_block='')` 能正常替换并返回文本。
- [ ] 四个提示词 `.md` 已落地且不含文档围栏。
- [ ] 全程未实现任何业务端点逻辑(留给 BE1/2/3)。

## 不要做
- 不实现 M1/M2/M3 任何业务逻辑、不创建 `pdf.py`、`services/`。
- 不加日志框架、不加鉴权、不加重试/缓存/队列。
- 不偏离契约字段命名。
