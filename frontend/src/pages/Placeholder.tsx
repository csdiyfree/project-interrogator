// 占位视觉:居中、呼吸式徽标,无任何文案。FE1/2/3 各自替换对应页面后即弃用。

type Variant = 'resume' | 'interrogation' | 'guide';

const PATHS: Record<Variant, string> = {
  // 文档 / 简历
  resume: 'M8 4h6l4 4v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm6 0v4h4',
  // 对话 / 拷问
  interrogation: 'M5 6h14v9H10l-4 3v-3H5a0 0 0 0 1 0 0V6Z',
  // 三灯 / 指南(用同心弧近似)
  guide: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v4l2.5 2.5',
};

export function PlaceholderEmblem({ variant }: { variant: Variant }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="animate-fade-up">
        <div className="animate-breathe flex h-24 w-24 items-center justify-center rounded-[28px] border border-line bg-surface text-accent shadow-soft">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d={PATHS[variant]}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
