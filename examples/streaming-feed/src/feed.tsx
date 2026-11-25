"use client";

import { useEffect, useRef } from "react";
import type { JSX } from "react";
import { Predicate } from "effect";
import type { Story } from "./feed-data.ts";
import { pageSize, storyCount } from "./feed-data.ts";
import { useFeedRequest } from "./feed-request.ts";
import { StoryCard } from "./story-card.tsx";

// oxlint-disable-next-line unicorn/no-null -- React DOM refs start with null before a node mounts.
const noElement = null;

const loadLabel = (pending: boolean, failed: boolean): string => {
  if (pending) {
    return "Loading more notes…";
  }
  return failed ? "Retry" : `Load ${pageSize} more notes`;
};

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function Feed({ seed }: Readonly<{ seed: Readonly<Story[]> }>): JSX.Element {
  const { ended, failed, loadMore, pending, stories } = useFeedRequest(seed);
  const root = useRef<HTMLDivElement>(noElement);
  useEffect(() => {
    if (Predicate.isNotNullish(root.current)) {
      root.current.dataset["hydrated"] = "true";
    }
  }, []);

  const load = (
    <button disabled={pending} onClick={loadMore} type="button">
      {loadLabel(pending, failed)}
    </button>
  );
  const requestControls = ended ? (
    noElement
  ) : (
    <div>
      {failed && <p role="alert">The next notes could not be loaded.</p>}
      {load}
    </div>
  );

  return (
    <div ref={root}>
      <p aria-live="polite">
        {stories.length} / {storyCount} notes
      </p>
      <ol>
        {stories.map((story) => (
          <StoryCard key={story.id} story={story} />
        ))}
      </ol>
      {requestControls}
    </div>
  );
}
