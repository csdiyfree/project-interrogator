// 信息页:左侧简历边栏(切换 / 内联改名)+ 摘要 + 项目卡(进入拷问 / 查看报告);
// 无简历时空状态。路由:`/`(回到上次/最新简历或空状态)与 `/resume/:resumeId`。
// 界面零提示文案;仅经 endpoints 取数。

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Chip, Skeleton, Spinner } from '../design/components';
import { getResume, listResumes, renameResume } from '../api/endpoints';
import { usePolling } from '../lib/usePolling';
import { getLastResumeId, setLastResumeId } from '../lib/session';
import { ArrowRightIcon, ParsingView } from '../features/resume/shared';
import type { ProjectInResume, ResumeDetail, ResumeListItem } from '../api/types';

export function InfoPage() {
  const { resumeId: paramId } = useParams();
  const navigate = useNavigate();

  const [list, setList] = useState<ResumeListItem[] | null>(null);

  // 简历列表(进入 / 切换简历时刷新,纳入新建与改名结果)。
  useEffect(() => {
    let active = true;
    listResumes()
      .then((r) => active && setList(r.resumes))
      .catch(() => active && setList([]));
    return () => {
      active = false;
    };
  }, [paramId]);

  // 记住当前简历。
  useEffect(() => {
    if (paramId) setLastResumeId(paramId);
  }, [paramId]);

  // 当前简历详情,轮询至非 parsing。
  const { data: resume, error: resumeErr } = usePolling(() => getResume(paramId!), {
    interval: 1200,
    enabled: !!paramId,
    stopWhen: (r) => r.status !== 'parsing',
    resetKey: paramId,
  });

  // `/` 无参:有简历→按 last/首份跳 /resume/:id;listResumes 确认无简历(空数组)→跳 /upload。
  useEffect(() => {
    if (paramId || list == null) return;
    const lastId = getLastResumeId();
    const target = lastId && list.some((r) => r.id === lastId) ? lastId : (list[0]?.id ?? null);
    navigate(target ? '/resume/' + target : '/upload', { replace: true });
  }, [paramId, list, navigate]);

  // 指定简历不存在:有其他简历→回退首份;确认无简历→跳 /upload。
  useEffect(() => {
    if (!paramId || !resumeErr || list == null) return;
    navigate(list.length > 0 ? '/resume/' + list[0].id : '/upload', { replace: true });
  }, [paramId, resumeErr, list, navigate]);

  // 内联改名:乐观更新,失败回滚。
  const handleRename = async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const prev = list;
    setList((l) => (l ? l.map((r) => (r.id === id ? { ...r, name: trimmed } : r)) : l));
    try {
      const updated = await renameResume(id, trimmed);
      setList((l) => (l ? l.map((r) => (r.id === id ? updated : r)) : l));
    } catch {
      setList(prev ?? null);
    }
  };

  const goUpload = () => navigate('/upload');

  // ── 渲染 ──(无 resumeId / 简历不存在时由上面的 effect 跳转,这里仅过渡态)
  if (!paramId || resumeErr) return <CenteredSpinner />;

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
      <Sidebar
        list={list}
        currentId={paramId}
        onOpen={(id) => navigate('/resume/' + id)}
        onUpload={goUpload}
        onRename={handleRename}
      />
      <section className="min-w-0 flex-1">
        {resumeErr || !resume ? (
          <CenteredSpinner />
        ) : resume.status === 'parsing' ? (
          <div className="max-w-3xl">
            <ParsingView />
          </div>
        ) : (
          <ResumeMain
            resume={resume}
            onEnter={(id) => navigate('/interrogations/' + id)}
            onReport={(id) => navigate('/interrogations/' + id + '/guide')}
          />
        )}
      </section>
    </div>
  );
}

/* ── 左侧边栏 ── */

function Sidebar({
  list,
  currentId,
  onOpen,
  onUpload,
  onRename,
}: {
  list: ResumeListItem[] | null;
  currentId: string;
  onOpen: (id: string) => void;
  onUpload: () => void;
  onRename: (id: string, name: string) => void;
}) {
  return (
    <aside className="lg:w-60 lg:shrink-0">
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={onUpload}
          aria-label="上传简历"
          className="flex w-full items-center justify-center rounded-md border border-dashed border-line py-2.5 text-ink-soft transition-all duration-200 hover:border-accent/40 hover:bg-surface hover:text-accent"
        >
          <PlusIcon />
        </button>
        {list == null
          ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-11 rounded-md" />)
          : list.map((item) => (
              <SidebarItem
                key={item.id}
                item={item}
                active={item.id === currentId}
                onOpen={() => onOpen(item.id)}
                onRename={(name) => onRename(item.id, name)}
              />
            ))}
      </div>
    </aside>
  );
}

