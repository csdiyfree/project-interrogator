# Agent BE3 · 总结与改进指南模块(M3)

## 你的身份
你是一名 Python 后端工程师,负责「项目拷打器」的**改进指南模块**:在一轮拷问结束后,基于完整追问过程产出「红黄绿灯 + 可勾选 todo + 给下一轮的内部拷打摘要」,并支持 todo 勾选。

## 前置条件
**BE0(后端地基)已完成**。复用其共享代码。本模块由 BE2 在 interrogation 结束时触发(它已建好 `guide` 占位行 status=`generating` 并调用你的接缝 `generate_for`)。

## 开始前必须阅读(在仓库内)
- `develop_prompt/v01/01_接口契约.md` → §4(M3 接口)、§1 状态机、§6/§7 数据模型、§8
- `develop_prompt/v01/02_产品提示词附录.md` → 四(`guide` 提示词、`manuscript_history`/`qa_history`/`prev_summary_block` 拼接格式)
- `backend/app/README.md`、`schemas.py`、`llm.py`、`models.py`

## 最高铁律
1. **最短实现**:核心就是「拼历史→`complete_json`→落库 guide+todos」。
2. 严守契约:`GET guide` **不得**返回 `summary_for_next`(内部字段)。字段命名逐字一致。
3. 复用 BE0 的 `schemas`/`models`/`llm`/`render`;不改提示词正文。

## 你拥有/创建的文件
```
backend/app/
├── routers/guides.py            # 你填充(BE0 已建空桩)
└── services/guide_service.py    # 你创建
```
（不要改动其他模块文件。）

## `services/guide_service.py` 规格
```python
async def generate_for(interrogation_id: str) -> None:
    # 自开 SessionLocal();载入 interrogation + project + resume.summary_json
    #   + 该 interrogation 的全部 manuscript_entries(按 index)与 turns(按 index)。
    # 取出已存在的 guide 行(BE2 建的 generating 行);若不存在则创建一行。
    # 拼接:
    #   manuscript_history:按附录格式 —— 【初印象】... / 【第1轮】... / 【第2轮】...
    #   qa_history:Q1/A1、Q2/A2 ...(只含已回答的 turn)
    #   prev_summary_block:interrogation.prev_summary 为空→"";否则 "# 上一轮拷打回顾\n"+prev_summary
    # prompt = render("guide", resume_summary=<摘要文本>, project_name=..., project_description=...,
    #                 manuscript_history=..., qa_history=..., prev_summary_block=...)
    # data = await complete_json([{role:"user", content:prompt}], model=interrogation.model)
    # 写 guide:traffic_light, overview, summary_for_next, status="ready"。
    # 按 data["todos"] 顺序建 todos 行(category 校验在 resume_fix/knowledge_prep/other 内,order_index 递增)。
    # commit。异常 → guide.status="failed", error。
```

## 端点(写在 `routers/guides.py`,均依赖 `require_session` 并校验归属)

**GET `/api/interrogations/{interrogation_id}/guide`**
- 取该 interrogation 的 guide 行;不存在 → 404 `guide_not_found`。
- 返回 `schemas.GuideDetail`:`status / traffic_light / overview / todos[] / error`,**不含 `summary_for_next`**。
- `generating` 时 `traffic_light=overview=null`、`todos=[]`。

**PATCH `/api/todos/{todo_id}`**
- body `schemas.TodoUpdate`(`{done: bool}`)。
- 归属校验:todo → guide → interrogation → project → resume.session_id 必须等于当前会话。
- 更新 `done`,返回更新后的 `schemas.TodoOut`。

## 验收标准
- [ ] interrogation 结束后(BE2 触发),`GET .../guide` 由 `generating` 轮询到 `ready`,返回红黄绿灯、overview、合理分类且具体可执行的 todos。
- [ ] 响应中**绝不**出现 `summary_for_next`;但 DB 里该字段有值(供 BE2 再次拷打读取)。
- [ ] interrogation 未结束时 `GET .../guide` 返回 404 `guide_not_found`。
- [ ] `PATCH todo` 能正确切换 `done` 并做归属校验。
- [ ] 未改 BE0 与其他模块文件;无契约外字段。

## 不要做
- 不实现解析/拷问逻辑;不自行触发生成(由 BE2 调用 `generate_for`)。
- 不输出泛泛建议(提示词已要求具体可执行,你别加无意义后处理)。
- 不引入重试/队列;`failed` 即据实返回。
