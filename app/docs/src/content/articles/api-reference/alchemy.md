`@effront/alchemy` は、Alchemy で Effront アプリケーションを Cloudflare Workers 上にホストするためのネイティブ HTTP ハンドラーと Vite アダプターを提供します。

## HTTP ハンドラー {#http}

明示的なソースを渡すヘルパーは `@effront/alchemy/cloudflare` からインポートします。
設定済みアプリケーションを使う引数なしのヘルパーは `@effront/alchemy/cloudflare/application` からインポートします。

| API                                       | 入力                                       | 戻り値                                                        |
| ----------------------------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| `applicationHttpEffect(source)`           | ネイティブなアプリケーションソース Effect  | ネイティブ HTTP ハンドラー Effect                             |
| `makeApplicationHttpEffect(source)`       | ネイティブなアプリケーションソース Effect  | 利用可能な外部サービスを捕捉し、ハンドラーを返す構築用 Effect |
| `makeApplicationHttpEffect<Definition>()` | `effront()` で指定したアプリケーションの型 | Plugin がアプリケーション参照を提供する、同じ構築用 Effect    |

ソースを明示する形式は、公開型 `ApplicationLoader<Services, ApplicationError, Requirements, SourceError = never, SourceRequirements = never>` を受け付けます。

```typescript
import type { ApplicationDefinition } from "@effront/core";
import type { Effect } from "effect";

export type ApplicationLoader<
  Services,
  ApplicationError,
  Requirements,
  SourceError = never,
  SourceRequirements = never,
> = Effect.Effect<
  ApplicationDefinition<Services, ApplicationError, Requirements>,
  SourceError,
  SourceRequirements
>;
```

ソース Effect はハンドラー構築時ではなく、リクエストごとに一度実行されます。
ソースの型付きエラーはハンドラーのエラーチャネルに保持され、サービス要件にはアプリケーションと同じ捕捉とリクエスト優先の規則が適用されます。
静的な定義には `Effect.succeed(application)` を使います。

**設定済みアプリケーション**

`effront()` と `effrontAlchemy()` を使う場合は、アプリケーションを型としてインポートします。
構築時に必要なサービスを提供してから、構築用 Effect を `Cloudflare.Worker` に渡してください。

```typescript
import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare/application";
import { Effect } from "effect";
import type application from "./entry.effront";

const construct = Effect.gen(function* () {
  const fetch = yield* makeApplicationHttpEffect<typeof application>();
  return { fetch: fetch.pipe(Effect.orDie) };
});
```

型インポートは、`effront({ application })` で指定したアプリケーションを参照してください。
既定のエントリーは `./src/entry.effront.tsx` です。
TypeScript は型インポートと Vite 設定の一致までは検証しません。
アプリケーションのモジュールは isolate 初期化時に評価される可能性があるため、モジュール直下では宣言的な定義に留めてください。
アプリケーション Layer はリクエストごとに取得します。
ハンドラーの構築時に、アプリケーションが必要とするサービスを提供してください。

たとえば、Basic Worker は構築時に KV クライアントを提供します。

```typescript
const construct = Effect.gen(function* () {
  const cache = yield* Cloudflare.KV.ReadWriteNamespace(Cache);
  const fetch = yield* makeApplicationHttpEffect<typeof application>().pipe(
    Effect.provideService(CacheClient, cache),
  );
  return { fetch: fetch.pipe(Effect.orDie) };
}).pipe(Effect.provide(Cloudflare.KV.ReadWriteNamespaceBinding));
```

**明示的なソース**

専用の RSC エントリーでは、アプリケーションソース Effect を渡します。

```typescript
import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import { Effect } from "effect";
import application from "./entry.effront";

const construct = Effect.gen(function* () {
  const fetch = yield* makeApplicationHttpEffect(Effect.succeed(application));
  return { fetch: fetch.pipe(Effect.orDie) };
});
```

