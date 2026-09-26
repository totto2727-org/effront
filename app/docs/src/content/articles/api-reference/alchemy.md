`@effront/alchemy` は、Alchemy で Effront アプリケーションを Cloudflare Workers 上にホストするためのネイティブ HTTP ハンドラーと Vite アダプターを提供します。

## HTTP ハンドラー {#http}

| API                                          | 入力                                                              | 戻り値                                                        |
| -------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| `applicationHttpEffect(load, { context? }?)` | 遅延アプリケーションローダーと、省略可能な捕捉済み Effect Context | ネイティブ HTTP ハンドラー Effect                             |
| `makeApplicationHttpEffect(load)`            | 遅延アプリケーションローダー                                      | 利用可能な外部サービスを捕捉し、ハンドラーを返す構築用 Effect |

どちらも、公開型 `ApplicationLoader<Services, ApplicationError, Requirements>` を受け付けます。

```typescript
import type { ApplicationDefinition } from "@effront/core";

export type ApplicationLoader<Services, ApplicationError, Requirements> = () => Promise<
  ApplicationDefinition<Services, ApplicationError, Requirements>
>;
```

ローダーはリクエスト処理中に実行されます。
動的インポートはローダーの中に置いてください。
Worker モジュールから静的にインポートすると、インフラ構築時にアプリケーションを評価してしまいます。

構築時の追加サービスが不要なら、次の構築用 Effect を `Cloudflare.Worker` の第 3 引数に渡せます。

```typescript
import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import { Effect } from "effect";

const construct = Effect.gen(function* () {
  const fetch = yield* makeApplicationHttpEffect(() =>
    import("./entry.effront").then((module) => module.default),
  );
  return { fetch: fetch.pipe(Effect.orDie) };
});
```

ハンドラーは成功時にネイティブの `HttpServerResponse` を返し、[ネイティブ HTTP](./http.md) のエラーチャネルを保持します。
Alchemy が受け付けるエラーの union はより狭いため、`fetch` を返す前に残りのアプリケーションエラーを処理または変換してください。
`Effect.orDie` はその方針の一つであり、必須ではありません。

**捕捉するサービス**

`makeApplicationHttpEffect` は構築時の Context からサービス参照を捕捉します。
`applicationHttpEffect` は明示的な `context` オプションを使い、既定値は空の Context です。
[Basic サンプル](https://github.com/totto2727-org/effront/tree/main/examples/basic) では、KV クライアントを使うアプリケーションサービスを捕捉しています。

- 同じキーのサービスが現在のリクエストにある場合、その値を優先します。
- HTTP サービス、Scope、Layer のメモ化状態、Alchemy の `RuntimeContext`、Worker self、汎用の `Self`、Cloudflare 環境、元の Request、Worker 環境、実行コンテキストは捕捉しません。
- 参照の捕捉はサービスの取得や寿命の延長を行いません。所有者は、それを使うすべてのレスポンスの処理が終わるまで保持する必要があります。
- アプリケーション Layer はリクエストごとに取得します。Alchemy はストリーミングの完了、失敗、キャンセルまでリクエスト Scope を保持します。
- 構築時の Context を絞り込んでも、名前付きのアプリケーション capability を含む明示的なホスト外サービスの要件は残ります。アプリケーション Layer または捕捉する外部 Context から提供してください。

Worker と Stack の宣言は [Alchemy のセットアップ](../platforms/alchemy.md) を参照してください。

## effrontAlchemy {#vite}

`@effront/alchemy/cloudflare/vite` の `effrontAlchemy(options?: EffrontAlchemyOptions): PluginOption[]` は、`effront()` より後に登録する必要があります。
プラグインの順序を逆にすると `TypeError` になります。正しい順序は次のとおりです。

```typescript
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontAlchemy()],
});
```

| オプション | 型       | 既定値                   | 契約                                                                                                  |
| ---------- | -------- | ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `worker`   | `string` | `./src/entry.workers.ts` | Alchemy Worker を default export するモジュール。Vite root を基準に指定する。空文字列は `TypeError`。 |

このアダプターに `application` オプションはなく、`effront()` の登録も行いません。
アプリケーションエントリーの変更は `effront({ application })` と Worker のローダー内インポートに反映します。
Worker エントリーは `effront({ rsc })` ではなく `effrontAlchemy({ worker })` で選びます。
ブリッジには Alchemy が注入する `ALCHEMY_STACK_NAME` と `ALCHEMY_STAGE` のバインディングが必要です。欠損または空の値は `TypeError` になり、`alchemy dev` から起動する必要があります。
SSR 出力は既定で RSC Worker 成果物の子ディレクトリに配置されます。明示した出力先は保持されますが、Worker 成果物と一緒にパッケージ化してください。

Worker 宣言には `vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } }` が必要です。
`vite.main`、別のランタイムプラグイン、Wrangler 設定は追加しないでください。
開発中のサーバーコードからは、インフラの provider factory を含む Node 専用のデプロイ・ローカルホスト用 export を使用できません。デプロイ時の export と本番ビルドには影響しません。
Alchemy は、Vite 単体ではなく `alchemy dev` を通じてホストプラグインとバインディングを提供します。
Alchemy `2.0.0-beta.79` は [ローカル起動](../platforms/alchemy.md#stack) でも設定済み Cloudflare profile を必要とします。
