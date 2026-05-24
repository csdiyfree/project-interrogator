// 独立上传页:输入(文本/PDF)→ 提交即进入全屏「处理中」动画(覆盖 POST 与解析轮询)
// → 解析完成自动跳 /resume/:id。界面零提示文案。仅经 endpoints 取数。

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createResumeFile, createResumeText, getResume } from '../api/endpoints';
import { usePolling } from '../lib/usePolling';
import { setLastResumeId } from '../lib/session';
import { ComposeView, FailedView, type Mode } from '../features/resume/shared';

export function UploadPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);

  const { data: resume, error: pollError } = usePolling(() => getResume(resumeId!), {
    interval: 1200,
    enabled: !!resumeId,
    stopWhen: (r) => r.status !== 'parsing',
    resetKey: resumeId,
  });

  // 解析完成:记住该简历并跳信息页(replace,避免返回又回到处理态)。
  useEffect(() => {
    if (resume && resume.status === 'parsed') {
      setLastResumeId(resume.id);
      navigate('/resume/' + resume.id, { replace: true });
    }
  }, [resume, navigate]);

  const canSubmit = mode === 'text' ? text.trim().length > 0 : file != null;

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitFailed(false);
    try {
      const res = mode === 'text' ? await createResumeText(text) : await createResumeFile(file!);
      setResumeId(res.resume_id);
    } catch {
      setSubmitFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setResumeId(null);
    setSubmitFailed(false);
  };

  const failed = submitFailed || !!pollError || resume?.status === 'failed';

  if (failed) return <FailedView onRetry={reset} />;
  // 从点击提交那一刻(submitting)起,直到解析完成跳转(resumeId 存在)前,全程全屏动画。
  if (submitting || resumeId) return <ProcessingView />;
  return (
    <ComposeView
      mode={mode}
      setMode={setMode}
      text={text}
      setText={setText}
      file={file}
      setFile={setFile}
      canSubmit={canSubmit}
      submitting={submitting}
      onSubmit={submit}
    />
  );
}

/* ── 全屏「处理中」动画(无文案,多重持续动效) ── */

function ProcessingView() {
  return (
    <div className="flex min-h-[68vh] flex-col items-center justify-center gap-10 animate-fade-in">
      <div className="relative h-40 w-40">
        {/* 外圈缓慢顺时针弧 */}
        <svg
          className="absolute inset-0 h-full w-full animate-spin text-accent/70"
          style={{ animationDuration: '3.4s' }}
          viewBox="0 0 100 100"
          fill="none"
          aria-hidden
        >
          <circle
            cx="50"
            cy="50"
            r="46"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray="70 220"
          />
        </svg>
        {/* 内圈逆时针弧 */}
        <svg
          className="absolute inset-0 h-full w-full animate-spin text-accent-2/70"
          style={{ animationDuration: '2.4s', animationDirection: 'reverse' }}
          viewBox="0 0 100 100"
          fill="none"
          aria-hidden
        >
          <circle
            cx="50"
            cy="50"
            r="37"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="40 160"
          />
        </svg>
        {/* 绕轨微粒 */}
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: '4.8s' }}>
          <span className="absolute left-1/2 top-0.5 h-2 w-2 -translate-x-1/2 rounded-full bg-accent shadow-soft" />
        </div>
        {/* 呼吸中心徽标:审视镜 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-20 w-20 animate-breathe items-center justify-center rounded-[24px] bg-surface text-accent shadow-soft">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
              <path d="M20 20l-3.6-3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* 流动扫光条,进一步强调「在动」 */}
      <div
        className="h-1.5 w-44 animate-shimmer rounded-full"
        style={{
          background:
            'linear-gradient(90deg, rgba(194,104,61,0.10) 25%, rgba(194,104,61,0.55) 50%, rgba(194,104,61,0.10) 75%)',
          backgroundSize: '200% 100%',
        }}
        aria-hidden
      />
    </div>
  );
}
