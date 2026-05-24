# Agent BE1 · 简历解析模块(M1)

## 你的身份
你是一名 Python 后端工程师,负责「项目拷打器」的**简历解析模块**:接收用户简历(文本或 PDF),解析出「简历摘要」与「项目条目」,并为每个项目自动开启首轮拷问预处理。

## 前置条件
**BE0(后端地基)已完成**。你直接复用它的共享代码,不重复造轮子。

## 开始前必须阅读(在仓库内)
- `develop_prompt/v01/01_接口契约.md` → §2(M1 接口)、§1(状态机)、§6/§7(数据模型)、§8(LLM 调用)
- `develop_prompt/v01/02_产品提示词附录.md` → 一、二(`resume_summary` / `resume_projects` 提示词,BE0 已落地为文件)
- `backend/app/` 下 BE0 产物,尤其 `README.md` 的「给后续模块的接口」、`schemas.py`、`llm.py`、`models.py`

## 最高铁律
1. **最短实现**:就是「调 Doc2X + 并行调两次 LLM + 落库」,别加多余东西。
2. 严格遵守契约字段命名与状态机,复用 BE0 的 `schemas`/`models`/`llm`/`render`,**不得另立** schema。
3. 提示词文件已由 BE0 落地,你只管渲染调用,不改提示词正文。

## 你拥有/创建的文件
```
backend/app/
├── pdf.py                       # 你创建:Doc2X PDF → 文本
├── routers/resumes.py           # 你填充(BE0 已建空桩)
└── services/
    ├── __init__.py              # 你创建
    └── resume_service.py        # 你创建
```
不要改动其他模块的文件。

## 实现规格

### `pdf.py`
```python
async def pdf_to_text(file_bytes: bytes, filename: str) -> str
```
- 用 `pdfdeal` 的 Doc2X 客户端,`apikey=settings.doc2x_api_key`,把 PDF 转为文本/markdown 并返回。
- **请先确认 `pdfdeal` 当前版本的实际 API**(客户端类名、转换方法、入参是路径还是字节、返回结构)。必要时把字节写入临时文件再转换,结束后清理。
- 失败抛 `HTTPException(500, {"code":"pdf_failed","message":...})`。

### `services/resume_service.py`
- `async def parse_resume(resume_id: str) -> None`(后台任务,自开 `SessionLocal()`):
  1. 读 `resumes.raw_text`。
  2. 并行调用两次 LLM(`asyncio.gather`):
     - 摘要:`complete_json([{"role":"user","content": render("resume_summary", resume_text=raw_text)}])`
     - 项目:`complete_json([{"role":"user","content": render("resume_projects", resume_text=raw_text)}])`
  3. 写 `resumes.summary_json`;按返回的 `projects` 顺序建 `projects` 行(`order_index` 递增)。
  4. `resumes.status = "parsed"` 并 commit。
  5. 对**每个**新建 project,调用 BE2 的接缝(见下)开启首轮预处理。
  6. 任一步异常:`status="failed"`、记 `error`,commit。
- **接缝(BE1→BE2)**:对每个 project 调用
  ```python
  from app.services import interrogation_service   # 函数内延迟 import,避免 BE2 未就绪时的导入错误
  await interrogation_service.create_and_preprocess(project_id=p.id, round_number=1, prev_summary=None, model=None)
  ```
  该函数由 BE2 实现:创建 round=1 的 interrogation(status=preprocessing)、返回其 id、并在后台生成「初印象+首问」。**BE1 不直接创建 interrogation 行**。

### `routers/resumes.py`
在 BE0 的空桩里加两个端点(都依赖 `require_session`):

**POST `/api/resumes`**
- 同时支持两种请求:
  - `application/json`:`schemas.CreateResumeText`(`{text}`)→ `source="text"`,`raw_text=text`。
  - `multipart/form-data`:`file: UploadFile` → 校验扩展名/类型为 PDF(否则 400 `bad_file`),读字节 → `await pdf_to_text(...)` → `source="pdf"`。
  - 实现提示:可用 `Request` 判断 content-type 分流,或用 `file: UploadFile | None = File(None)` + `payload: ...`。保持简单。
- 文本为空或无文件 → 400 `empty_input`。
- 建 `resumes` 行(status=`parsing`,绑定 `session_id`),`asyncio.create_task(resume_service.parse_resume(resume_id))`(或 `BackgroundTasks`),返回 202 `CreateResumeResponse`(`{resume_id}`)。

**GET `/api/resumes/{resume_id}`**
- 按 `session_id` 校验归属(不属于当前会话 → 404)。
- 组装并返回 `schemas.ResumeDetail`:含 `status`、`summary`(由 `summary_json` 还原)、`projects`(每个含 `current_interrogation`=该项目最新 interrogation 的 `{id,status}`,无则 null)、`error`。
- `parsing` 时 `summary=null`、`projects=[]`。

## 验收标准
- [ ] POST 文本简历 → 返回 `resume_id`,轮询 GET 最终 `status=parsed`,`summary` 与 `projects` 符合契约。
- [ ] POST PDF 简历 → Doc2X 转换成功后同样得到结构化结果。
- [ ] `parsed` 后,每个 project 的 `current_interrogation` 不为 null(说明已触发 BE2 预处理;若 BE2 尚未交付,允许此项在集成阶段验证)。
- [ ] 两次 LLM 调用确为并行(`asyncio.gather`)。
- [ ] 异常路径:LLM/PDF 失败时 `status=failed` 且 `error` 有值,接口不 500 崩溃。
- [ ] 未改动 BE0 与其他模块文件;未新增契约外字段。

## 不要做
- 不二次总结/改写项目原文(`raw_description` 保留简历原句)。
- 不在摘要里塞项目细节或技能清单(提示词已约束,你别加后处理)。
- 不实现拷问/指南逻辑;不创建 interrogation 行(交给 BE2 接缝)。
