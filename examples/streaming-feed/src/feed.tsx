"use client";

import { query, stream } from "@effront/core/query";
import { Effect, Stream } from "effect";
import { useEffect, useRef, useState } from "react";
import type { Story } from "./feed-data";
import { pageSize, storyCount } from "./feed-data";
import { getNote, streamFeed } from "./server-functions";

const readNote = query(getNote);
const readPage = stream(streamFeed);

function StoryCard({ story }: { readonly story: Story }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [failure, setFailure] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!expanded || detail !== null) return;
    const controller = new AbortController();
    void Effect.runPromise(readNote({ id: story.id }), { signal: controller.signal })
      .then((value) => setDetail(value ?? "No note is available."))
      .catch(() => {
        if (!controller.signal.aborted) setFailure(true);
      });
    return () => controller.abort();
  }, [expanded, detail, story.id, attempt]);

  return (
    <li data-story-id={story.id}>
      <h2>{story.title}</h2>
      <p>{story.summary}</p>
      <button
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        {expanded ? "Close note" : "Read note"}
      </button>
      {expanded && (
        <div aria-live="polite">
          {failure ? (
            <button
              onClick={() => {
                setFailure(false);
                setAttempt((current) => current + 1);
              }}
              type="button"
            >
              Retry note
            </button>
          ) : (
            (detail ?? "Loading note…")
          )}
        </div>
      )}
    </li>
  );
}

export function Feed({ seed }: { readonly seed: ReadonlyArray<Story> }) {
  const [stories, setStories] = useState(seed);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState(false);
  const request = useRef<AbortController | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const lastId = stories.at(-1)?.id ?? 0;
  const ended = lastId >= storyCount;

  useEffect(() => {
    root.current?.setAttribute("data-hydrated", "true");
    return () => request.current?.abort();
  }, []);

  const loadMore = () => {
    if (request.current || ended) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setFailure(false);
    void Effect.runPromise(
      Stream.runForEach(readPage({ after: lastId }), (story) =>
        Effect.sync(() => setStories((current) => [...current, story])),
      ),
      { signal: controller.signal },
    )
      .catch(() => {
        if (!controller.signal.aborted) setFailure(true);
      })
      .finally(() => {
        if (request.current === controller) request.current = null;
        setPending(false);
      });
  };

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
      {!ended && (
        <div>
          {failure && <p role="alert">The next notes could not be loaded.</p>}
          <button disabled={pending} onClick={loadMore} type="button">
            {pending ? "Loading more notes…" : failure ? "Retry" : `Load ${pageSize} more notes`}
          </button>
        </div>
      )}
    </div>
  );
}
