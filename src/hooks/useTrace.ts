import { useCallback, useMemo, useState } from 'react';

import {
  HINT_AFTER,
  judgeStroke,
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
  misses: number;
  forced: number;
  orderSlips: number;
  hint: boolean;
  note: string | null;
  /** A marginal attempt awaiting the learner's own call. */
  pendingCall: readonly Point[] | null;
  result: TraceResult | null;
}

function emptyState(glyph: string): TraceState {
  return {
    glyph,
    done: [],
    misses: 0,
    forced: 0,
    orderSlips: 0,
    hint: false,
    note: null,
    pendingCall: null,
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
  /** 1-based index of the stroke being drawn, for "Stroke i of n". */
  strokeNumber: number;
  strokeTotal: number;
  hint: boolean;
  note: string | null;
  pendingCall: readonly Point[] | null;
  result: TraceResult | null;
  /** True while a close call is unresolved — ordinary controls must not render. */
  awaitingCall: boolean;
  canUndo: boolean;

  load(glyph: string): void;
  beginStroke(point: Point): void;
  extendStroke(point: Point): void;
  endStroke(): void;
  undo(): void;
  clear(): void;
  toggleHint(): void;
  /** Resolve a close call. `true` is the learner counting it. */
  resolveCall(counted: boolean): void;
  finish(): void;
}

export function useTrace(initialGlyph: string): TraceController {
  const [state, setState] = useState<TraceState>(() => emptyState(initialGlyph));
  const [live, setLive] = useState<Point[] | null>(null);

  const model = useMemo(() => strokeModel(state.glyph), [state.glyph]);

  const load = useCallback((glyph: string) => {
    setLive(null);
    setState(emptyState(glyph));
  }, []);

  const beginStroke = useCallback(
    (point: Point) => {
      if (state.pendingCall || state.result || !model) {
        return;
      }
      setLive([point]);
    },
    [model, state.pendingCall, state.result],
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
        result: traceResult({
          completed: current.done,
          model,
          orderSlips: current.orderSlips,
          forced: current.forced,
        }),
      };
    });
  }, [model]);

  const endStroke = useCallback(() => {
    const drawn = live;
    setLive(null);
    if (!drawn || !model) {
      return;
    }

    setState((current) => {
      if (current.pendingCall || current.result) {
        return current;
      }
      const expectedIndex = current.done.length;
      const decision = judgeStroke({
        drawn,
        model,
        expectedIndex,
        misses: current.misses,
      });
      if (!decision) {
        return current;
      }

      switch (decision.kind) {
        case 'accepted':
          return {
            ...current,
            done: [...current.done, { drawn }],
            misses: 0,
            hint: false,
            note: null,
          };
        case 'closeCall':
          return {
            ...current,
            pendingCall: drawn,
            misses: decision.misses,
            hint: true,
            note: null,
          };
        case 'forced':
          return {
            ...current,
            done: [...current.done, { forced: true }],
            misses: 0,
            hint: false,
            forced: current.forced + 1,
            orderSlips: current.orderSlips + (decision.slip ? 1 : 0),
            note: decision.note,
          };
        case 'retry':
          return {
            ...current,
            misses: decision.misses,
            hint: decision.hint,
            orderSlips: current.orderSlips + (decision.slip ? 1 : 0),
            note: decision.note,
          };
      }
    });
  }, [live, model]);

  const undo = useCallback(() => {
    setState((current) =>
      current.done.length === 0 || current.pendingCall
        ? current
        : {
            ...current,
            done: current.done.slice(0, -1),
            misses: 0,
            note: null,
            result: null,
          },
    );
  }, []);

  const clear = useCallback(() => {
    setLive(null);
    setState((current) => ({
      ...emptyState(current.glyph),
      // Undo and Clear reset the attempt, not the character.
      hint: current.hint,
    }));
  }, []);

  const toggleHint = useCallback(() => {
    setState((current) =>
      current.pendingCall ? current : { ...current, hint: !current.hint },
    );
  }, []);

  const resolveCall = useCallback((counted: boolean) => {
    setState((current) => {
      const pending = current.pendingCall;
      if (!pending) {
        return current;
      }
      if (!counted) {
        return {
          ...current,
          pendingCall: null,
          hint: current.misses >= HINT_AFTER,
          note: 'Have another go — start at the dot.',
        };
      }
      return {
        ...current,
        pendingCall: null,
        done: [...current.done, { drawn: pending, selfGraded: true }],
        misses: 0,
        hint: false,
        note: null,
      };
    });
  }, []);

  const strokeTotal = model?.length ?? 0;

  return {
    glyph: state.glyph,
    model,
    ready: Boolean(model),
    done: state.done,
    live,
    strokeNumber: Math.min(state.done.length + 1, Math.max(strokeTotal, 1)),
    strokeTotal,
    hint: state.hint,
    note: state.note,
    pendingCall: state.pendingCall,
    result: state.result,
    awaitingCall: Boolean(state.pendingCall),
    canUndo: state.done.length > 0,
    load,
    beginStroke,
    extendStroke,
    endStroke,
    undo,
    clear,
    toggleHint,
    resolveCall,
    finish,
  };
}
