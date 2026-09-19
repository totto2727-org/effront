Effront アプリケーションを Fetch ホストに接続し、アプリケーションの Effect からそのリクエストのバインディングを取得できます。
このページの API は、ホストの値を受け取るハンドラーと、その値を Page・Middleware・アプリケーションのサービスから読む reader を提供します。

- ホストの入口を実装するには、[`createFetchHandler`](#fetch) を使います。
- バインディングや元のリクエストを読むには、[コアの reader](#readers) を選びます。
- Cloudflare では、[Cloudflare の reader](#cloudflare) を使うと `Env` の型だけを指定できます。

## createFetchHandler でアプリケーションを接続する {#fetch}

`@effront/core/workers` から `createFetchHandler` をインポートし、`EFFRONT.make` が返したアプリケーションを渡します。
戻り値はホストの `fetch` に設定できます。

```typescript
import { createFetchHandler } from "@effront/core/workers";
import application from "./entry.effront";

export default { fetch: createFetchHandler(application) };
```

アプリケーション Layer の要件は、`HttpRouter.HttpRouter` と `HttpServerRequest.HttpServerRequest` で満たせる必要があります。
それ以外の外部ホストサービスが必要な場合は、[native HTTP と `makeHttpEffect`](./http.md#capture) または [Alchemy 連携](./alchemy.md) を使ってください。

ホストは呼び出しごとに Web `Request`、環境のバインディング、実行コンテキストを渡します。
ハンドラーはそのリクエストに対してアプリケーションを実行し、`Promise<Response>` を返します。
対応する公開型は次のとおりです。

```typescript
export type FetchHandler<Env = unknown, ExecutionContext = unknown> = (
  request: Request,
  env: Env,
  executionContext: ExecutionContext,
) => Promise<Response>;
```

`createFetchHandler` は既定の `FetchHandler` を返すため、ホスト固有の 2 つの型はどちらも `unknown` です。
アプリケーションでホストの値を使う際は、reader でこれらの型を指定します。

**レスポンスのライフタイム。**
アプリケーション Layer はリクエストごとに個別に構築されます。
その Scope は、レスポンス body が完了・エラー・キャンセルするまで保持されます。
body のないレスポンスではすぐに解放されます。
そのため、ストリーミングする `Response` を返しても、body の生成に使うリソースのライフタイムは終了しません。

**リクエスト body の上限。**
入口では `Content-Length` を検査し、不正な値や 10 MiB を超える値に対して `413` を返します。
Server Function の POST リクエストには、このヘッダーがなくても、実際に受信したバイト数に 10 MiB の上限が適用されます。
ヘッダーの検査を、あらゆる body に適用されるサイズ制限とは考えないでください。
この入口は、`Content-Length` のない独自 HTTP ルートの body をすべて実測するわけではありません。

## 必要な値に応じてコアの reader を選ぶ {#readers}

reader は `@effront/core/workers` からインポートします。
環境変数やバインディングには `getWorkersEnv` を、元の Request やホストの実行コンテキストも必要な場合には `getWorkersRequestContext` を使います。

| API                                                                          | 結果                                                                                                       |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `getWorkersEnv<Env = unknown>()`                                             | 現在の `Env` を返す Effect。                                                                               |
| `getWorkersRequestContext<Env = unknown, ExecutionContext = unknown>()`      | `env`・`executionContext`・`request` を含む `WorkersRequestContext<Env, ExecutionContext>` を返す Effect。 |
| `createWorkersContextAccessors<Env = unknown, ExecutionContext = unknown>()` | 指定した型の `getWorkersEnv` と `getWorkersRequestContext` の組。                                          |

複数のモジュールで同じバインディングの型を使うなら、reader の組を一度定義してエクスポートします。

```typescript
import { createWorkersContextAccessors } from "@effront/core/workers";

type Env = { readonly APP_LABEL: string };
type HostContext = { waitUntil(promise: Promise<unknown>): void };
export const { getWorkersEnv, getWorkersRequestContext } = createWorkersContextAccessors<
  Env,
  HostContext
>();
```

このファクトリーが作るのは reader 関数であり、新しいサービスや Layer ではありません。
reader の呼び出しは Effect を作ります。
その Effect を実行すると、現在のリクエストの値を読み取ります。
たとえば、Fetch リクエストの処理中に、Page・Middleware・アプリケーション Layer の構築で `yield* getWorkersEnv()` を使います。
リクエストの Context が提供されていない場所で読むと `TypeError` になります。

型引数はホストが提供する値を表すもので、実行時検証は行いません。
ホストのバインディングと実行コンテキストに一致する型を指定してください。
ホストの値が自動的に HTML や Flight へシリアライズされることはありませんが、描画する値や ServerFn から返す値はブラウザーに届きます。
reader の型を通じてサーバーコードから秘密情報を取得できても、その情報をこれらの出力には含めないでください。

## Env の型を指定して Cloudflare の reader を使う {#cloudflare}

Cloudflare では、対応する reader を `@effront/cloudflare/workers` からインポートします。
コアの reader と同じリクエスト Context を読みますが、実行コンテキストの型が `CloudflareExecutionContext` に固定されるため、型引数は `Env` だけで済みます。

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

`readLabel` は Fetch リクエストの処理中に `APP_LABEL` を読み、渡された実行コンテキストの `waitUntil` を呼び出す例です。
コアの reader を使う Effect と同じく、リクエストの Context がある場所で実行してください。

| API / 型                                         | 結果・契約                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| `getWorkersEnv<Env = unknown>()`                 | `Env` を返す Effect。                                                    |
| `getWorkersRequestContext<Env = unknown>()`      | `WorkersRequestContext<Env, CloudflareExecutionContext>` を返す Effect。 |
| `createWorkersContextAccessors<Env = unknown>()` | 同じ `Env` 型を使う、上記 2 つの reader の組。                           |
| `CloudflareExecutionContext`                     | `waitUntil(promise: Promise<unknown>): void` を公開する最小の型。        |

これらは型付きの reader であり、検証機能や別のバインディング供給元ではありません。
Context がない場合の挙動、実行時検証、ブラウザーに届く出力については、コアの reader と同じルールが適用されます。

## 共有する WorkersRequestContext を確認する {#context}

個々の reader ではなく、読み取り元の Context の値や型が必要なときに参照してください。
`createFetchHandler` は、ホストから渡された値を含む `WorkersRequestContext` を 1 つ供給します。

| フィールド         | 型                 | 値                                               |
| ------------------ | ------------------ | ------------------------------------------------ |
| `env`              | `Env`              | ホストの環境変数やバインディング。               |
| `executionContext` | `ExecutionContext` | このリクエストに対するホストの実行コンテキスト。 |
| `request`          | `Request`          | 元の Web Request。                               |

このモジュールは `WorkersRequestContext` という名前の型と値を両方エクスポートします。

```typescript
import { WorkersRequestContext } from "@effront/core/workers";
// 同名の型も公開されています。
// WorkersRequestContext<Env, ExecutionContext>
//   readonly env: Env
//   readonly executionContext: ExecutionContext
//   readonly request: Request
```

値としての `WorkersRequestContext` は、`WorkersRequestContext<unknown, unknown>` に対する Effect の `Context.Reference` です。
コアと Cloudflare の reader は、別のリクエスト Context を構築するのではなく、この同じ参照を読みます。
値が提供されていなければ既定の挙動として `TypeError` を投げるため、参照を直接読む場合にも、reader を使う場合と同じくリクエストの Context が必要です。
