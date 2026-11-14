import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { makeEFFRONTIdentity } from "../application/effront-identity";
import { decodeServerFnCall } from "./server-fn-request";

const protocol = vi.hoisted(() => ({
  createTemporaryReferenceSet: vi.fn(() => new Map()),
  decodeReply: vi.fn(async (_body: string | FormData, _options: unknown): Promise<unknown> => []),
  loadServerAction: vi.fn(
    async () =>
      (...args: ReadonlyArray<unknown>) =>
        args.length,
  ),
}));

vi.mock("@vitejs/plugin-rsc/rsc/server", () => ({
  ...protocol,
  decodeAction: vi.fn(),
  decodeFormState: vi.fn(),
}));

const decode = (request: Request) =>
  decodeServerFnCall(request, "action", makeEFFRONTIdentity<never>());

beforeEach(() => vi.clearAllMocks());

describe("Server Function request body transport", () => {
  it("forwards text beyond the former body limit without imposing decoder limits", async () => {
    const body = "x".repeat(10 * 1024 * 1024 + 1);
    const args = Array.from({ length: 10_001 }, (_, position) => position);
    protocol.decodeReply.mockResolvedValueOnce(args);
    const request = new Request("https://example.test/action", { method: "POST", body });
    const prepared = await Effect.runPromise(decode(request));
    expect(request.bodyUsed).toBe(true);
    expect(protocol.decodeReply).toHaveBeenCalledWith(body, {
      temporaryReferences: protocol.createTemporaryReferenceSet.mock.results[0]!.value,
    });
    await expect(Effect.runPromise(prepared.operation.effect)).resolves.toBe(args.length);
  });

  it("forwards native multipart form data without reconstructing the request", async () => {
    const body = new FormData();
    body.set("message", "hello");
    body.set("upload", new Blob(["file contents"]), "example.txt");
    const request = new Request("https://example.test/action", { method: "POST", body });
    await Effect.runPromise(decode(request));
    const forwarded = protocol.decodeReply.mock.calls[0]![0];
    expect(forwarded).toBeInstanceOf(FormData);
    if (!(forwarded instanceof FormData)) throw new Error("Expected native FormData.");
    expect(forwarded.get("message")).toBe("hello");
    const upload = forwarded.get("upload");
    if (!(upload instanceof File)) throw new Error("Expected uploaded File.");
    expect(await upload.text()).toBe("file contents");
    expect(request.bodyUsed).toBe(true);
  });

  it("retains typed body read failures and does not invoke the decoder", async () => {
    const request = new Request("https://example.test/action", { method: "POST", body: "used" });
    await request.text();
    const failure = await Effect.runPromise(Effect.flip(decode(request)));
    expect(failure).toMatchObject({
      _tag: "ServerFnRequestError",
      status: 400,
      message: "Failed to read the Server Function request body.",
    });
    expect(protocol.decodeReply).not.toHaveBeenCalled();
  });
});
