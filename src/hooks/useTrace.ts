import { useCallback, useMemo, useState } from 'react';

import {
  judgeStroke,
  reviewTraceResult,
  strokeModel,
  traceResult,
  type CompletedStroke,
  type Point,
  type TraceResult,
} from '@/domain/strokes';

/**
 * All tracing state for one character.
 *
 * Deliberately a single hook with one `load` entry point. The design's handoff
 * records that a second code path which duplicated the step advance silently
 * graded one character's strokes against another character's model — so every
 * transition that changes the target glyph goes through `load`, which owns both
 * the model swap and every per-stroke reset.
 */

interface TraceState {
  glyph: string;
  done: CompletedStroke[];
  note: string | null;
  result: TraceResult | null;
}

function emptyState(glyph: string): TraceState {
  return {
    glyph,
    done: [],
    note: null,
    result: null,
  };
}

export interface TraceController {
  glyph: string;
  /** Model strokes in normalised space, or null when the glyph has no data. */
  model: readonly (readonly Point[])[] | null;
  ready: boolean;
  done: readonly CompletedStroke[];
  live: readonly Point[] | null;
  strokeTotal: number;
  note: string | null;
  result: TraceResult | null;
  canUndo: boolean;

  load(glyph: string): void;
  beginStroke(point: Point): void;
  extendStroke(point: Point): void;
  endStroke(): void;
  cancelStroke(): void;
  undo(): void;
  clear(): void;
  finish(): void;
}

interface TraceOptions {
  /**
   * Guided tracing teaches one stroke at a time. Review capture behaves like
   * an exam: every raw stroke stays on the page and nothing is judged until
   * the learner explicitly checks the whole character.
   */
  mode?: 'guided' | 'review';
}

export function useTrace(
  initialGlyph: string,
  { mode = 'guided' }: TraceOptions = {},
): TraceController {
  const [state, setState] = useState<TraceState>(() => emptyState(initialGlyph));
  const [live, setLive] = useState<Point[] | null>(null);

  const model = useMemo(() => strokeModel(state.glyph), [state.glyph]);

  const load = useCallback((glyph: string) => {
    setLive(null);
    setState(emptyState(glyph));
  }, []);

  const beginStroke = useCallback(
    (point: Point) => {
      if (state.result || !model) {
        return;
      }
      setLive([point]);
    },
    [model, state.result],
  );

  const extendStroke = useCallback((point: Point) => {
    setLive((current) => (current ? [...current, point] : current));
  }, []);

  const finish = useCallback(() => {
    setState((current) => {
      if (!model || current.result) {
        return current;
      }
      return {
        ...current,
        result:
          mode === 'review'
            ? reviewTraceResult({ completed: current.done, model })
            : traceResult({
                completed: current.done,
                model,
              }),
      };
    });
  }, [mode, model]);

  const endStroke = useCallback(() => {
    const drawn = live;
    setLive(null);
    if (!drawn || !model) {
      return;
    }

    setState((current) => {
      if (current.result) {
        return current;
      }

      if (mode === 'review') {
        // Reviews never interrupt, reject, hint, or identify a mistake while
        // the learner is recalling the character. Check owns all grading.
        return drawn.length < 2
          ? current
          : {
              ...current,
              done: [...current.done, { drawn }],
              note: null,
            };
      }

      const expectedIndex = current.done.length;
      const decision = judgeStroke({
        drawn,
        model,
        expectedIndex,
      });
      if (!decision) {
        return current;
      }

      return {
        ...current,
        // Guided feedback is advisory: retain every stroke and advance. The
        // learner owns Undo/Clear if they want to correct the attempt.
        done: [
          ...current.done,
          {
            drawn,
            orderSlip: decision.kind === 'warning' && decision.slip,
          },
        ],
        note: decision.kind === 'warning' ? decision.note : null,
      };
    });
  }, [live, mode, model]);

  const cancelStroke = useCallback(() => {
    // A responder can be taken by the browser or OS without a real finger-up.
    // That is not a learner-submitted stroke, so discard only the live fragment.
    setLive(null);
  }, []);

  const undo = useCallback(() => {
    setState((current) =>
      current.done.length === 0
        ? current
        : {
            ...current,
            done: current.done.slice(0, -1),
            note: null,
            result: null,
          },
    );
  }, []);

  const clear = useCallback(() => {
    setLive(null);
    setState((current) => emptyState(current.glyph));
  }, []);

  const strokeTotal = model?.length ?? 0;

  return {
    glyph: state.glyph,
    model,
    ready: Boolean(model),
    done: state.done,
    live,
    strokeTotal,
    note: state.note,
    result: state.result,
    canUndo: state.done.length > 0,
    load,
    beginStroke,
    extendStroke,
    endStroke,
    cancelStroke,
    undo,
    clear,
    finish,
  };
}
