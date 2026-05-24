# Agent BE2 · 拷问与面试官手稿模块(M2)

## 你的身份
你是一名擅长流式接口的 Python 后端工程师,负责「项目拷打器」最核心的**拷问模块**:预处理生成「初印象+首问」、以 SSE 流式驱动一问一答、实时产出面试官手稿、由模型判定结束、并支持「再次拷打」。

## 前置条件
**BE0(后端地基)已完成**。复用其共享代码,不重复造轮子。

## 开始前必须阅读(在仓库内)
- `develop_prompt/v01/01_接口契约.md` → §3(M2 接口)、**§5(SSE 协议 + 5.1 分段格式)**、§1 状态机、§6/§7 数据模型、§8
- `develop_prompt/v01/02_产品提示词附录.md` → 三(`interrogation` 提示词、`{{prev_summary_block}}` 规则、预处理/对话轮的 user 消息、**消息构造说明**)
- `backend/app/README.md` 的「给后续模块的接口」、`schemas.py`、`llm.py`、`models.py`

## 最高铁律
1. **最短实现**:核心就是「拼消息→调 LLM→解析分段→落库/推流」。别加多余抽象。
2. 严格实现契约 §5 的 SSE 事件与 §5.1 的分段格式解析,字段命名逐字一致。
3. 不改提示词正文;复用 BE0 的 `schemas`/`models`/`llm`/`render`。

## 你拥有/创建的文件
```
backend/app/
├── routers/interrogations.py        # 你填充(BE0 已建空桩)
└── services/interrogation_service.py # 你创建
```
（若 `services/__init__.py` 不存在则创建;不要改动其他模块文件。）

## 端点(都写在 `routers/interrogations.py`,均依赖 `require_session` 并校验数据归属)

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/interrogations/{id}` | 返回 `schemas.InterrogationDetail`(见契约 §3) |
| POST | `/api/interrogations/{id}/answer` | **SSE**;body `schemas.AnswerRequest` |
| GET | `/api/projects/{project_id}` | 返回 `schemas.ProjectDetail`(含倒序 `interrogations` 列表) |
| POST | `/api/projects/{project_id}/reinterrogate` | body `schemas.ReinterrogateRequest`;返回 202 `ReinterrogateResponse` |
| GET | `/api/models` | 返回 `{models: AVAILABLE_MODELS, default: DEFAULT_MODEL}` |

- `GET /api/projects/{id}`:`interrogations` 每项 `has_guide` = 是否存在对应 guide 行(任意状态)。
- `POST /reinterrogate`:`round_number = 现有最大+1`;`prev_summary = 该项目最近一轮 ready 指南的 summary_for_next`(无则 null);`model` 取 body 或默认;调用 `create_and_preprocess(...)` 返回新 id。

## `services/interrogation_service.py` 规格

> **会话约定**:本服务的后台/流式函数都**自开 `SessionLocal()`** 并负责关闭(它们运行于请求生命周期之外)。

### 接缝函数(供 BE1 与 reinterrogate 调用)
```python
async def create_and_preprocess(project_id: str, round_number: int,
                                prev_summary: str | None, model: str | None) -> str:
    # 1) 建 interrogation 行:status="preprocessing", ended=False,
    #    model = model or DEFAULT_MODEL, prev_summary 原样存。commit。
    # 2) asyncio.create_task(_run_preprocess(interrogation_id))
    # 3) return interrogation_id
```

### 预处理(非流式)
```python
async def _run_preprocess(interrogation_id: str) -> None:
    # 自开 session;载入 interrogation + project + resume.summary_json。
    # system = render("interrogation", resume_summary=<摘要文本>, project_name=...,
    #                 project_description=..., prev_summary_block=<见下>)
    # messages = [system, {role:"user", content:<附录:预处理 user 指令>}]
    # text = await chat(messages, model)；parse_segments(text) → (manuscript, ended, question)
    # 写 manuscript_entries(index=0, kind="first_impression", content=manuscript)
    # 写 turns(index=0, question=question, answer=None)
    # status="ready"；commit。异常 → status="failed", error。
