`@effront/server` は Node.js と Bun 向けに、ネイティブ Effect HTTP ホストと静的ファイル配信を提供します。
インストールと起動ファイルは [Node.js / Bun](../platforms/node-bun.md) を参照してください。

## effrontServer {#vite}

`@effront/server/vite` の `effrontServer(options?: EffrontServerOptions): Plugin` は、Vite の開発・プレビューにネイティブハンドラーを接続し、別の本番起動用エントリーをビルドします。
`effront()` より後に登録する必要があります。

```typescript
import { effront } from "@effront/vite";
import { effrontServer } from "@effront/server/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontServer()],
});
```

| オプション        | 既定値                  | エントリーの契約                                                                                 |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------------------------ |
| `rsc?: string`    | `./src/entry.rsc.ts`    | `toHttpEffect(application)` などのネイティブ HTTP Effect を `handler` として名前付き export する |
| `server?: string` | `./src/entry.server.ts` | `serve` を起動する本番用コード                                                                   |

エントリーに空文字列を指定すると `TypeError` になります。
RSC エントリーは `if (import.meta.hot) import.meta.hot.accept();` で HMR を受け入れます。

開発とプレビューは、Node 互換ミドルウェアを通じて Vite のリスナーを使い、本番起動用エントリーは使いません。
そのため `serve` のオプションでは Vite のポートやホスト名は変わりません。
本番で Bun を使う場合も `@effect/platform-node` が必要です。
Bun 固有の実行時動作を確認するには、Vite プレビューではなく、通常は `bun dist/rsc/server.js` でビルド済み本番エントリーを実行します。

## serve {#serve}

`serve(handler, options)` は、スコープで管理するサーバー Layer を返します。
`handler` は `HttpServerResponse` を返す `Effect` であり、Fetch 関数ではありません。
`Layer.launch` と対応するプラットフォーム Runtime で Layer を起動します。

| ランタイム | `serve` のインポート先 | Runtime                                          |
| ---------- | ---------------------- | ------------------------------------------------ |
| Node.js    | `@effront/server/node` | `@effect/platform-node` の `NodeRuntime.runMain` |
| Bun        | `@effront/server/bun`  | `@effect/platform-bun` の `BunRuntime.runMain`   |

| `ServeOptions` のフィールド | 契約                                   |
| --------------------------- | -------------------------------------- |
| `assets`                    | 必須の `AssetOptions`。下記参照。      |
| `port`                      | 省略可能な数値。既定値 `3000`。        |
| `hostname`                  | 省略可能な文字列。既定値 `127.0.0.1`。 |

起動前に、残りのアプリケーションサービス Layer を提供します。
[Node.js の起動例](../platforms/node-bun.md#node) を参照してください。
既定のアドレスはローカル接続だけを受け付けます。
`0.0.0.0` などのアドレスは、他のマシンにもリスナーを公開します。
Bun のサーバーは、リクエスト本文に 10 MiB の上限も適用します。

## withAssets {#assets}

`@effront/server/assets` の `withAssets(handler, options)` は、静的ファイルを配信するハンドラーを構築します。
`serve` は `assets` オプションを使って、これを適用済みです。

| `AssetOptions` のフィールド | 契約                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `client.root`               | 必須のブラウザー出力専用ディレクトリ                                                       |
| `client.prefix`             | `/assets/` など、`/` 以外の必須の絶対 URL 接頭辞                                           |
| `client.cacheControl`       | 省略可能なクライアント用 `Cache-Control` 値                                                |
| `public.root`               | 任意の `public` マウントを設定する場合に必須のディレクトリ。URL 接頭辞を追加せずに配信する |
| `public.cacheControl`       | 省略可能な public 用 `Cache-Control` 値                                                    |

どちらのキャッシュポリシーも、既定値は `public, max-age=0, must-revalidate` です。
`public, max-age=31536000, immutable` は、ハッシュ付きファイル名だけに使用してください。
接頭辞が `/assets/` の場合、`/assets/app.js` は `client.root` 内の `app.js` を検索します。
Vite の出力や `base` を変更した場合、実際の出力ディレクトリと URL にマウント設定を合わせる必要があります。

| リクエスト                                                             | 結果                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------- |
| クライアント接頭辞内の `GET` または `HEAD`                             | ファイルレスポンス。ファイルがなければ 404        |
| public ファイルに一致する `GET` または `HEAD`                          | ファイルレスポンス                                |
| public に該当なし、またはその他のメソッド                              | アプリケーションハンドラー                        |
| クライアント接頭辞外の Flight、Server Function、`/_effront` リクエスト | public の検索を省略し、アプリケーションハンドラー |

ディレクトリの index や SPA フォールバックはありません。
それ以外のファイルシステム障害は型付き HTTP エラーとして残ります。
ルートディレクトリの確認は起動時ではなく、リクエスト時に行います。
信頼できるディレクトリを配備し、シンボリックリンクを管理してください。
Effront は Effect の `HttpStaticServer` のパス処理に加えてシンボリックリンクの範囲制限を行いません。

既存の Effect HTTP サーバーでは、構築時に `yield* withAssets(handler, options)` でハンドラーを取得します。
外側の構築用 Effect をリクエストハンドラーとして渡さないでください。

| 段階       | 成功                        | エラー                                     | 必要なサービス                       |
| ---------- | --------------------------- | ------------------------------------------ | ------------------------------------ |
| 構築       | リクエストハンドラー Effect | `PlatformError`                            | `FileSystem.FileSystem`、`Path.Path` |
| リクエスト | `HttpServerResponse`        | 元のハンドラーのエラーと `HttpServerError` | 元の要件と `HttpServerRequest`       |

ホストはリクエスト Scope を所有し、レスポンス本文を消費またはキャンセルする必要があります。
MIME 型、weak ETag、条件付きリクエスト、Range は Effect `4.0.0-rc.112` に従います。

| 条件                                     | 動作                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| `HEAD` または条件付き `304`              | ファイルストリームを取得しない                                             |
| 満たせる単一バイト範囲                   | `206`                                                                      |
| 複数範囲、未対応形式、安全な整数の範囲外 | Range を無視                                                               |
| 有効だが満たせない単一範囲               | `Content-Range` 付きの `416`。アセットのキャッシュ・validator ヘッダーなし |
| `If-Range`                               | 無視                                                                       |
| `HEAD` の `Range`                        | 評価する。本文なしで `206` または `416` になる場合がある                   |

呼び出し側が提供する `HttpPlatform` や ETag サービスは、アセットレスポンスに影響しません。
