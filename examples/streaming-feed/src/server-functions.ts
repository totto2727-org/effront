"use server";

import { Effect, Schema, Stream } from "effect";
import { EFFRONT } from "./effront.ts";
import { storiesAfter, storyById } from "./feed-data.ts";

const storyDelay = "350 millis";
// oxlint-disable-next-line unicorn/no-null -- The note's public Flight return value uses null for an unknown story.
const noNote = null;

export const getNote = EFFRONT.ServerFn.make({
  handler: ({ id }) => Effect.succeed(storyById(id)?.detail ?? noNote),
  input: Schema.Struct({ id: Schema.Natural }),
});

export const streamFeed = EFFRONT.ServerFn.make({
  handler: ({ after }) =>
    Effect.succeed(
      Stream.fromIterable(storiesAfter(after)).pipe(
        Stream.mapEffect((story) => Effect.sleep(storyDelay).pipe(Effect.as(story))),
      ),
    ),
  input: Schema.Struct({ after: Schema.Natural }),
});
