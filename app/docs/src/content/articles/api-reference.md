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
| `@effront/markdown`                | `createMarkdownCollection`、`parseMarkdown`、`MarkdownError`          | [Markdown](./api-reference/markdown.md)                                                      |
| `@effront/tailwind`                | `effrontTailwind`                                                     | [Tailwind](./api-reference/tailwind.md)                                                      |
| `@effront/markdown/document`       | `MarkdownDocument`、`MarkdownDocumentProps`                           | [Markdown](./api-reference/markdown.md)                                                      |
| `@effront/markdown/math`           | `Math`                                                                | [Markdown](./api-reference/markdown.md)                                                      |
| `@effront/markdown/mermaid`        | `Mermaid`                                                             | [Markdown](./api-reference/markdown.md)                                                      |

| `@effront/core/query` | `query`、`queryAtom`、`stream`、`streamAtom`、型付き Server Function error | [Query Server Function](/ja/guide/query-server-functions)、[Stream Server Function](/ja/guide/stream-server-functions) |

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

## 依存関係の互換性 {#versions}

通常のセットアップでは、バージョンを付けずにパッケージ名でインストールします。
対応する依存バージョンの範囲は、版数一覧を複製せず、インストールした Effront パッケージの `peerDependencies` を参照してください。
任意のアダプターや連携パッケージを含めて Effront のバージョンを統一し、再現可能なインストールのためにアプリケーションの lockfile を保持します。
React と React DOM は同じバージョンが必要で、`@vitejs/plugin-rsc` が提供する RSC トランスポートも、その React と互換性が必要です。
Effront のページ遷移は [`ViewTransition`](https://react.dev/reference/react/ViewTransition) と [`addTransitionType`](https://react.dev/reference/react/addTransitionType) を使用します。
アプリケーションとホスト別 Effect パッケージで、整合性のある単一の Effect を使用してください。
Alchemy の更新前には、インストールしたアダプターの peer 要件と[統合の互換性に関する説明](./api-reference/alchemy.md)を確認してください。
Vite 連携の公開 Vite peer dependency は `*` です。
セットアップガイドでは VitePlus を使用します。
