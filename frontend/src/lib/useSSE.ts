import { useCallback, useState } from 'react';
import { answer } from '../api/endpoints';
import type { DoneEvent, SSEErrorEvent } from '../api/types';

export interface AnswerStreamState {
  /** 是否正在流式接收。 */
  streaming: boolean;
  /** 本轮累积的手稿增量。 */
  manuscript: string;
  /** 本轮累积的下一问增量(未结束时)。 */
  question: string;
  /** 本轮累积的结束语增量(结束时)。 */
  closing: string;
  /** 收尾事件(含 ended 与索引);未收尾为 null。 */
  done: DoneEvent | null;
  error: SSEErrorEvent | null;
}

const EMPTY: AnswerStreamState = {
  streaming: false,
  manuscript: '',
  question: '',
  closing: '',
  done: null,
  error: null,
};

/**
 * 消费 POST .../answer 的 SSE 流。把 5 类事件累积成可渲染的文本缓冲:
 * 调 submit() 触发,组件读取 manuscript/question/closing 做打字机渲染,
 * 凭 done/error 收尾。reset() 清空缓冲准备下一轮。
 */
export function useSSE() {
  const [state, setState] = useState<AnswerStreamState>(EMPTY);

  const submit = useCallback(
    (interrogationId: string, turnIndex: number, answerText: string) => {
      setState({ ...EMPTY, streaming: true });
      return answer(interrogationId, turnIndex, answerText, {
        onManuscript: (e) => setState((s) => ({ ...s, manuscript: s.manuscript + e.text })),
        onQuestion: (e) => setState((s) => ({ ...s, question: s.question + e.text })),
        onClosing: (e) => setState((s) => ({ ...s, closing: s.closing + e.text })),
        onDone: (e) => setState((s) => ({ ...s, done: e, streaming: false })),
        onError: (e) => setState((s) => ({ ...s, error: e, streaming: false })),
      });
    },
    [],
  );

  const reset = useCallback(() => setState(EMPTY), []);

  return { ...state, submit, reset };
}
