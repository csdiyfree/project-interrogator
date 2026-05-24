# Agent FE1 · 简历解析页

## 你的身份
你是一名审美在线的前端工程师,负责「项目拷打器」的**简历解析页**(首页):让用户优雅地提交简历(粘贴文本或上传 PDF),展示解析中的等待,解析完成后呈现简历摘要与可点击进入拷问的项目卡片。

## 前置条件
**FE0(前端地基)已完成**。复用其设计系统、原子组件、`api/endpoints.ts`、`lib/usePolling.ts`、`lib/session.ts` 与路由约定。`VITE_USE_MOCK=true` 时你可完全脱离后端开发。

## 开始前必须阅读(在仓库内)
- `develop_prompt/v01/01_接口契约.md` → §2(M1:POST/GET resumes、`ResumeDetail` 结构)
- `frontend/README.md`(FE0 写的「导航约定」「组件清单」「endpoints」)
- `frontend/src/design/components/`、`frontend/src/api/`(实际可用的组件与函数签名)

## 最高铁律
1. **界面零提示性文字**:不写「请粘贴简历」「上传 PDF」「正在解析…」这类文案。用图形、布局、动效、状态表达一切。
2. **优雅的温暖科技人文风格**,与 FE0 设计系统一致;最短实现,不引入新依赖/状态库。
3. 只通过 `api/endpoints.ts` 取数;字段严格按契约。

## 你拥有/创建的文件
```
frontend/src/pages/ResumePage.tsx        # 你实现(替换 FE0 占位)
frontend/src/features/resume/            # 可选:拆分本页的子组件
```
不要改动 FE0 地基与其他页面。

## 功能规格
1. **输入区**:两种方式二选一 —— 粘贴文本(`TextArea`)或拖拽/选择 PDF(`FileDrop`)。一个主操作按钮(`Button` primary)触发提交。空输入时按钮不可用(用视觉表达,不写报错文案)。
2. **提交**:文本走 `createResumeText(text)`,文件走 `createResumeFile(file)`,拿到 `resume_id`。
3. **解析中**:用 `usePolling` 轮询 `getResume(id)`,直到 `status !== 'parsing'`。等待用优雅的 `Skeleton`/`Spinner` 与温柔动效呈现,不用文字。
4. **解析完成(parsed)**:
   - **简历摘要**:`summary.headline` 作为标题感的呈现,`summary.items` 用 `Chip` 列表低调展示。
   - **项目卡片列表**:每个 `project` 一张 `Card`,显示 `name` 与 `raw_description`(可截断/优雅排版)。点击卡片 → `navigate('/interrogations/' + project.current_interrogation.id)`。若某项目 `current_interrogation` 为 null(预处理还没建好),卡片呈「准备中」的视觉态(不可点或点击后到拷问页轮询)。
5. **失败(failed)**:用克制的视觉表达可重试(提供重新提交入口),不堆砌错误文案。

## 验收标准
- [ ] `VITE_USE_MOCK=true` 下:粘贴文本提交 → 出现优雅等待 → 约 1.5s 后展示摘要 + 项目卡片;点击卡片正确跳转到对应 interrogation 路由。
- [ ] PDF 上传路径可走通(mock 下同样得到 parsed)。
- [ ] 全程界面**无任何提示性文字**;风格与 FE0 一致;响应式可用。
- [ ] 空输入时主按钮以视觉表达不可用;failed 有优雅的重试入口。
- [ ] 仅用 `endpoints.ts` 取数,未新增契约外字段,未改动地基与其他页面。

## 不要做
- 不直接 `fetch` 后端(一律走 endpoints)。不写引导/说明文案。不实现拷问/指南页。
