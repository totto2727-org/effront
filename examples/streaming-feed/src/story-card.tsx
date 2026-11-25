import type { JSX } from "react";
import type { Story } from "./feed-data.ts";
import { useStoryNote } from "./story-note.ts";

// oxlint-disable-next-line eslint/func-style -- React's component definition rule requires a named declaration.
export function StoryCard({ story }: Readonly<{ story: Story }>): JSX.Element {
  const { detail, expanded, failed, retry, toggle } = useStoryNote(story.id);
  const retryButton = (
    <button onClick={retry} type="button">
      Retry note
    </button>
  );
  const note = failed ? retryButton : (detail ?? "Loading note…");

  return (
    <li data-story-id={story.id}>
      <h2>{story.title}</h2>
      <p>{story.summary}</p>
      <button aria-expanded={expanded} onClick={toggle} type="button">
        {expanded ? "Close note" : "Read note"}
      </button>
      {expanded && <div aria-live="polite">{note}</div>}
    </li>
  );
}
