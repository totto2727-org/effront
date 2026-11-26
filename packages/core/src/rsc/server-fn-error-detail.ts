import { Predicate, Schema } from "effect";

export const ServerFnErrorDetailSchema = Schema.Struct({
  message: Schema.String,
  name: Schema.String,
  stack: Schema.NullOr(Schema.String),
});
type ServerFnErrorDetail = typeof ServerFnErrorDetailSchema.Type;

// oxlint-disable-next-line unicorn/no-null -- The published Flight error schema represents an absent stack with null.
const absentStack = null;

export const serverFnErrorDetail = (value: unknown): ServerFnErrorDetail =>
  Predicate.isError(value)
    ? { message: value.message, name: value.name, stack: value.stack ?? absentStack }
    : { message: String(value), name: "Error", stack: absentStack };
