import { query } from "@effront/core/query";
import { Effect, Function, Predicate } from "effect";
import { useCallback, useEffect, useState } from "react";
import { getNote } from "./server-functions.ts";

const readNote = query(getNote);
const firstAttempt = 0;
const retryStep = 1;

type StoryNote = Readonly<{
  detail: string | undefined;
  expanded: boolean;
  failed: boolean;
  retry: () => void;
  toggle: () => void;
}>;

export const useStoryNote = (id: number): StoryNote => {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(firstAttempt);
  const requestKey = expanded && Predicate.isNullish(detail) ? attempt : undefined;

  useEffect(() => {
    if (Predicate.isNullish(requestKey)) {
      return Function.constVoid;
    }
    const controller = new AbortController();
    const note = readNote({ id }).pipe(
      Effect.matchCause({
        onFailure: () => {
          if (!controller.signal.aborted) {
            setFailed(true);
          }
        },
        onSuccess: (value) => {
          setDetail(value ?? "No note is available.");
        },
      }),
    );
    // oxlint-disable-next-line rules/no-effect-runtime-run -- This browser request starts and stops with the React effect.
    Effect.runFork(note, { signal: controller.signal });
    return () => {
      controller.abort();
    };
  }, [id, requestKey]);

  const toggle = useCallback(() => {
    setExpanded((current) => !current);
  }, []);
  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((current) => current + retryStep);
  }, []);

  return { detail, expanded, failed, retry, toggle };
};
