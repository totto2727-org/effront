## createFetchHandler {#fetch}

```typescript
import { createFetchHandler } from "@effront/core/workers";
import application from "./entry.effront";

export default { fetch: createFetchHandler(application) };
```

`createFetchHandler(application)` は `EFFRONT.make` の戻り値を受け取り、次の公開型のハンドラーを返します。現在の関数の戻り値は既定の `FetchHandler` で、Env と ExecutionContext は unknown です。

```typescript
export type FetchHandler<Env = unknown, ExecutionContext = unknown> = (
  request: Request,
  env: Env,
  executionContext: ExecutionContext,
) => Promise<Response>;
```

アプリケーション Layer はリクエストごとに構築され、レスポンス body の完了・エラー・キャンセルまで Scope を保持します。body がないレスポンスではすぐ解放します。Fetch の入口では Content-Length を検査し、10 MiB を超える値や不正な値を 413 で拒否します。Server Function の POST は、Content-Length の有無にかかわらず受信 body の実サイズにも 10 MiB の上限を適用します。Content-Length がない独自 HTTP ルートの body を、この入口が一律に実測制限するわけではありません。

## WorkersRequestContext {#context}

```typescript
import { WorkersRequestContext } from "@effront/core/workers";
// 同名の型も公開されています。
// WorkersRequestContext<Env, ExecutionContext>
//   readonly env: Env
//   readonly executionContext: ExecutionContext
//   readonly request: Request
```

値としての `WorkersRequestContext` は Effect の Context.Reference で、型は `WorkersRequestContext<unknown, unknown>` です。
Fetch ハンドラーが供給します。
Context が提供されていない場所で読むと `TypeError` になります。

## コアの reader {#readers}

| API / 項目                                                                   | 契約                                                                                                         |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `createWorkersContextAccessors<Env = unknown, ExecutionContext = unknown>()` | 型を固定した getWorkersEnv と getWorkersRequestContext の組を返します。新たなサービスや Layer は作りません。 |
| `getWorkersEnv<Env = unknown>()`                                             | Effect で現在の env を返します。                                                                             |
| `getWorkersRequestContext<Env = unknown, ExecutionContext = unknown>()`      | Effect で現在の env・executionContext・request を返します。                                                  |

```typescript
import { createWorkersContextAccessors } from "@effront/core/workers";

type Env = { readonly APP_LABEL: string };
type HostContext = { waitUntil(promise: Promise<unknown>): void };
export const { getWorkersEnv, getWorkersRequestContext } = createWorkersContextAccessors<
  Env,
  HostContext
>();
```

reader のジェネリックはホストが渡す値の型を指定するもので、実行時検証は行いません。reader が返す Effect は Page・Middleware・アプリケーション Layer の構築など、Fetch リクエストの Context がある場所で実行します。

## Cloudflare の reader {#cloudflare}

```typescript
import { Effect } from "effect";
import { createWorkersContextAccessors } from "@effront/cloudflare/workers";

type Env = { readonly APP_LABEL: string };
const { getWorkersEnv, getWorkersRequestContext } = createWorkersContextAccessors<Env>();

export const readLabel = Effect.gen(function* () {
  const env = yield* getWorkersEnv();
  const { executionContext } = yield* getWorkersRequestContext();
  executionContext.waitUntil(Promise.resolve());
  return env.APP_LABEL;
});
```

| API / 項目                                       | 契約                                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `CloudflareExecutionContext`                     | waitUntil(promise: Promise&lt;unknown&gt;): void を持つ、公開された最小の実行コンテキスト型。 |
| `createWorkersContextAccessors<Env = unknown>()` | コアの accessor の ExecutionContext を CloudflareExecutionContext に固定します。              |
| `getWorkersEnv<Env = unknown>()`                 | 現在の env を返す Effect。                                                                    |
| `getWorkersRequestContext<Env = unknown>()`      | WorkersRequestContext&lt;Env, CloudflareExecutionContext&gt; を返す Effect。                  |

Cloudflare 版もコアと同じリクエスト Context を読みます。env は自動的に HTML や Flight に含まれませんが、描画結果や ServerFn の戻り値へ入れた値はブラウザーへ届きます。公開してよい値だけを明示的に返してください。
