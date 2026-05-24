import type { TrafficLight as TrafficLightValue } from '../../api/types';

interface TrafficLightProps {
  value: TrafficLightValue;
  size?: number;
}

const ORDER: TrafficLightValue[] = ['red', 'yellow', 'green'];
const COLORS: Record<TrafficLightValue, string> = {
  red: 'var(--red)',
  yellow: 'var(--amber)',
  green: 'var(--green)',
};

export function TrafficLight({ value, size = 15 }: TrafficLightProps) {
  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-line bg-ink/[0.03] px-3.5 py-2.5">
      {ORDER.map((c) => {
        const on = c === value;
        return (
          <span
            key={c}
            className="rounded-full transition-all duration-300"
            style={{
              width: size,
              height: size,
              background: COLORS[c],
              opacity: on ? 1 : 0.16,
              boxShadow: on
                ? `0 0 0 4px ${COLORS[c]}22, 0 0 16px 1px ${COLORS[c]}99`
                : 'none',
            }}
          />
        );
      })}
    </div>
  );
}
