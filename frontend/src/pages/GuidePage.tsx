import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Skeleton, TrafficLight } from '../design/components';
import { usePolling } from '../lib/usePolling';
import {
  getGuide,
  getInterrogation,
  getProject,
  patchTodo,
  reinterrogate,
} from '../api/endpoints';
import type { ProjectDetail, Todo, TodoCategory } from '../api/types';

/* ── 类别视觉:仅以图标 + 色彩区分,不堆叠标题文案 ── */
const CATEGORY_ORDER: TodoCategory[] = ['resume_fix', 'knowledge_prep', 'other'];
const CATEGORY_COLOR: Record<TodoCategory, string> = {
  resume_fix: 'var(--accent)',
  knowledge_prep: 'var(--accent-2)',
  other: 'var(--amber)',
};

function CategoryIcon({ category, size = 18 }: { category: TodoCategory; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (category === 'resume_fix') {
    // 改简历:铅笔
    return (
      <svg {...common} aria-hidden>
        <path d="M16.5 4.5l3 3L8 19l-4 1 1-4 11.5-11.5z" />
      </svg>
    );
  }
  if (category === 'knowledge_prep') {
    // 知识准备:摊开的书
    return (
      <svg {...common} aria-hidden>
        <path d="M12 6.5C10.4 5.4 8.2 4.9 6 4.9c-.6 0-1 .3-1 .8v11c0 .5.4.8 1 .8 2.2 0 4.4.5 6 1.6" />
        <path d="M12 6.5c1.6-1.1 3.8-1.6 6-1.6.6 0 1 .3 1 .8v11c0 .5-.4.8-1 .8-2.2 0-4.4.5-6 1.6" />
        <path d="M12 6.5v12.5" />
      </svg>
    );
  }
  // 其它复盘:星芒
  return (
    <svg {...common} aria-hidden>
      <path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z" />
      <path d="M18.5 16v3M20 17.5h-3" />
    </svg>
  );
}

/** 替代「再次拷打」文案:循环双箭头,以图形表达「再来一轮」。 */
function ReplayIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3.5 12a8.5 8.5 0 0 1 14.4-6.1" />
      <path d="M18.5 2.5V6H15" />
      <path d="M20.5 12a8.5 8.5 0 0 1-14.4 6.1" />
      <path d="M5.5 21.5V18H9" />
    </svg>
  );
}

/** 生成中的三灯占位:与 TrafficLight 同形,呼吸渐入,过渡无缝、无文字。 */
function WaitingLights() {
  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-line bg-ink/[0.03] px-3.5 py-2.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="animate-breathe rounded-full bg-ink/15"
          style={{ width: 15, height: 15, animationDelay: `${i * 0.28}s` }}
        />
      ))}
    </div>
  );
}

function TodoRow({
  todo,
  color,
  onToggle,
}: {
  todo: Todo;
  color: string;
  onToggle: (t: Todo) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(todo)}
      aria-pressed={todo.done}
      className="group -mx-2 flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-black/[0.025]"
    >
      <span
        className={`mt-[3px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border transition-all duration-200 ${
          todo.done ? '' : 'border-line group-hover:border-ink-soft'
        }`}
        style={todo.done ? { background: color, borderColor: color } : undefined}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          className="transition-opacity duration-200"
          style={{ opacity: todo.done ? 1 : 0 }}
          aria-hidden
        >
          <path
            d="M5 12.5l4.2 4.2L19 7"
            stroke="#fff"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span
        className={`text-[0.95rem] leading-relaxed transition-all duration-200 ${
          todo.done ? 'text-ink-soft/60 line-through' : 'text-ink'
        }`}
      >
        {todo.content}
      </span>
    </button>
  );
}

