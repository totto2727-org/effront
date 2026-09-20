`@effront/core/workers` は Web Fetch ハンドラーと、ホストが渡すリクエスト値への型付きアクセスを提供します。

## createFetchHandler {#fetch}

`createFetchHandler(application)` は、Layer の要件を `HttpRouter.HttpRouter` と `HttpServerRequest.HttpServerRequest` で満たせるアプリケーションを受け取ります。
戻り値は `FetchHandler` です。

```typescript
import { createFetchHandler } from "@effront/core/workers";
import application from "./entry.effront";

export default { fetch: createFetchHandler(application) };
```

公開するハンドラーの型は次のとおりです。

```typescript
export type FetchHandler<Env = unknown, ExecutionContext = unknown> = (
  request: Request,
  env: Env,
  executionContext: ExecutionContext,
) => Promise<Response>;
```

`createFetchHandler` はホスト値が `unknown` の既定型を返します。
読み取り関数の型引数で、アプリケーションの Effect 内で使う値の型を指定します。
任意の外部サービスが必要な場合は、[ネイティブ HTTP の捕捉](./http.md#capture) または [Alchemy](./alchemy.md) を使います。

アプリケーション Layer は呼び出しごとに取得します。
Scope はレスポンス本文の完了、失敗、キャンセルまで保持されます。
本文のないレスポンスでは直ちに解放します。

不正な `Content-Length` や 10 MiB を超える値に対しては `413` を返します。
Server Function の POST は、このヘッダーがなくても受信バイト数を 10 MiB に制限します。
`Content-Length` のない独自 HTTP ルートの本文をすべて実測するわけではありません。

## コアの Context 読み取り関数 {#readers}

次の関数は `@effront/core/workers` からインポートします。

| API                                                                          | 戻り値                                                       |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `getWorkersEnv<Env = unknown>()`                                             | `Env` を返す Effect                                          |
| `getWorkersRequestContext<Env = unknown, ExecutionContext = unknown>()`      | `WorkersRequestContext<Env, ExecutionContext>` を返す Effect |
| `createWorkersContextAccessors<Env = unknown, ExecutionContext = unknown>()` | 型引数を固定した上記二つの読み取り関数を持つオブジェクト     |

```typescript
import { createWorkersContextAccessors } from "@effront/core/workers";

type Env = { readonly APP_LABEL: string };
type HostContext = { waitUntil(promise: Promise<unknown>): void };
export const { getWorkersEnv, getWorkersRequestContext } = createWorkersContextAccessors<
  Env,
  HostContext
>();
```

ファクトリーが作るのは読み取り関数であり、サービスや Layer ではありません。
各関数は、実行時のリクエストを読む Effect を返します。
Effect を事前に作っていても同様です。
型付きの失敗やサービス要件はありません。
リクエスト Context がない場合は、`TypeError` の defect になります。
型引数はホストの値を実行時に検証しません。

ホストの値が自動で HTML や Flight にシリアライズされることはありません。
Page で描画した値や ServerFn が返した値はブラウザーに届く場合があります。
秘密情報を含めないでください。

## Cloudflare の Context 読み取り関数 {#cloudflare}

`@effront/cloudflare/workers` は同じ Context を読み、実行コンテキストの型を `CloudflareExecutionContext` に固定します。

| API または型                                     | 契約                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `getWorkersEnv<Env = unknown>()`                 | `Env` を返す Effect                                                    |
| `getWorkersRequestContext<Env = unknown>()`      | `WorkersRequestContext<Env, CloudflareExecutionContext>` を返す Effect |
| `createWorkersContextAccessors<Env = unknown>()` | 共通の `Env` 型を持つ二つの読み取り関数                                |
| `CloudflareExecutionContext`                     | `{ waitUntil(promise: Promise<unknown>): void }`                       |

実行、Context 不在、実行時検証に関する契約はコアの読み取り関数と同じです。

## WorkersRequestContext {#context}

`@effront/core/workers` の `WorkersRequestContext` は、型と Effect の `Context.Reference` 値の両方を公開します。
参照は `WorkersRequestContext<unknown, unknown>` を保持し、値が提供されない場合は既定で `TypeError` を送出します。

| readonly フィールド | 型                 | 値                               |
| ------------------- | ------------------ | -------------------------------- |
| `env`               | `Env`              | ホストの環境変数とバインディング |
| `executionContext`  | `ExecutionContext` | ホストの実行コンテキスト         |
| `request`           | `Request`          | 元の Web Request                 |

`createFetchHandler` は、ホストから受け取ったこれらの値を、リクエストごとに分けて提供します。
