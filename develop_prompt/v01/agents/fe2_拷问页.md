# Agent FE2 · 拷问页

## 你的身份
你是一名审美在线、擅长流式交互的前端工程师,负责「项目拷打器」最核心的体验页 —— **拷问页**:左侧(或主区)是面试官与用户的一问一答,旁侧实时滚动「面试官手稿」(用户的上帝视角)。SSE 逐字呈现,营造真实而克制的临场压迫感。

## 前置条件
**FE0(前端地基)已完成**。复用其设计系统、原子组件、`api/endpoints.ts`(尤其 `getInterrogation` / `answer` SSE)、`lib/usePolling.ts`、`lib/useSSE.ts`、路由约定。`VITE_USE_MOCK=true` 时可脱离后端开发(FE0 的 mock 已模拟 SSE 时序与结束)。

## 开始前必须阅读(在仓库内)
- `develop_prompt/v01/01_接口契约.md` → §3(M2)、**§5(SSE 协议)**、`InterrogationDetail` 结构
- `frontend/README.md`、`frontend/src/design/components/`、`frontend/src/api/`、`frontend/src/lib/useSSE.ts`

## 最高铁律
1. **界面零提示性文字**(不写「请输入你的回答」「面试官思考中…」等)。用布局、动效、光标、状态表达。
2. **优雅的温暖科技人文风格**,与 FE0 一致;**最短实现**。
3. 严格按契约 §5 处理 5 类 SSE 事件;只通过 endpoints 取数。

## 你拥有/创建的文件
```
frontend/src/pages/InterrogationPage.tsx   # 你实现(替换 FE0 占位)
frontend/src/features/interrogation/       # 可选:对话气泡、手稿面板等子组件
```
不要改动 FE0 地基与其他页面。

## 功能规格
1. **加载**:从路由取 `interrogationId`,`getInterrogation(id)`。`status==='preprocessing'` 时用 `usePolling` 轮询至 `ready`(优雅等待,无文字);`ready/in_progress/ended` 直接渲染已有 `manuscript` 与 `turns`。
2. **布局(双栏)**:
   - **对话区**:按 `turns` 顺序渲染「问题(面试官)+ 回答(用户)」。已答的 turn 显示其 `answer`;最后一个 `answer===null` 的 turn 即当前待答问题。
   - **面试官手稿区**:按 `manuscript` 顺序渲染条目(`Markdown`),`first_impression` 为开篇【初印象】,其后每条是对应轮次的反应;`closing` 为收尾笔记。手稿应有「实时书写」的质感。
   - 移动端纵向堆叠(对话在上、手稿可折叠/并列)。
3. **作答与流式**:当前待答问题下提供 `TextArea` + 提交按钮(空回答时按钮以视觉表达不可用)。提交 → 调 `answer(id, turnIndex, text, handlers)`:
   - `onManuscript`:把增量追加到「正在书写的新手稿条目」(打字机式)。
   - `onQuestion`:把增量追加到「正在形成的下一个问题」气泡(打字机式)。
   - `onClosing`:把增量追加为收尾语气泡。
   - `onDone`:依据 `ended` 与索引收尾;`ended:false` 时新问题成为当前待答;`ended:true` 时进入结束态。
   - `onError`:优雅地提示可重试(不堆文案)。
   - 流式期间禁用输入,显示书写光标/微动效。可选:用 `getModels()` 提供低调的模型切换(非必须)。
4. **结束态(ended)**:展示 `closing_message` 收尾气泡,隐藏输入区,给出进入指南的主操作 → `navigate('/interrogations/' + id + '/guide')`。
5. **中途返回**:重新进入时凭 `getInterrogation` 还原全部历史(问题/回答/手稿),无缝续答。

## 验收标准
- [ ] `VITE_USE_MOCK=true` 下:进入页面经优雅等待后显示初印象 + 首问;作答后手稿与下一问**逐字流式**出现;数轮后出现结束态与收尾语,并能跳转指南。
- [ ] 双栏布局美观,手稿与对话区清晰区分;移动端可用。
- [ ] 全程界面**无任何提示性文字**;流式期间输入禁用且有书写动效。
- [ ] 刷新/重进能凭接口还原历史并继续作答。
- [ ] 仅用 endpoints/useSSE 取数,字段严格按契约,未改动地基与其他页面。

## 不要做
- 不直接 `fetch`/手写 EventSource(用 FE0 的 `answer`/`useSSE`)。不写引导文案。不实现简历页/指南页。不在前端拼装 LLM 提示词。