export function GuidePage() {
  const { interrogationId } = useParams();
  const id = interrogationId ?? '';
  const navigate = useNavigate();

  const guide = usePolling(() => getGuide(id), {
    stopWhen: (g) => g.status !== 'generating',
    resetKey: id,
  });
  const ctx = usePolling<ProjectDetail>(
    async () => {
      const it = await getInterrogation(id);
      return getProject(it.project_id);
    },
    { stopWhen: () => true, resetKey: id },
  );

  const g = guide.data;
  const project = ctx.data;

  const [todos, setTodos] = useState<Todo[]>([]);
  useEffect(() => {
    if (g?.status === 'ready') setTodos(g.todos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g?.id, g?.status]);

  const [reloading, setReloading] = useState(false);

  const ready = g?.status === 'ready';
  const failed = g?.status === 'failed' || !!guide.error;
  const waiting = !ready && !failed;

  const guided = project ? project.interrogations.filter((it) => it.has_guide) : [];

  const onToggle = async (todo: Todo) => {
    const next = !todo.done;
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, done: next } : t)));
    try {
      const updated = await patchTodo(todo.id, next);
      setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, done: !next } : t)));
    }
  };

  const onReinterrogate = async () => {
    if (!project) return;
    setReloading(true);
    try {
      const res = await reinterrogate(project.id);
      navigate(`/interrogations/${res.interrogation_id}`);
    } catch {
      setReloading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl animate-fade-in space-y-8">
      {project && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-serif text-xl text-ink">{project.name}</h1>
          {guided.length >= 2 && (
            <div className="flex items-center gap-2">
              {guided.map((it) => {
                const active = it.id === id;
                return (
                  <button
                    key={it.id}
                    type="button"
                    disabled={active}
                    onClick={() => navigate(`/interrogations/${it.id}/guide`)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-all duration-200 ${
                      active
                        ? 'bg-accent text-white shadow-soft'
                        : 'border border-line bg-surface text-ink-soft hover:-translate-y-0.5 hover:text-ink hover:shadow-soft'
                    }`}
                  >
                    {it.round_number}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {waiting && (
        <div className="space-y-8">
          <Card className="p-6 sm:p-8">
            <WaitingLights />
            <div className="mt-6 space-y-3">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          </Card>
          <Card className="space-y-6 p-6 sm:p-8">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-4 sm:gap-5">
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {failed && (
        <div className="flex min-h-[40vh] items-center justify-center py-10">
          <div
            className="animate-breathe flex h-20 w-20 items-center justify-center rounded-[26px] border border-line bg-surface shadow-soft"
            style={{ color: 'var(--red)' }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" />
              <path d="M12 7.5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="12" cy="16.2" r="1" fill="currentColor" />
            </svg>
          </div>
        </div>
      )}

      {ready && g && (
        <>
          <Card className="animate-fade-up p-6 sm:p-8">
            <TrafficLight value={g.traffic_light!} size={17} />
            <p className="mt-5 font-serif text-lg leading-relaxed text-ink sm:text-xl">
              {g.overview}
            </p>
          </Card>

          <Card className="animate-fade-up space-y-7 p-6 sm:p-8" style={{ animationDelay: '0.05s' }}>
            {CATEGORY_ORDER.map((cat) => {
              const items = todos.filter((t) => t.category === cat);
              if (items.length === 0) return null;
              const color = CATEGORY_COLOR[cat];
              return (
                <div key={cat} className="flex gap-4 sm:gap-5">
                  <div
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
                  >
                    <CategoryIcon category={cat} />
                  </div>
                  <div className="flex-1 space-y-1">
                    {items.map((t) => (
                      <TodoRow key={t.id} todo={t} color={color} onToggle={onToggle} />
                    ))}
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      )}

      {project && (ready || failed) && (
        <div className="flex justify-center pt-2">
          <Button
            onClick={onReinterrogate}
            loading={reloading}
            className="!rounded-full !px-7 !py-3 text-[0.95rem]"
          >
            {!reloading && <ReplayIcon size={18} />}
            <span>再次拷打</span>
          </Button>
        </div>
      )}
    </div>
  );
}
