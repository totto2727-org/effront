import type { ReadWriteNamespaceClient } from "alchemy/Cloudflare/KV";
import { WorkerEnvironment } from "alchemy/Cloudflare/Workers";
import { Effect, Stream } from "effect";
import * as Request from "effect/unstable/http/HttpServerRequest";
import * as Response from "effect/unstable/http/HttpServerResponse";
import { value as seed } from "@effront-test/optimizer-a";

const isolate = globalThis as typeof globalThis & { __effrontTestNonce?: string };
const nonce = (isolate.__effrontTestNonce ??= crypto.randomUUID());

export const withDiagnostics = <E, R>(
  application: Effect.Effect<Response.HttpServerResponse, E, R>,
  cache: ReadWriteNamespaceClient,
) =>
  Effect.gen(function* () {
    const request = yield* Request.HttpServerRequest;
    const url = new URL(request.url, "http://worker.test");
    const env = yield* WorkerEnvironment;
    const ledger: { fetch(request: globalThis.Request): Promise<globalThis.Response> } =
      env["TestLedger"];
    const pending = (id: string) =>
      Effect.promise(() =>
        ledger.fetch(
          new globalThis.Request(`http://ledger.test/record?id=${id}`, { method: "POST" }),
        ),
      );
    if (url.pathname === "/__test/nonce") {
      return Response.jsonUnsafe({ nonce, seed });
    }
    if (url.pathname === "/__test/kv") {
      const id = url.searchParams.get("id") ?? "missing";
      if (request.method === "POST") yield* cache.put(`restart:${id}`, id);
      return Response.jsonUnsafe({ value: yield* cache.get(`restart:${id}`) });
    }
    if (url.pathname === "/__test/inflight") {
      // The host ledger records the side effect before holding its HTTP response.
      // Keep real external I/O pending: workerd rejects an idle Effect.never as hung.
      yield* pending(url.searchParams.get("id") ?? "missing");
      return Response.empty();
    }
    if (url.pathname === "/__test/stream") {
      return Response.stream(
        Stream.concat(
          Stream.make(new TextEncoder().encode(`${nonce}\n`)),
          Stream.fromEffect(pending(`stream-${nonce}`)).pipe(Stream.map(() => new Uint8Array())),
        ),
        { contentType: "text/plain" },
      );
    }
    if (url.pathname === "/__test/dependency") {
      const entry = "/src/late-dependency.ts";
      const dependency: { value: string } = yield* Effect.promise(
        () => import(/* @vite-ignore */ entry),
      );
      return Response.jsonUnsafe({ nonce, value: dependency.value });
    }
    return yield* application;
  });
