interface SkeletonProps {
  className?: string;
}

/** 暖色微光骨架占位。优雅地表达「加载中」,不写文字。 */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`rounded-md animate-shimmer ${className}`}
      style={{
        background:
          'linear-gradient(90deg, rgba(110,101,91,0.06) 25%, rgba(110,101,91,0.13) 50%, rgba(110,101,91,0.06) 75%)',
        backgroundSize: '200% 100%',
      }}
    />
  );
}
