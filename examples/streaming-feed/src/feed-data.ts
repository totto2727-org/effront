import { Predicate } from "effect";

export const pageSize = 6;
export const storyCount = 10_000;

const firstStoryId = 1;
const nextStoryOffset = 1;

export type Story = Readonly<{
  detail: string;
  id: number;
  summary: string;
  title: string;
}>;

export const storyById = (id: number): Story | undefined => {
  if (!Number.isSafeInteger(id) || id < firstStoryId || id > storyCount) {
    return undefined;
  }
  return {
    detail: `The full story for note ${id} is revealed without reloading the feed.`,
    id,
    summary: `A short observation from note ${id}.`,
    title: `Field note ${id}`,
  };
};

export const storiesAfter = (after: number): Readonly<Story[]> => {
  const start = Math.max(firstStoryId, after + nextStoryOffset);
  const length = Math.min(pageSize, storyCount - after);
  return Array.from({ length }, (_unused, offset) => storyById(start + offset)).filter((story) =>
    Predicate.isNotNullish(story),
  );
};
