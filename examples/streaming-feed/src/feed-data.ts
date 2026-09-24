export const pageSize = 6;
export const storyCount = 10_000;

export type Story = {
  readonly id: number;
  readonly title: string;
  readonly summary: string;
  readonly detail: string;
};

export function storyById(id: number): Story | null {
  if (!Number.isSafeInteger(id) || id < 1 || id > storyCount) return null;
  return {
    id,
    title: `Field note ${id}`,
    summary: `A short observation from note ${id}.`,
    detail: `The full story for note ${id} is revealed without reloading the feed.`,
  };
}

export function storiesAfter(after: number): ReadonlyArray<Story> {
  const start = Math.max(1, after + 1);
  return Array.from({ length: Math.min(pageSize, storyCount - after) }, (_, offset) =>
    storyById(start + offset),
  ).filter((story): story is Story => story !== null);
}