function SidebarItem({
  item,
  active,
  onOpen,
  onRename,
}: {
  item: ResumeListItem;
  active: boolean;
  onOpen: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.name ?? '');
  const parsing = item.status === 'parsing';
  const displayName = item.name?.trim() || '—';

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== (item.name ?? '')) onRename(trimmed);
  };

  if (active) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-accent/25 bg-accent/[0.07] px-3 py-2.5">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setDraft(item.name ?? '');
                setEditing(false);
              }
            }}
            onBlur={commit}
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none"
          />
        ) : (
          <button
            type="button"
            aria-label="重命名"
            onClick={() => {
              setDraft(item.name ?? '');
              setEditing(true);
            }}
            className="min-w-0 flex-1 truncate text-left text-sm font-medium text-ink"
          >
            {displayName}
          </button>
        )}
        <StatusDot parsing={parsing} active />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left transition-colors duration-200 hover:bg-black/[0.04]"
    >
      <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{displayName}</span>
      <StatusDot parsing={parsing} />
    </button>
  );
}

function StatusDot({ parsing, active }: { parsing: boolean; active?: boolean }) {
  if (parsing) {
    return <span className="h-1.5 w-1.5 shrink-0 animate-breathe rounded-full bg-amber" />;
  }
  return (
    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-accent' : 'bg-line'}`} />
  );
}

/* ── 主区:摘要 + 项目卡 ── */

function ResumeMain({
  resume,
  onEnter,
  onReport,
}: {
  resume: ResumeDetail;
  onEnter: (interrogationId: string) => void;
  onReport: (interrogationId: string) => void;
}) {
  const projects = [...resume.projects].sort((a, b) => a.order_index - b.order_index);
  return (
    <div className="max-w-3xl animate-fade-up space-y-9">
      <header className="space-y-5">
        <h1 className="font-serif text-3xl leading-tight text-ink sm:text-[2.4rem]">
          {resume.summary?.headline}
        </h1>
        <div className="flex flex-wrap gap-2.5">
          {resume.summary?.items.map((it, i) => (
            <Chip key={i} label={it.label}>
              {it.value}
            </Chip>
          ))}
        </div>
      </header>

      <div className="space-y-4">
        {projects.map((p, i) => (
          <ProjectCard key={p.id} project={p} index={i} onEnter={onEnter} onReport={onReport} />
        ))}
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  index,
  onEnter,
  onReport,
}: {
  project: ProjectInResume;
  index: number;
  onEnter: (interrogationId: string) => void;
  onReport: (interrogationId: string) => void;
}) {
  const ci = project.current_interrogation;
  const ready = ci != null;
  const ended = ci?.status === 'ended';

  return (
    <Card
      interactive={ready}
      onClick={ready ? () => onEnter(ci!.id) : undefined}
      className={`group p-6 sm:p-7 ${ready ? '' : 'opacity-80'}`}
    >
      <div className="flex items-start gap-5">
        <span className="select-none font-serif text-2xl leading-none tabular-nums text-accent/35">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-xl text-ink">{project.name}</h3>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft">
            {project.raw_description}
          </p>
          <div className="mt-4">
            <button
              type="button"
              disabled={!ended}
              aria-label="查看报告"
              onClick={(e) => {
                e.stopPropagation();
                if (ended) onReport(ci!.id);
              }}
              className={`inline-flex h-9 items-center justify-center rounded-full border px-4 transition-all duration-200 ${
                ended
                  ? 'cursor-pointer border-accent-2/30 text-accent-2 hover:bg-accent-2/[0.07]'
                  : 'cursor-not-allowed border-line text-ink-soft/35'
              }`}
            >
              <ReportIcon />
            </button>
          </div>
        </div>
        <span className="mt-1 shrink-0">
          {ready ? (
            <ArrowRightIcon className="text-ink-soft/40 transition-all duration-200 group-hover:translate-x-1 group-hover:text-accent" />
          ) : (
            <Spinner size={18} className="text-accent/50" />
          )}
        </span>
      </div>
    </Card>
  );
}

/* ── 加载过渡 ── */

function CenteredSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner size={28} className="text-accent/60" />
    </div>
  );
}

/* ── 图标 ── */

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 3v4a1 1 0 0 0 1 1h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 13l1.6 1.6 3-3.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14.6 16.5H9.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
