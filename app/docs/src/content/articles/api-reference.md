Effront の API は、アプリケーションの定義、実行環境への接続、ビルド時の統合に分かれています。
ページ、ルート、サービス、Server Function は `@effront/core` で定義し、実行環境、Markdown、スタイリングには対応するパッケージを使います。

## 公開 API の一覧 {#exports}

| インポート先                       | 主な API                                                              | リファレンス                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `@effront/core`                    | `Application`、`PageViewTransition`                                   | [Application](/ja/api-reference/application)、[コンポーネント](/ja/api-reference/components) |
| `@effront/core/http`               | `toHttpEffect`、`makeHttpEffect`                                      | [ネイティブ HTTP](./api-reference/http.md)                                                   |
| `@effront/core/workers`            | `createFetchHandler`、`WorkersRequestContext`、Context の読み取り関数 | [Fetch と Workers Context](/ja/api-reference/workers)                                        |
| `@effront/cloudflare/workers`      | `CloudflareExecutionContext`、Cloudflare Context の読み取り関数       | [Fetch と Workers Context](/ja/api-reference/workers)                                        |
| `@effront/server/node`             | Node.js の `serve`                                                    | [Node.js / Bun サーバー](./api-reference/server.md)                                          |
| `@effront/server/bun`              | Bun の `serve`                                                        | [Node.js / Bun サーバー](./api-reference/server.md)                                          |
| `@effront/server/assets`           | `withAssets`                                                          | [Node.js / Bun サーバー](./api-reference/server.md)                                          |
| `@effront/alchemy/cloudflare`      | `applicationHttpEffect`、`makeApplicationHttpEffect`                  | [Alchemy](./api-reference/alchemy.md)                                                        |
| `@effront/vite`                    | `effront`、`EffrontViteOptions`                                       | [Vite と Cloudflare プラグイン](/ja/api-reference/vite)                                      |
| `@effront/cloudflare`              | `effrontCloudflare`、`EffrontCloudflareOptions`                       | [Vite と Cloudflare プラグイン](/ja/api-reference/vite)                                      |
| `@effront/server/vite`             | `effrontServer`                                                       | [Node.js / Bun サーバー](./api-reference/server.md)                                          |
| `@effront/alchemy/cloudflare/vite` | `effrontAlchemy`                                                      | [Alchemy](./api-reference/alchemy.md)                                                        |
| `@effront/markdown`                | `createMarkdownCollection`、`parseMarkdown`、`MarkdownDocument`、`MarkdownError`          | [Markdown](./api-reference/markdown.md)                                                      |
| `@effront/tailwind`                | `effrontTailwind`                                                     | [Tailwind](./api-reference/tailwind.md)                                                      |

Markdown のレンダラーは `@effront/markdown/document`、そのスコープ済み CSS は `@effront/markdown/styles.css` から読み込みます。

`@effront/core` の実行時インポートには `react-server` 条件が必要です。
ホストプロセス全体でこの条件を有効にせず、`effront()` が構成するアプリケーショングラフ内で使用してください。
アプリケーションのセットアップは [はじめに](/ja/guide/getting-started) と [プラットフォーム](/ja/platforms) を参照してください。

## アプリケーションファクトリーの索引 {#index}

`Application.effront<Services>()` は次のファクトリーとメソッドを返します。
関連する定義には、同じファクトリーインスタンスか、そこから `withMiddleware` で派生したファクトリーを使います。

| メンバー                                 | 戻り値                                                                 | リファレンス                                      |
| ---------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------- |
| `Component`、`Page`、`Layout`、`Loading` | 描画内容とルート UI の定義                                             | [コンポーネント](/ja/api-reference/components)    |
| `Routes`、`Middleware`                   | ルートグループとスコープ付きリクエストミドルウェア                     | [Routes と Middleware](/ja/api-reference/routing) |
| `ServerFn`                               | Schema で検証する Server Function                                      | [ServerFn](/ja/api-reference/server-functions)    |
| `withMiddleware`                         | 同じアプリケーション ID を保ち、ミドルウェアを追加した派生ファクトリー | [Application](/ja/api-reference/application)      |
| `make`                                   | アプリケーション定義。サーバーの起動は行わない                         | [Application](/ja/api-reference/application)      |

## 依存バージョン一覧 {#versions}

| パッケージ群                                                     | バージョン      |
| ---------------------------------------------------------------- | --------------- |
| すべての Effront パッケージ                                      | `0.1.4`         |
| `react`、`react-dom`                                             | `19.3.0`        |
| `@vitejs/plugin-rsc`                                             | `0.5.35`        |
| `effect`、`@effect/platform-browser`、ホスト別 Effect パッケージ | `4.0.0-rc.112`  |
| `alchemy`                                                        | `2.0.0-beta.77` |
| `@comark/react`                                                  | `0.6.2`         |

任意のアダプターや連携パッケージを含め、Effront のバージョンを統一してください。
React と React DOM は同じバージョンが必要で、`@vitejs/plugin-rsc@0.5.35` は対応する `19.3.0` の RSC トランスポートを含みます。
[`ViewTransition`](https://react.dev/reference/react/ViewTransition) と [`addTransitionType`](https://react.dev/reference/react/addTransitionType) は React `19.3.0` の安定版 API です。
Effect 系のバージョンも統一してください。
Vite 連携の公開 Vite peer dependency は `*` です。
セットアップガイドでは VitePlus を使用します。
