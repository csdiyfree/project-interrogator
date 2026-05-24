// 极简登录页:品牌 + 用户名/密码 + 提交。成功存令牌并进入 `/`;失败克制提示。
// 独立全屏布局(不渲染主应用顶栏)。风格沿用温暖科技人文设计系统。

import { useRef, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../design/components';
import { login } from '../api/endpoints';
import { setSession } from '../lib/session';

function BrandMark({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect width="40" height="40" rx="12" fill="var(--accent)" />
      <rect width="40" height="40" rx="12" fill="url(#lbg)" fillOpacity="0.18" />
      <circle cx="20" cy="20" r="11" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.5" />
      <path
        d="M15.5 16.5c0-2.5 2-4 4.5-4s4.5 1.6 4.5 4c0 3-3.8 3.2-4.3 5.6"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="19.9" cy="27" r="1.7" fill="#fff" />
      <defs>
        <linearGradient id="lbg" x1="0" y1="0" x2="40" y2="40">
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M5 19.5c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function Field({
  icon,
  error,
  ...rest
}: {
  icon: ReactNode;
  error: boolean;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft">
        {icon}
      </span>
      <input
        {...rest}
        className={`w-full rounded-md border bg-surface py-3 pl-11 pr-4 text-ink outline-none transition-all duration-200 placeholder:text-ink-soft/45 focus:shadow-soft focus:ring-4 ${
          error
            ? 'border-red/60 focus:border-red/60 focus:ring-red/10'
            : 'border-line focus:border-accent/50 focus:ring-accent/10'
        }`}
      />
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const cardRef = useRef<HTMLFormElement>(null);

  const canSubmit = username.trim().length > 0 && password.length > 0;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(false);
    try {
      const res = await login(username.trim(), password);
      // 先写令牌,再跳转 —— 使随后的 listResumes() 带上该用户令牌。
      setSession(res.session_id);
      navigate('/', { replace: true });
    } catch {
      setError(true);
      setLoading(false);
      cardRef.current?.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-7px)' },
          { transform: 'translateX(6px)' },
          { transform: 'translateX(-4px)' },
          { transform: 'translateX(0)' },
        ],
        { duration: 320, easing: 'ease-in-out' },
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-5">
      <form
        ref={cardRef}
        onSubmit={onSubmit}
        className="w-full max-w-sm animate-fade-up rounded-lg border border-line bg-surface p-8 shadow-soft sm:p-10"
      >
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <BrandMark />
          <h1 className="font-serif text-2xl tracking-wide text-ink">拷打模拟器</h1>
        </div>

        <div className="space-y-3.5">
          <Field
            icon={<UserIcon />}
            error={error}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError(false);
            }}
            placeholder="用户名"
            autoComplete="username"
            autoFocus
            aria-label="用户名"
          />
          <Field
            icon={<LockIcon />}
            error={error}
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            placeholder="密码"
            autoComplete="current-password"
            aria-label="密码"
          />
        </div>

        <div className="mt-3 h-5 text-center">
          {error && <span className="animate-fade-in text-sm text-red">账号或密码错误</span>}
        </div>

        <Button
          type="submit"
          loading={loading}
          disabled={!canSubmit}
          className="mt-2 w-full"
        >
          登录
        </Button>
      </form>
    </div>
  );
}
