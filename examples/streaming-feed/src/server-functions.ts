"use server";

import { Effect, Schema, Stream } from "effect";
import { EFFRONT } from "./effront";
import { storiesAfter, storyById } from "./feed-data";

export const getNote = EFFRONT.ServerFn.make({
  input: Schema.Struct({ id: Schema.Natural }),
  handler: ({ id }) => Effect.succeed(storyById(id)?.detail ?? null),
});

export const streamFeed = EFFRONT.ServerFn.make({
  input: Schema.Struct({ after: Schema.Natural }),
  handler: ({ after }) =>
    Effect.succeed(
      Stream.fromIterable(storiesAfter(after)).pipe(
        Stream.mapEffect((story) => Effect.sleep(350).pipe(Effect.as(story))),
      ),
    ),
});
