# 项目拷打器 · 前端

React 18 + TypeScript + Vite + TailwindCSS。UI 全中文。**界面零提示性文字**——让设计说话。

本目录是 FE0(前端地基)的产物:设计系统、API 客户端(含 SSE)、mock 层、路由与全局布局。
FE1/FE2/FE3 三个页面在此之上开发,只替换 `src/pages/` 下对应文件,**不改动地基**。

## 启动

```bash
npm install
cp .env.example .env     # VITE_USE_MOCK=true 时可完全脱离后端开发
npm run dev              # http://localhost:5173
```

- `VITE_USE_MOCK=true`:所有 endpoints 走 `src/mocks/`,模拟真实时序(解析/预处理/流式/指南生成)。
- `VITE_USE_MOCK=false`:走真实后端 `VITE_API_BASE`,自动注入 `X-Session-Id`。

## 目录

```
src/
├── api/         types.ts(契约类型) client.ts(fetch + SSE 解析) endpoints.ts(每接口一函数)
├── mocks/       fixtures.ts(高质量假数据) handlers.ts(有状态时序模拟)
├── design/      theme.css(设计 token) components/(原子组件)
├── lib/         session.ts usePolling.ts useSSE.ts
└── pages/       ResumePage(FE1) InterrogationPage(FE2) GuidePage(FE3) —— 当前为占位
```

## 设计系统

色板/圆角/阴影/字体在 `design/theme.css`(CSS 变量)并映射到 Tailwind(见 `tailwind.config.ts`)。

- 颜色类:`bg-bg` `bg-surface` `border-line` `text-ink` `text-ink-soft` `text-accent` `text-accent-2`
  `text-green` `text-amber` `text-red`(及对应 `bg-*`)。
- 圆角:`rounded-sm|md|lg`(10/16/22px)。阴影:`shadow-soft` `shadow-soft-lg`。
- 字体:`font-serif`(标题,Fraunces + Noto Serif SC)`font-sans`(正文,Inter + Noto Sans SC)。
- 动效:`animate-fade-up` `animate-fade-in` `animate-blink`(打字光标)`animate-breathe` `animate-shimmer`。

### 原子组件(`design/components`,纯 props 驱动,无内置文案)

| 组件 | 用途 / 关键 props |
|---|---|
| `Button` | `variant: 'primary' \| 'ghost'`、`loading` |
| `Card` | `interactive`(悬浮上移投影);其余同 div |
| `TrafficLight` | `value: 'red' \| 'yellow' \| 'green'`、`size` |
| `Markdown` | `children: string`(套 `.md` 排版;手稿与指南用) |
| `Spinner` / `Skeleton` | 加载态,优雅非文字 |
| `TextArea` | 同 textarea(已隐藏 placeholder);`forwardRef` |
| `FileDrop` | `file`、`onFile(file)`、`accept`;图形+状态表达,文件名可显示 |
| `Chip` | `label?`、`children`;摘要 item 等 |

引入:`import { Button, Card, TrafficLight } from '../design/components';`

## API(`api/endpoints.ts`)

页面**只**用这些函数取数,不直接 `fetch`。

| 函数 | 返回 |
|---|---|
| `createResumeText(text)` / `createResumeFile(file)` | `{ resume_id }` |
| `getResume(id)` | `ResumeDetail`(轮询至 `status !== 'parsing'`) |
| `getProject(id)` | `ProjectDetail`(含多轮 `interrogations`) |
| `getInterrogation(id)` | `InterrogationDetail`(轮询 `preprocessing` 至 `ready`) |
| `answer(id, turnIndex, text, handlers)` | SSE 流式,见下 |
| `reinterrogate(projectId, model?)` | `{ interrogation_id }` |
| `getModels()` | `{ models, default }` |
| `getGuide(interrogationId)` | `GuideDetail`(轮询 `generating` 至 `ready`) |
| `patchTodo(todoId, done)` | 更新后的 `Todo` |

类型全部在 `api/types.ts`,与契约逐字一致。错误为 `ApiRequestError`(带 `.code` `.message`)。

### 轮询:`usePolling`

```ts
const { data, error } = usePolling(() => getResume(id), {
  interval: 1200,
  stopWhen: (r) => r.status !== 'parsing',
  resetKey: id,            // 路由 id 变化时重新拉取
});
```

### SSE:`answer` + `useSSE`

直接用 `answer(id, turnIndex, text, { onManuscript, onQuestion, onClosing, onDone, onError })`,
或用 `useSSE()`(累积文本缓冲,便于打字机渲染):

```ts
const sse = useSSE();
sse.submit(id, turnIndex, text);
// sse.streaming / sse.manuscript / sse.question / sse.closing / sse.done / sse.error
```

事件语义(契约 §5):未结束轮 `manuscript_delta×N → question_delta×N → done{ended:false}`;
结束轮 `manuscript_delta×N → closing_delta×N → done{ended:true, next_turn_index:null}`。
回答 `turn[i]` 后,新手稿条目 index 与下一问 turn index 均为 `i+1`。

## 路由与导航约定

| 路由 | 页面 |
|---|---|
| `/` | `ResumePage`(FE1) |
| `/interrogations/:interrogationId` | `InterrogationPage`(FE2) |
| `/interrogations/:interrogationId/guide` | `GuidePage`(FE3) |

- 简历页点击项目卡 → `navigate('/interrogations/' + project.current_interrogation.id)`。
- 拷问结束 → `navigate('/interrogations/' + id + '/guide')`。
- 指南页「再次拷打」→ `reinterrogate(projectId)` 得到 `interrogation_id` → `navigate('/interrogations/' + newId)`。
- 指南页历史切换 → `navigate('/interrogations/' + thatId + '/guide')`(只列 `has_guide` 为真的轮次)。

## Mock 深链(`VITE_USE_MOCK=true` 时恒存,便于单页调试)

刷新不丢(每次加载按固定 id 重建种子);通过 FE1 表单新建的简历为内存态,刷新即重置。

| 用途 | 路径 |
|---|---|
| 简历页(种子简历) | `/`(直接提交任意文本/PDF 即走 parsing→parsed) |
| FE2 实时流式 + 多轮直至结束 | `/interrogations/seed-it-seg` |
| FE2 另一可作答轮 | `/interrogations/seed-it-ret` |
| FE2 已结束态(含结束语) | `/interrogations/seed-it-ano-2` |
| FE3 指南 + 多轮历史切换 | `/interrogations/seed-it-ano-2/guide`(可切到 round 1) |
| FE3 generating→ready 体验 | 把 `seed-it-seg` 答到结束后访问其 `/guide` |

种子时序:简历解析 ~1.5s、拷问预处理 ~1.8s、指南生成 ~2s。

## 铁律

1. 界面不写任何提示/引导/说明文案。2. 风格:优雅的温暖科技人文。
3. 最短实现:不引状态管理库 / UI 组件库。4. 只经 `endpoints.ts` 与后端交互;字段严格按契约;
不展示 `summary_for_next`(后端本就不返回)。
