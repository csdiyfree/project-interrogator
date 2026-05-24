import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { InfoPage } from './pages/InfoPage';
import { UploadPage } from './pages/UploadPage';
import { InterrogationPage } from './pages/InterrogationPage';
import { GuidePage } from './pages/GuidePage';
import { listResumes } from './api/endpoints';

/** 无文案品牌徽标:暖陶土方印 + 内嵌「问/探」式同心弧。 */
function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect width="40" height="40" rx="11" fill="var(--accent)" />
      <rect width="40" height="40" rx="11" fill="url(#bg)" fillOpacity="0.18" />
      <circle cx="20" cy="20" r="11" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.5" />
      <path
        d="M15.5 16.5c0-2.5 2-4 4.5-4s4.5 1.6 4.5 4c0 3-3.8 3.2-4.3 5.6"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="19.9" cy="27" r="1.7" fill="#fff" />
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="40" y2="40">
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ListIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 6h12M8 12h12M8 18h8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="4" cy="6" r="1.1" fill="currentColor" />
      <circle cx="4" cy="12" r="1.1" fill="currentColor" />
      <circle cx="4" cy="18" r="1.1" fill="currentColor" />
    </svg>
  );
}

function UploadIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15V4m0 0L7.8 8.2M12 4l4.2 4.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 14v3.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V14"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const navBase = 'flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200';

function navCls({ isActive }: { isActive: boolean }) {
  return `${navBase} ${
    isActive ? 'bg-accent/10 text-accent' : 'text-ink-soft hover:bg-black/[0.04] hover:text-ink'
  }`;
}

function Header() {
  const location = useLocation();
  // 仅当 listResumes() 成功返回空数组时才判定「无现存简历」(请求失败不算)。
  // 随路由变化重拉,使上传解析完成跳转后信息页按钮自动恢复可点。
  const [hasResumes, setHasResumes] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    listResumes()
      .then((r) => active && setHasResumes(r.resumes.length > 0))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [location.pathname]);

  const infoDisabled = hasResumes === false;

  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
        <Link
          to="/"
          aria-label="home"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <BrandMark />
          <span className="font-serif text-lg tracking-wide text-ink">拷打模拟器</span>
        </Link>
        <nav className="flex items-center gap-1.5">
          {infoDisabled ? (
            <span
              aria-label="resumes"
              aria-disabled="true"
              className={`${navBase} cursor-not-allowed text-ink-soft/25`}
            >
              <ListIcon />
            </span>
          ) : (
            <NavLink to="/" end aria-label="resumes" className={navCls}>
              <ListIcon />
            </NavLink>
          )}
          <NavLink to="/upload" aria-label="upload" className={navCls}>
            <UploadIcon />
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-8">
        <Routes>
          <Route path="/" element={<InfoPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/resume/:resumeId" element={<InfoPage />} />
          <Route path="/interrogations/:interrogationId" element={<InterrogationPage />} />
          <Route path="/interrogations/:interrogationId/guide" element={<GuidePage />} />
        </Routes>
      </main>
    </div>
  );
}
