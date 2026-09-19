`@effront/server` を使うと、Effront アプリケーションとブラウザー向けアセットを Node.js / Bun で配信できます。
このリファレンスでは、Vite がビルドするエントリー、本番用リスナーの起動方法、静的ファイルの検索設定を説明します。
インストールとアプリケーション全体の構成は [Node.js / Bun ガイド](../platforms/node-bun.md) を参照してください。

## Vite のエントリー: effrontServer {#vite}

`@effront/server/vite` の `effrontServer(options?)` は、アプリケーションの native Effect HTTP handler を Vite に接続し、それとは別の本番起動用モジュールをビルド対象に加えます。
`effront()` の後に登録します。

```typescript
import { effront } from "@effront/vite";
import { effrontServer } from "@effront/server/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontServer()],
});
```

既定の設定では、次の 2 つのエントリーを用意します。

| オプション | 既定値                | エントリーに記述する内容                                                     |
| ---------- | --------------------- | ---------------------------------------------------------------------------- |
| `rsc`      | `src/entry.rsc.ts`    | `HttpServerResponse` を返す Effect を、名前付きの `handler` として公開します |
| `server`   | `src/entry.server.ts` | `serve`、`Layer.launch`、対象プラットフォームの Runtime を使う本番起動処理   |

RSC エントリーでは、`src/entry.effront.tsx` のアプリケーション定義を使い、`toHttpEffect(application)` で `handler` を作れます。
このエントリーに `if (import.meta.hot) import.meta.hot.accept();` を記述し、HMR の更新を受け入れます。
別のファイルを使う場合は、`rsc` または `server` にそのパスを指定してください。

開発とプレビューでは、Node 互換ミドルウェアを通じて Vite の既存リスナーに handler を接続します。
本番起動用エントリーは実行しないため、そこに記述したリスナー設定では Vite のポートやホスト名は変わりません。
本番で Bun を使う場合も、このプラグインには `@effect/platform-node` が必要です。
Bun 固有の動作を確認するときは、Vite のプレビューではなく、ビルド済みの本番用エントリーを `bun dist/rsc/server.js` で実行してください。

## 本番用リスナー: serve {#serve}

本番起動用エントリーで `serve(handler, options)` を使うと、アプリケーションと静的ファイルを配信できます。
本番で使うランタイムに合わせて、インポート先を選びます。

| ランタイム | `serve` のインポート先 | 起動する Layer の実行方法                        |
| ---------- | ---------------------- | ------------------------------------------------ |
| Node.js    | `@effront/server/node` | `@effect/platform-node` の `NodeRuntime.runMain` |
| Bun        | `@effront/server/bun`  | `@effect/platform-bun` の `BunRuntime.runMain`   |

