import { Schema } from "effect";

export const badRequest = 400;
export const forbidden = 403;
export const internalServerError = 500;

// oxlint-disable-next-line unicorn/throw-new-error -- Effect's schema error builder supplies the base class.
export class ServerFnRequestError extends Schema.TaggedError<ServerFnRequestError>()(
  "ServerFnRequestError",
  {
    cause: Schema.Defect(),
    message: Schema.String,
    status: Schema.Literals([badRequest, forbidden, internalServerError]),
  },
) {}

export const requestError = (
  message: string,
  status: ServerFnRequestError["status"],
  cause: unknown,
): ServerFnRequestError => new ServerFnRequestError({ cause, message, status });

export const bodyReadError = (message: string, cause: unknown): ServerFnRequestError =>
  requestError(message, badRequest, cause);