```

### 流式回答(SSE 的数据源)
```python
async def stream_answer(interrogation_id: str, turn_index: int, answer: str) -> AsyncIterator[str]:
    # 自开 session。
    # 校验:interrogation.status in {"ready","in_progress"} 否则抛 409 not_answerable;
    #       turn_index == 最后一个未回答 turn 的 index,否则抛 409 turn_conflict。
    # 落库:turns[turn_index].answer = answer；interrogation.status="in_progress"；commit。
    # 构造 messages(见「消息构造」)。
    # async for chunk in stream_chat(messages, model): 喂给流式分段解析器,产出 SSE 字符串:
    #     - 手稿段增量 → event: manuscript_delta  data:{"text": "..."}
    #     - 结束=false 的问题段增量 → event: question_delta
    #     - 结束=true 的问题段增量 → event: closing_delta
    # 流结束后落库:
    #     mi = turn_index + 1
    #     若 ended:
    #         manuscript_entries(index=mi, kind="closing", content=manuscript)
    #         interrogation.ended=True, status="ended", closing_message=question_text
    #         建 guide 行(status="generating") + asyncio.create_task(guide_service.generate_for(interrogation_id))  # 接缝 BE2→BE3,延迟 import
    #         yield done {"ended":true,"manuscript_index":mi,"next_turn_index":null}
    #     否则:
    #         manuscript_entries(index=mi, kind="reaction", content=manuscript)
    #         turns(index=mi, question=question_text, answer=None)
    #         yield done {"ended":false,"manuscript_index":mi,"next_turn_index":mi}
    #     commit。异常 → yield event: error,并尽量回滚到可用状态。
```
SSE 格式助手:`def sse(event, data) -> str: return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"`。
路由里:`return StreamingResponse(stream_answer(...), media_type="text/event-stream")`,并设 `Cache-Control: no-cache`。

### 消息构造(对话轮)
```
messages = [ {system: 渲染后的 interrogation 提示词},
             {user: 附录的「预处理 user 指令」},
             {assistant: rebuild(manuscript[0], ended=False, question=turns[0].question)},
             {user: turns[0].answer},
             {assistant: rebuild(manuscript[1], False, turns[1].question)},
             {user: turns[1].answer},
             ...
             {user: <本次提交的 answer(即 turns[turn_index].answer)> } ]
```
- `rebuild(m, ended, q) = f"[手稿]\n{m}\n[结束]\n{'true' if ended else 'false'}\n[问题]\n{q}"`(用已存字段重建模型历史输出)。
- 只纳入已回答的 turn 及其对应 assistant 历史;最后一条 user 是本次回答。

### `prev_summary_block` 与摘要文本
- `prev_summary_block`:`interrogation.prev_summary` 为空 → `""`;否则
  `"# 上一轮拷打回顾(供你参考,避免重复、可针对薄弱处加深)\n" + prev_summary`。
- 摘要文本:把 `resume.summary_json` 拼成短文本,如 `headline` 一行 + 各 `items` 的 `label: value` 行。

### 分段解析器
```python
def parse_segments(text: str) -> tuple[str, bool, str]:
    # 解析固定结构 [手稿]\n...\n[结束]\n(true|false)\n[问题]\n...  → (manuscript, ended, question)
```
**流式版**:实现一个增量解析器,逐 chunk 追加到缓冲并按当前段产出增量。要点:
- 段标记 `[手稿]` `[结束]` `[问题]` 各独占一行、各出现一次、顺序固定。
- 为避免把跨 chunk 的半个标记当正文吐出,**对每段尾部保留若干字符**(如 8 个)不发,待确认非标记或流结束再补发。
- 读到 `[结束]` 后解析布尔再决定问题段走 `question_delta` 还是 `closing_delta`。
- 模型基本会守格式(提示词已强约束);做最小兜底即可,不要写复杂容错。

## 验收标准
- [ ] 解析完成后(BE1 触发或手动调用)`create_and_preprocess` 能让 interrogation 走到 `ready`,`GET interrogation` 返回初印象手稿 + 首问。
- [ ] `POST .../answer` 返回 `text/event-stream`;事件序列符合契约 §5(未结束:manuscript_delta→question_delta→done;结束:manuscript_delta→closing_delta→done)。
- [ ] 多轮问答可持续进行;模型给出 `[结束]true` 时 interrogation 置 `ended`、`closing_message` 落库,并触发 guide 生成(BE3 就绪时端到端可见)。
- [ ] `reinterrogate` 新建一轮且带入上一轮 `summary_for_next`;旧轮次数据保留;`GET project` 倒序列出全部轮次。
- [ ] `turn_conflict` / `not_answerable` / 归属校验 正确返回 409/404。
- [ ] 未改 BE0 与其他模块文件;无契约外字段。

## 不要做
- 不实现简历解析、不实现指南生成(只在结束时建 guide 占位行并调用 BE3 接缝)。
- 不改提示词正文、不引入重试/队列。
- 不把 `summary_for_next` 暴露到任何 M2 响应。
