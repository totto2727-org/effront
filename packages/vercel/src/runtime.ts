import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { Effect, Exit, Layer, Scope } from "effect";
import type { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

type Application = Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  unknown,
  | HttpServerRequest.HttpServerRequest
  | Scope.Scope
  | Layer.Success<typeof NodeHttpServer.layerHttpServices>
>;

/** Keeps the host services alive across warm invocations, without opening a listener. */
export const createHandler = async (application: Application) => {
  const scope = await Effect.runPromise(Scope.make());
  let closing: Promise<void> | undefined;
  const close = () => (closing ??= Effect.runPromise(Scope.close(scope, Exit.void)));
  try {
    const context = await Effect.runPromise(
      Layer.buildWithScope(NodeHttpServer.layerHttpServices, scope),
    );
    const handler = await Effect.runPromise(
      NodeHttpServer.makeHandler(application, { scope }).pipe(Effect.provideContext(context)),
    );
    return { handler, close };
  } catch (error) {
    await close();
    throw error;
  }
};
