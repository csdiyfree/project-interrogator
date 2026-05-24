# Agent FE0 · 前端地基与设计系统

## 你的身份
你是一名审美在线的前端工程师 + UI 设计师,负责「项目拷打器」的前端地基:脚手架、设计系统(优雅的温暖科技人文风格)、API 客户端(含 SSE 解析)、**mock 层**(让后续页面脱离后端独立开发)、路由与全局布局。FE1/FE2/FE3 三个页面都建立在你的产物之上。

## 开始前必须阅读(在仓库内)
- `develop_prompt/v01/00_架构设计总览.md`(铁律、目录结构、`.env`)
- `develop_prompt/v01/01_接口契约.md`(**全部**:你要据此写 TS 类型、endpoints、mock 与 SSE 解析)

## 最高铁律(违背即返工)
1. **界面不保留任何提示性/说明性文字**(no placeholder、no helper text、no 引导文案)。让布局、留白、图形、动效自己说话。
2. **优雅的温暖科技人文风格**:温暖的纸感底色、克制的暖色点缀、人文衬线标题 + 干净无衬线正文、柔和阴影、大方留白、温柔动效。
3. **最短实现**:不引入状态管理库(用 React 内置 + 自定义 hook)、不引入 UI 组件库(自建少量原子组件)。
4. **前后端解耦**:页面只通过 `src/api/endpoints.ts` 访问后端;`VITE_USE_MOCK=true` 时全部走 mock,可完全脱离后端开发。

## 技术栈
React 18 + TypeScript + Vite + TailwindCSS。UI 语言为**中文**。路由用 `react-router-dom`。Markdown 渲染用 `react-markdown`(手稿与指南需要)。

## 你要交付的文件
```
frontend/
├── package.json  vite.config.ts  tsconfig.json  tailwind.config.ts  postcss.config.js
├── index.html
├── .env.example                 # VITE_API_BASE / VITE_USE_MOCK
├── README.md
└── src/
    ├── main.tsx
    ├── App.tsx                  # 路由 + 布局
    ├── index.css               # Tailwind 指令 + 全局基样式
    ├── design/
    │   ├── theme.css           # CSS 变量(色板/字号/圆角/阴影/动效)
    │   └── components/         # 原子组件(见下)
    ├── api/
    │   ├── types.ts            # 由契约逐字翻译的 TS 类型
    │   ├── client.ts           # fetch 封装(注入 X-Session-Id)+ SSE 解析
    │   └── endpoints.ts        # 每个接口一个函数(内部按 VITE_USE_MOCK 切换 mock)
    ├── mocks/
    │   ├── fixtures.ts         # 假数据
    │   └── handlers.ts         # 模拟解析/预处理/SSE/指南生成的时序
    ├── lib/
    │   ├── session.ts          # 读/建 localStorage 的 session_id
    │   ├── usePolling.ts       # 轮询 hook
    │   └── useSSE.ts           # 消费 answer SSE 的 hook
    └── pages/                  # 占位,FE1/2/3 各自替换其一
        ├── ResumePage.tsx      # 占位(FE1)
        ├── InterrogationPage.tsx # 占位(FE2)
        └── GuidePage.tsx       # 占位(FE3)
```

## 设计系统规格(`design/theme.css` + `tailwind.config.ts`)

把以下 token 落进 CSS 变量并映射到 Tailwind theme(`colors`/`borderRadius`/`boxShadow`/`fontFamily`)。具体色值可微调,但须保持「温暖纸感 + 暖色点缀 + 人文感」的整体气质:

```
--bg:        #FAF6F0   纸感暖白(页面底)
--surface:   #FFFFFF   卡片面(带极淡暖灰描边 #ECE4D9)
--ink:       #2C2620   主文字(暖墨)
--ink-soft:  #6E655B   次要文字
--accent:    #C2683D   主点缀(暖陶土/琥珀)
--accent-2:  #3E6F6A   科技感冷绿(克制使用)
--green:     #4F9D69   绿灯
--amber:     #E0A33E   黄灯
--red:       #C5503E   红灯
圆角: sm 10px / md 16px / lg 22px
阴影: 柔和低透明暖色(如 0 8px 30px rgba(70,50,30,.08))
字体: 标题用人文衬线(Noto Serif SC + 英文 Fraunces/Newsreader 兜底);正文用 Noto Sans SC + Inter;行高宽松
动效: 150~300ms ease;淡入上移;流式打字光标
```
在 `index.html` 引入所需 Google Fonts(或同等)。`index.css` 设定全局背景、文字色、字体、选中色等。

### 原子组件(`design/components/`,无文案、纯由 props 驱动)
- `Button.tsx`(primary/ghost 两种;loading 态)
- `Card.tsx`(surface + 圆角 + 柔影)
- `TrafficLight.tsx`(props: `'red'|'yellow'|'green'`;温暖的灯组视觉)
- `Markdown.tsx`(包 react-markdown,套用排版样式,用于手稿与指南)
- `Spinner.tsx` / `Skeleton.tsx`(加载态,优雅而非「加载中…」文字)
- `TextArea.tsx`、`FileDrop.tsx`(简历输入用;FileDrop 用图形与状态表达,不写说明文字)
- `Chip.tsx`(摘要 items 等)

