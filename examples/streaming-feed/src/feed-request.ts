import { stream } from "@effront/core/query";
import { Effect, Predicate, Stream } from "effect";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Story } from "./feed-data.ts";
import { storyCount } from "./feed-data.ts";
import { streamFeed } from "./server-functions.ts";

const readPage = stream(streamFeed);
const lastStory = -1;
const initialCursor = 0;

type FeedRequest = Readonly<{
  ended: boolean;
  failed: boolean;
  loadMore: () => void;
  pending: boolean;
  stories: Readonly<Story[]>;
}>;

export const useFeedRequest = (seed: Readonly<Story[]>): FeedRequest => {
  const [stories, setStories] = useState(seed);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  // oxlint-disable-next-line unicorn/no-useless-undefined -- React 19 requires an initial ref value before any request starts.
  const active = useRef<AbortController>(undefined);
  const lastId = stories.at(lastStory)?.id ?? initialCursor;
  const ended = lastId >= storyCount;

  useEffect(
    () => () => {
      active.current?.abort();
    },
    [],
  );

  const loadMore = useCallback(() => {
    if (Predicate.isNotNullish(active.current) || ended) {
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    setPending(true);
    setFailed(false);
    const append = (story: Story): Effect.Effect<void> =>
      Effect.sync(() => {
        setStories((current) => [...current, story]);
      });
    const settled = Effect.sync(() => {
      if (active.current === controller) {
        active.current = undefined;
      }
      setPending(false);
    });
    const request = Stream.runForEach(readPage({ after: lastId }), append).pipe(
      Effect.catchCause(() =>
        Effect.sync(() => {
          if (!controller.signal.aborted) {
            setFailed(true);
          }
        }),
      ),
      Effect.ensuring(settled),
    );
    // oxlint-disable-next-line rules/no-effect-runtime-run -- This user-initiated browser stream is cancelled on component unmount.
    Effect.runFork(request, { signal: controller.signal });
  }, [ended, lastId]);

  return { ended, failed, loadMore, pending, stories };
};
