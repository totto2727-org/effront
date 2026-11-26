import { Array, Data, Effect, Predicate } from "effect";

import { bodyReadError } from "./server-fn-request-error.ts";
import type { ServerFnRequestError } from "./server-fn-request-error.ts";

const mebibyte = 1_048_576;
const maxBodyMebibytes = 10;
const maxBodyBytes = maxBodyMebibytes * mebibyte;
const bodyStart = 0;
const readErrorMessage = "Failed to read the Server Function request body.";

class ServerFnBodyLimitExceeded extends Data.TaggedError("ServerFnBodyLimitExceeded")<{
  message: string;
}> {}

interface BodyRead {
  bytes: number;
  chunks: Uint8Array[];
}

const assembleBody = ({ bytes, chunks }: BodyRead): Uint8Array<ArrayBuffer> => {
  const buffer = new Uint8Array(bytes);
  Array.reduce(chunks, bodyStart, (offset, chunk) => {
    buffer.set(chunk, offset);
    return offset + chunk.byteLength;
  });
  return buffer;
};

const readChunks = (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  state: BodyRead,
): Effect.Effect<Uint8Array<ArrayBuffer>, ServerFnRequestError> =>
  Effect.tryPromise({
    catch: (cause) => bodyReadError(readErrorMessage, cause),
    try: async () => reader.read(),
  }).pipe(
    Effect.flatMap((chunk) => {
      if (chunk.done) {
        return Effect.succeed(assembleBody(state));
      }
      const bytes = state.bytes + chunk.value.byteLength;
      if (bytes > maxBodyBytes) {
        return Effect.fail(
          bodyReadError(
            "The Server Function request body exceeds the 10 MiB limit.",
            new ServerFnBodyLimitExceeded({
              message: "Server Function request body limit exceeded.",
            }),
          ),
        );
      }
      state.chunks.push(chunk.value);
      return readChunks(reader, { bytes, chunks: state.chunks });
    }),
  );

const readBodyBytes = (
  request: Request,
): Effect.Effect<Uint8Array<ArrayBuffer>, ServerFnRequestError> => {
  const { body } = request;
  if (Predicate.isNullish(body)) {
    return Effect.succeed(new Uint8Array());
  }
  return Effect.acquireUseRelease(
    Effect.sync(() => body.getReader()),
    (reader) => readChunks(reader, { bytes: 0, chunks: [] }),
    (reader) =>
      Effect.sync(() => {
        reader.releaseLock();
      }),
  );
};

export const readServerFnBody = Effect.fnUntraced(function* (request: Request) {
  const bytes = yield* readBodyBytes(request);
  const replay = new Request(request, { body: bytes, method: request.method });
  const contentType = request.headers.get("content-type") ?? "";
  return yield* Effect.tryPromise({
    catch: (cause) => bodyReadError(readErrorMessage, cause),
    try: async () =>
      contentType.toLowerCase().startsWith("multipart/form-data")
        ? replay.formData()
        : replay.text(),
  });
});
