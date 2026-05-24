import { Link, Route, Routes } from 'react-router-dom';
import { ResumePage } from './pages/ResumePage';
import { InterrogationPage } from './pages/InterrogationPage';
import { GuidePage } from './pages/GuidePage';

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

function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center px-5 sm:px-8">
        <Link
          to="/"
          aria-label="home"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <BrandMark />
          <span className="font-serif text-lg tracking-wide text-ink">拷打模拟器</span>
        </Link>
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
          <Route path="/" element={<ResumePage />} />
          <Route path="/interrogations/:interrogationId" element={<InterrogationPage />} />
          <Route path="/interrogations/:interrogationId/guide" element={<GuidePage />} />
        </Routes>
      </main>
    </div>
  );
}
