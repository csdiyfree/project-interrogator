// 拷问页:左对话(问答)/ 右面试官手稿(上帝视角),SSE 逐字流式。
// 加载与预处理优雅等待(无文案);作答后手稿与下一问同时书写;数轮后进入结束态。

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getInterrogation, getProject } from '../api/endpoints';
import { usePolling } from '../lib/usePolling';
import { useSSE } from '../lib/useSSE';
import type { InterrogationDetail, ProjectDetail } from '../api/types';
import { Chip, Skeleton, TextArea } from '../design/components';
import { ManuscriptColumn } from '../features/interrogation/ManuscriptColumn';
import { ProjectSwitcher } from '../features/interrogation/ProjectSwitcher';
import {
  AnswerBubble,
  ArrowLeftIcon,
  Caret,
  CaretDownIcon,
  InterviewerMark,
  QuestionBubble,
  ReportIcon,
  RetryIcon,
  SendIcon,
  TypingDots,
} from '../features/interrogation/parts';

export function InterrogationPage() {
  const { interrogationId } = useParams<{ interrogationId: string }>();
  const id = interrogationId!;
  const navigate = useNavigate();

  const [nonce, setNonce] = useState(0); // 失败重试时自增以重启轮询
  const [detail, setDetail] = useState<InterrogationDetail | null>(null);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [draft, setDraft] = useState('');
  const [manuscriptCollapsed, setManuscriptCollapsed] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const lastSubmit = useRef<{ turnIndex: number; text: string } | null>(null);

  const sse = useSSE();

  const polled = usePolling(() => getInterrogation(id), {
    stopWhen: (d) => d.status !== 'preprocessing',
    resetKey: `${id}:${nonce}`,
  });

  // 路由 / 重试切换:清空本地态,等待重新水合。
  useEffect(() => {
    setDetail(null);
    setDraft('');
    setDropOpen(false);
    lastSubmit.current = null;
    sse.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, nonce]);

  // 首次拿到非 preprocessing 详情即采纳为本地态;此后由 SSE 增量驱动,轮询已停。
  useEffect(() => {
    if (polled.data && polled.data.status !== 'preprocessing') {
      setDetail((prev) => prev ?? polled.data);
    }
  }, [polled.data]);

  // 取所属项目(用于顶部显示项目名);仅用 endpoints,契约未提供跨项目链接,故不做跨项目切换。
  useEffect(() => {
    const pid = detail?.project_id;
    if (!pid) {
      setProject(null);
      return;
    }
    let active = true;
    getProject(pid)
      .then((p) => active && setProject(p))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [detail?.project_id]);

  // SSE 收尾:把本轮手稿与下一问 / 结束语落入本地态。
  useEffect(() => {
    if (!sse.done) return;
    const d = sse.done;
    const manuscriptText = sse.manuscript;
    const questionText = sse.question;
    const closingText = sse.closing;
    setDetail((prev) => {
      if (!prev) return prev;
      const manuscript = [
        ...prev.manuscript,
        {
          index: d.manuscript_index,
          kind: d.ended ? ('closing' as const) : ('reaction' as const),
          content: manuscriptText,
          created_at: new Date().toISOString(),
        },
      ];
      if (d.ended) {
        return {
          ...prev,
          manuscript,
          ended: true,
          status: 'ended',
          closing_message: closingText,
        };
      }
      return {
        ...prev,
        manuscript,
        status: 'in_progress',
        turns: [
          ...prev.turns,
          {
            index: d.next_turn_index ?? prev.turns.length,
            question: questionText,
            answer: null,
            created_at: new Date().toISOString(),
          },
        ],
      };
    });
    sse.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sse.done]);

  // 自动滚动:滚动「对话列容器」到底(而非整页),保证最新问答与输入框常驻视口。
  // 桌面端容器内部滚动;移动端容器未溢出时回退为整页滚动。
  const convRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = convRef.current;
    if (!el) return;
    if (el.scrollHeight > el.clientHeight + 4) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    }
  }, [detail?.turns.length, detail?.ended, sse.streaming, sse.question, sse.closing, sse.error]);

  const lastTurn = detail?.turns[detail.turns.length - 1];
  const pendingTurn =
    detail && !detail.ended && lastTurn && lastTurn.answer === null ? lastTurn : null;

  const submit = () => {
    const text = draft.trim();
    if (!detail || !pendingTurn || !text || sse.streaming) return;
    const turnIndex = pendingTurn.index;
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            status: 'in_progress',
            turns: prev.turns.map((t) => (t.index === turnIndex ? { ...t, answer: text } : t)),
          }
        : prev,
    );
    lastSubmit.current = { turnIndex, text };
    setDraft('');
    sse.submit(detail.id, turnIndex, text);
  };

  const retry = () => {
    if (!detail || !lastSubmit.current) return;
    sse.reset();
    sse.submit(detail.id, lastSubmit.current.turnIndex, lastSubmit.current.text);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  // ── 失败态:优雅地可重试 ──
  if (polled.error || detail?.status === 'failed') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-7 animate-fade-in">
        <div className="opacity-40">
          <InterviewerMark size={48} />
        </div>
        <button
          onClick={() => setNonce((n) => n + 1)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink-soft shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:text-accent"
          aria-label="retry"
        >
          <RetryIcon />
        </button>
      </div>
    );
  }

  // ── 等待态:加载 / 预处理(无文案)──
  if (!detail) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-9 animate-fade-in">
        <div className="animate-breathe">
          <InterviewerMark size={60} />
        </div>
        <div className="w-full max-w-xs space-y-3">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      </div>
    );
  }

  const forming = !sse.error && (sse.streaming || !!sse.question || !!sse.closing);

  const gridCls = manuscriptCollapsed
    ? 'lg:grid-cols-[minmax(0,1fr)_1px_3rem]'
    : 'lg:grid-cols-[minmax(0,1.1fr)_1px_minmax(0,0.86fr)]';

  const navBtn =
    'flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition-all duration-200 enabled:hover:bg-black/[0.04] enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-30';

  // ── 主体:页眉 + 双栏(视口内粘附) ──
  return (
    <div className="flex animate-fade-up flex-col lg:h-[calc(100vh-12rem)]">
      <header className="mb-6 flex shrink-0 items-end justify-between gap-4 border-b border-line pb-5">
        <div className="relative min-w-0">
          <p className="mb-1.5 text-xs font-medium tracking-[0.18em] text-accent">项目拷问</p>
          <div className="flex items-center gap-2.5">
            {project ? (
              <button
                type="button"
                onClick={() => setDropOpen((o) => !o)}
                aria-label="switch-project"
                className="group flex min-w-0 items-center gap-1.5 text-ink transition-colors hover:text-accent"
              >
                <h1 className="truncate font-serif text-2xl sm:text-[1.7rem]">{project.name}</h1>
                <span className="text-ink-soft group-hover:text-accent">
                  <CaretDownIcon className={dropOpen ? 'rotate-180' : ''} />
                </span>
              </button>
            ) : (
              <Skeleton className="h-7 w-64 max-w-full" />
            )}
            <Chip className="shrink-0 whitespace-nowrap">{`第 ${detail.round_number} 轮`}</Chip>
          </div>

          {dropOpen && project && (
            <ProjectSwitcher
              resumeId={project.resume_id}
              currentProjectId={project.id}
              onClose={() => setDropOpen(false)}
              onPick={(iid) => {
                setDropOpen(false);
                navigate(`/interrogations/${iid}`);
              }}
            />
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => project && navigate(`/resume/${project.resume_id}`)}
            disabled={!project}
            aria-label="back-to-resume"
            className={navBtn}
          >
            <ArrowLeftIcon />
          </button>
          <button
            type="button"
            onClick={() => detail.ended && navigate(`/interrogations/${id}/guide`)}
            disabled={!detail.ended}
            aria-label="view-report"
            className={navBtn}
          >
            <ReportIcon />
          </button>
        </div>
      </header>

      <div className={`grid min-h-0 flex-1 grid-cols-1 gap-7 lg:gap-x-8 ${gridCls}`}>
        <section className="flex min-h-0 flex-col">
          <div ref={convRef} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pb-1 lg:pr-1">
            {detail.turns.map((t) => (
              <div key={t.index} className="flex flex-col gap-5">
                <QuestionBubble>{t.question}</QuestionBubble>
                {t.answer !== null && <AnswerBubble>{t.answer}</AnswerBubble>}
              </div>
            ))}

            {forming &&
              (sse.closing ? (
                <QuestionBubble tone="closing">
                  {sse.closing}
                  {sse.streaming && <Caret />}
                </QuestionBubble>
              ) : sse.question ? (
                <QuestionBubble>
                  {sse.question}
                  {sse.streaming && <Caret />}
                </QuestionBubble>
              ) : (
                <QuestionBubble>
                  <TypingDots />
                </QuestionBubble>
              ))}

            {detail.ended && detail.closing_message && (
              <QuestionBubble tone="closing">{detail.closing_message}</QuestionBubble>
            )}

            {sse.error && (
              <div className="flex justify-center py-2 animate-fade-in">
                <button
                  onClick={retry}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink-soft shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:text-accent"
                  aria-label="retry"
                >
                  <RetryIcon />
                </button>
              </div>
            )}
          </div>

          {pendingTurn && !sse.streaming && !sse.error && (
            <div className="relative shrink-0 pt-4">
              <TextArea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                rows={3}
                autoFocus
                className="min-h-[92px] pr-16"
              />
              <button
                onClick={submit}
                disabled={!draft.trim()}
                className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-md bg-accent text-white shadow-soft transition-all duration-200 enabled:hover:-translate-y-0.5 enabled:hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="send"
              >
                <SendIcon />
              </button>
            </div>
          )}
        </section>

        <div
          className="hidden self-stretch bg-gradient-to-b from-transparent via-ink-soft/30 to-transparent lg:block"
          aria-hidden
        />

        <ManuscriptColumn
          entries={detail.manuscript}
          live={sse.manuscript}
          streaming={sse.streaming}
          collapsed={manuscriptCollapsed}
          onToggle={() => setManuscriptCollapsed((c) => !c)}
        />
      </div>
    </div>
  );
}