インフラ構築と共有する Worker エントリーでは設定済みヘルパーを使ってください。
リクエスト処理にはホストの RSC 統合が必要です。
統合がない場合、アダプターは `TypeError` の defect で失敗します。

ハンドラーは成功時にネイティブの `HttpServerResponse` を返し、[ネイティブ HTTP](./http.md) のエラーチャネルを保持します。
Alchemy が受け付けるエラーの union はより狭いため、`fetch` を返す前に残りのソースとアプリケーションのエラーを処理または変換してください。
`Effect.orDie` はその方針の一つであり、必須ではありません。

**捕捉するサービス**

`makeApplicationHttpEffect` は構築時の Context からサービス参照を捕捉します。
`applicationHttpEffect(source)` は構築時のサービスを捕捉せず、ソースとネイティブ HTTP ハンドラーを合成します。
アプリケーションとソースの依存は、通常の `Effect.provideService`、`Effect.provideContext`、または `Effect.provide` で提供してください。
[Basic サンプル](https://github.com/totto2727-org/effront/tree/main/examples/basic) では、KV クライアントを使うアプリケーションサービスを捕捉しています。

- 同じキーのサービスが現在のリクエストにある場合、その値を優先します。
- HTTP サービス、Scope、Layer のメモ化状態、Alchemy の `RuntimeContext`、Worker self、汎用の `Self`、Cloudflare 環境、元の Request、Worker 環境、実行コンテキストは捕捉しません。
- 参照の捕捉はサービスの取得や寿命の延長を行いません。所有者は、それを使うすべてのレスポンスの処理が終わるまで保持する必要があります。
- アプリケーション Layer はリクエストごとに取得します。Alchemy はストリーミングの完了、失敗、キャンセルまでリクエスト Scope を保持します。

Worker と Stack の宣言は [Alchemy のセットアップ](../platforms/alchemy.md) を参照してください。

## effrontAlchemy {#vite}

`@effront/alchemy/cloudflare/vite` の `effrontAlchemy(options?: EffrontAlchemyOptions): PluginOption[]` は、`effront()` より後に登録する必要があります。
正しい順序は次のとおりです。

```typescript
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontAlchemy()],
});
```

> [!WARNING]
> プラグインの順序を逆にすると `TypeError` になります。

| オプション | 型       | 既定値                   | 契約                                                                                                  |
| ---------- | -------- | ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `worker`   | `string` | `./src/entry.workers.ts` | Alchemy Worker を default export するモジュール。Vite root を基準に指定する。空文字列は `TypeError`。 |

このアダプターに `application` オプションはなく、`effront()` の登録も行いません。
アプリケーションエントリーの変更は `effront({ application })` と Worker の型インポート、または明示的なソースのインポートに反映します。
Worker エントリーは `effront({ rsc })` ではなく `effrontAlchemy({ worker })` で選びます。
ブリッジには Alchemy が注入する `ALCHEMY_STACK_NAME` と `ALCHEMY_STAGE` のバインディングが必要です。欠損または空の値は `TypeError` になり、`alchemy dev` から起動する必要があります。
SSR 出力は既定で RSC Worker 成果物の子ディレクトリに配置されます。明示した出力先は保持されますが、Worker 成果物と一緒にパッケージ化してください。

Worker 宣言には `vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } }` が必要です。
`vite.main`、別のランタイムプラグイン、Wrangler 設定は追加しないでください。
開発と本番ビルドのどちらでも、RSC と SSR のサーバーコードからは、インフラの provider factory を含む Node 専用のデプロイ・ローカルホスト用 export を使用できません。
デプロイ時の export には影響しません。
Alchemy は、Vite 単体ではなく `alchemy dev` を通じてホストプラグインとバインディングを提供します。
Alchemy `2.0.0-beta.81` は [ローカル起動](../platforms/alchemy.md#stack) でも設定済み Cloudflare profile を必要とします。