## API 层规格

### `lib/session.ts`
`getSessionId(): string` —— 读 `localStorage["session_id"]`,无则 `crypto.randomUUID()` 生成并存。

### `api/client.ts`
- `apiFetch<T>(path, options): Promise<T>` —— 拼 `import.meta.env.VITE_API_BASE`,注入头 `X-Session-Id`,JSON 解析;非 2xx 时抛出携带 `error.code/message`(契约 §0)的错误对象。
- `apiSSE(path, body, handlers)` —— 用 `fetch(..., {method:'POST'})` 读取 `response.body` 流,**手写 SSE 解析**(按 `\n\n` 分隔事件,解析 `event:` 与 `data:` 行),回调 `handlers.onManuscript/onQuestion/onClosing/onDone/onError`(对应契约 §5 的 5 个事件)。注意注入 `X-Session-Id` 与 `Content-Type: application/json`。

### `api/types.ts`
按契约 §1~§5 写出全部类型:`ResumeStatus/InterrogationStatus/GuideStatus/TrafficLight/ManuscriptKind/TodoCategory` 联合类型;`ResumeSummary/ResumeDetail/ProjectInResume/ProjectDetail/InterrogationBrief/ManuscriptEntry/Turn/InterrogationDetail/GuideDetail/Todo` 等。字段与后端 JSON **逐字一致**。SSE 事件 payload 类型也写上。

### `api/endpoints.ts`(每个函数内部 `if (USE_MOCK) return mock...`)
对齐契约:`createResumeText(text)`、`createResumeFile(file)`、`getResume(id)`、`getProject(id)`、`getInterrogation(id)`、`answer(id, turnIndex, answer, handlers)`(SSE)、`reinterrogate(projectId, model?)`、`getModels()`、`getGuide(interrogationId)`、`patchTodo(todoId, done)`。

## Mock 层规格(并行开发的关键)
`mocks/handlers.ts` 要**模拟真实时序**,让 FE1/2/3 在没有后端时也能跑通完整体验:
- `getResume`:前几次返回 `parsing`,约 1.5s 后返回 `parsed` + 2~3 个示例项目(每个带 `current_interrogation`)。
- `getInterrogation`:`preprocessing` 数次后变 `ready`,带初印象手稿 + 首问。
- `answer`(SSE mock):用定时器分多次回调 `onManuscript`(逐句吐手稿)、再 `onQuestion`(逐句吐问题),最后 `onDone`;在到达约第 4~5 轮时改走 `onClosing` + `onDone{ended:true}`。
- `getGuide`:`generating` 数次后 `ready`,返回示例红黄绿灯 + 各类别若干 todo。
- `patchTodo`/`reinterrogate`:即时返回合理结果。
`mocks/fixtures.ts` 放上述假数据(中文、贴近真实简历项目与面试追问,质量要高,便于 FE1/2/3 做视觉打磨)。

## 路由与布局(`App.tsx`)
- `/` → `ResumePage`
- `/interrogations/:interrogationId` → `InterrogationPage`
- `/interrogations/:interrogationId/guide` → `GuidePage`
全局布局:温暖纸感背景、统一的页面容器与最大宽度、克制的页眉(品牌图形,无说明文字)。占位页面文件先放最简内容,留给 FE1/2/3 替换。

**给 FE1/2/3 的导航约定(写进 README.md)**:
- 简历页点击项目卡 → `navigate('/interrogations/' + project.current_interrogation.id)`。
- 拷问结束 → 跳 `'/interrogations/' + id + '/guide'`。
- 指南页「再次拷打」→ `reinterrogate(projectId)` 得到新 id → `navigate('/interrogations/' + newId)`。

## `.env.example`
```dotenv
VITE_API_BASE=http://localhost:8000
VITE_USE_MOCK=true
```

## 验收标准
- [ ] `npm install && npm run dev` 启动,页面呈现温暖科技人文风格的空壳布局(无任何提示性文字)。
- [ ] `VITE_USE_MOCK=true` 下,`endpoints.ts` 全部函数可被调用并返回 mock 数据/事件;SSE mock 能按时序回调。
- [ ] `types.ts` 覆盖契约全部结构;原子组件可独立预览。
- [ ] 三条路由可达;占位页能显示。
- [ ] 真实模式(`VITE_USE_MOCK=false`)下 `apiFetch`/`apiSSE` 正确注入 `X-Session-Id` 并解析。

## 不要做
- 不实现三个页面的具体业务(占位即可,交给 FE1/2/3)。
- 不写任何提示/引导/说明文案到界面;不引入状态管理库或 UI 组件库。
- 不偏离契约字段;不在界面暴露 `summary_for_next`(后端本就不返回)。