`handler` は上で説明した native Effect HTTP handler であり、Fetch 形式の関数ではありません。
`serve` はスコープで管理される Layer を返すので、`Layer.launch` に渡し、選んだ Runtime の `runMain` で実行します。
handler がアプリケーション独自のサービスを要求する場合は、起動前にそのサービスの Layer も提供してください。
全体の組み合わせ方は [Node.js の起動例](../platforms/node-bun.md#node) を参照してください。

| オプション | 必須   | 既定値または用途               |
| ---------- | ------ | ------------------------------ |
| `assets`   | はい   | 下で説明する静的ファイルの設定 |
| `port`     | いいえ | `3000`                         |
| `hostname` | いいえ | `127.0.0.1`                    |

既定のリスナーはローカルからの接続だけを受け付けます。
外部から接続させる場合は、公開するネットワークの範囲を確認し、`hostname: "0.0.0.0"` などのアドレスを明示してください。

## 静的ファイル: withAssets {#assets}

`serve` は内部で `withAssets` を使うため、通常は `serve` の `assets` オプションでファイル配信を設定します。
ブラウザー向けビルド成果物の `client` マウントは必須で、`robots.txt` などのファイルを配信する `public` マウントは任意です。

| 設定                  | 意味                                                             |
| --------------------- | ---------------------------------------------------------------- |
| `client.root`         | ブラウザー向けビルド成果物を置く専用ディレクトリ                 |
| `client.prefix`       | `/assets/` など、`/` 以外の絶対 URL パスの接頭辞                 |
| `client.cacheControl` | client ファイルの `Cache-Control` 値（任意）                     |
| `public.root`         | 接頭辞を付けず、URL パスに対応するファイルを配信するディレクトリ |
| `public.cacheControl` | public ファイルの `Cache-Control` 値（任意）                     |

たとえば `client.prefix: "/assets/"` なら、`/assets/app.js` へのリクエストでは `client.root` の `app.js` を検索します。
Vite の出力先や `base` を変更した場合は、実際のディレクトリと URL に合わせて設定を変えてください。
どちらのキャッシュ設定も、既定値は `public, max-age=0, must-revalidate` です。
`public, max-age=31536000, immutable` などの変更されないことを前提とした設定は、ファイル名にハッシュを含む成果物にだけ使ってください。

**アプリケーションへ渡されるリクエスト**

静的ファイルを検索するのは `GET` と `HEAD` だけで、それ以外のメソッドはアプリケーションへ渡します。
client の接頭辞に一致する場合、ファイルがなければアプリケーションルートへ渡さず 404 を返します。
接頭辞に一致しない場合は、`public` が設定されていれば完全一致するファイルを配信し、それ以外はアプリケーションへ渡します。
Flight・Server Function のリクエストと `/_effront` およびその配下へのリクエストは、この public の検索を通しません。
どちらのマウントにも、ディレクトリ index の自動配信や SPA fallback はありません。
ファイルが見つからない場合以外のファイルシステムの失敗は、型付きの HTTP エラーとして保持します。

ファイルの検索はリクエスト時に行い、起動時にディレクトリを検証するものではありません。
信頼できるビルド成果物と public ディレクトリを配置し、その内容とシンボリックリンクは利用者が管理してください。
パスのデコード・正規化・トラバーサルの扱いは、Effront 独自のパス検証ではなく Effect 標準の `HttpStaticServer` に委ねます。

**既存の Effect HTTP サーバーに組み込む場合**

HTTP サーバーを自分で構成する場合は、`@effront/server/assets` から `withAssets` をインポートし、同じマウント設定で `withAssets(handler, options)` を呼び出します。
戻り値は handler を生成する Effect なので、セットアップ用の Effect 内で `yield* withAssets(handler, options)` として handler を取得してから、サーバーに渡してください。
構築用の Effect をリクエスト handler として渡すことはできません。

構築時には呼び出し元の `FileSystem` と `Path` サービスが必要で、構築用 Effect のエラー型は `PlatformError` です。
生成された handler は、元のサービス要件とエラー型を保持し、それぞれ `HttpServerRequest` と `HttpServerError` を加えます。
リクエストのスコープは呼び出し元のサーバーが管理し、レスポンス本文を完了またはキャンセルする必要があります。
`serve` を使う場合、この組み込みはすでに行われています。

**HTTP レスポンスの動作**

MIME、弱い ETag、条件付きレスポンス、byte range は Effect `4.0.0-rc.112` に従います。
キャッシュやダウンロード用クライアントをテストするときは、次の標準動作を考慮してください。

| リクエスト・条件                                   | 結果                                                                                      |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `HEAD` または条件が一致して `304` を返すリクエスト | ファイルストリームを取得しません                                                          |
| 満たせる単一 byte range                            | `206` で指定範囲を返します                                                                |
| 複数 range・非対応 range・安全整数の範囲外の range | Range ヘッダーを無視します                                                                |
| 有効でも満たせない単一 range                       | `Content-Range` 付きの `416` を返し、アセットのキャッシュ・validator ヘッダーは付けません |
| `If-Range`                                         | この Effect 版では無視します                                                              |
| `HEAD` に付けた `Range`                            | Range を評価し、本文なしの `206` または `416` になる場合があります                        |

呼び出し元が独自の `HttpPlatform` や ETag サービスを渡しても、アセットのレスポンスは変わりません。
