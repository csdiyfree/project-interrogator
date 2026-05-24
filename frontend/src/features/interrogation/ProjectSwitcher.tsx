// 项目名旁小三角展开的下拉:列出同一份简历的其他项目,点击切到其当前拷问。
// 数据用 getResume(resume_id) 懒加载;当前项目高亮;点击外部 / Esc 关闭。

import { useEffect, useRef, useState } from 'react';
import { getResume } from '../../api/endpoints';
import type { ProjectInResume } from '../../api/types';
import { Spinner } from '../../design/components';

interface Props {
  resumeId: string;
  currentProjectId: string;
  onClose: () => void;
  onPick: (interrogationId: string) => void;
}

export function ProjectSwitcher({ resumeId, currentProjectId, onClose, onPick }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [projects, setProjects] = useState<ProjectInResume[] | null>(null);

  useEffect(() => {
    let active = true;
    getResume(resumeId)
      .then((r) => active && setProjects([...r.projects].sort((a, b) => a.order_index - b.order_index)))
      .catch(() => active && setProjects([]));
    return () => {
      active = false;
    };
  }, [resumeId]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-30 mt-2 w-[min(20rem,80vw)] animate-fade-up rounded-lg border border-line bg-surface p-1.5 shadow-soft-lg"
    >
      {!projects ? (
        <div className="flex justify-center py-6 text-ink-soft">
          <Spinner size={18} />
        </div>
      ) : (
        projects.map((p) => {
          const current = p.id === currentProjectId;
          const enterable = !!p.current_interrogation;
          return (
            <button
              key={p.id}
              type="button"
              disabled={current || !enterable}
              onClick={() => p.current_interrogation && onPick(p.current_interrogation.id)}
              className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                current
                  ? 'bg-accent/10 text-accent'
                  : 'text-ink enabled:hover:bg-black/[0.04] disabled:opacity-40'
              }`}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: current ? 'var(--accent)' : 'var(--line)' }}
              />
              <span className="truncate">{p.name}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
