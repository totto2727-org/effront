利用する API の import 先とリファレンスは、[公開 API の一覧](#exports)から探せます。
ページ、ルーティング、サーバー関数の API は個別のパッケージから import するのではなく、アプリケーションファクトリーのメンバーとして使うため、[ファクトリーの索引](#index)にまとめています。
このリファレンスが対象とするパッケージの版は、[依存バージョン一覧](#versions)で確認できます。
API の確認ではなくアプリケーションを一から設定したい場合は、[Getting started](/guide/getting-started) と利用する[プラットフォーム](/platforms)のガイドを参照してください。

## 公開 API の一覧 {#exports}

アプリケーションの定義、リクエスト処理、ビルド設定のうち、行いたい作業に対応するエントリーポイントを選びます。
以下に各エントリーポイントの主な API を示します。
オプション、戻り値、利用条件はリンク先のリファレンスで確認できます。

| import 先                          | 主な API と用途                                                                                                         | リファレンス                                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `@effront/core`                    | アプリケーション定義の `Application` と、ページ遷移の `PageViewTransition`                                              | [Application](/api-reference/application)、[コンポーネント](/api-reference/components) |
| `@effront/core/http`               | native Effect HTTP のリクエスト処理に使う `toHttpEffect` と `makeHttpEffect`                                            | [Native HTTP](./api-reference/http.md)                                                 |
| `@effront/core/workers`            | Fetch ホスト向けの `createFetchHandler`、`WorkersRequestContext`、型付きリクエストコンテキスト reader                   | [Fetch・Workers context](/api-reference/workers)                                       |
| `@effront/cloudflare/workers`      | `CloudflareExecutionContext` と、Cloudflare のリクエストコンテキストを取得する型付き reader                             | [Fetch・Workers context](/api-reference/workers)                                       |
| `@effront/server/node`             | Node.js HTTP サーバーを起動する `serve`                                                                                 | [Node.js / Bun server](./api-reference/server.md)                                      |
| `@effront/server/bun`              | Bun HTTP サーバーを起動する `serve`                                                                                     | [Node.js / Bun server](./api-reference/server.md)                                      |
| `@effront/server/assets`           | 静的アセットを配信する `withAssets`                                                                                     | [Node.js / Bun server](./api-reference/server.md)                                      |
| `@effront/alchemy/cloudflare`      | アプリケーションのサービスを Alchemy の native Worker に接続する `applicationHttpEffect` と `makeApplicationHttpEffect` | [Alchemy](./api-reference/alchemy.md)                                                  |
| `@effront/vite`                    | アプリケーションの Vite 設定に使う `effront` と `EffrontViteOptions`                                                    | [Vite・Cloudflare plugins](/api-reference/vite)                                        |
| `@effront/cloudflare`              | Cloudflare の開発・ビルド設定に使う `effrontCloudflare` と `EffrontCloudflareOptions`                                   | [Vite・Cloudflare plugins](/api-reference/vite)                                        |
| `@effront/server/vite`             | Vite の開発・プレビュー用 middleware を設定する `effrontServer`                                                         | [Node.js / Bun server](./api-reference/server.md)                                      |
| `@effront/alchemy/cloudflare/vite` | Alchemy の native Worker のビルド統合に使う `effrontAlchemy`                                                            | [Alchemy](./api-reference/alchemy.md)                                                  |
| `@effront/markdown`                | Markdown の読み込みとパースに使う `createMarkdownCollection`、`parseMarkdown`、`MarkdownError`                          | [Markdown](./api-reference/markdown.md)                                                |
| `@effront/tailwind`                | Tailwind CSS を接続する `effrontTailwind`                                                                               | [Tailwind](./api-reference/tailwind.md)                                                |

`@effront/core` の実行時の import には `react-server` 条件が必要です。
ホストのプロセス全体でこの条件を有効にするのではなく、`effront()` が設定する RSC エントリーのグラフ内にアプリケーション定義を置いてください。

## アプリケーションファクトリーの索引 {#index}

`Application.effront<Services>()` は、アプリケーションの UI、ルート、ミドルウェア、サーバー関数を定義するファクトリーを返します。
各定義が同じアプリケーション identity に属するよう、一度作ったファクトリーを共有してください。
各操作の入力と結果は、次のリファレンスで確認できます。

| ファクトリーのメンバー                   | 用途                                                                           | リファレンス                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `Component`、`Page`、`Layout`、`Loading` | 描画内容、ページのレイアウト、読み込み中の表示を定義する                       | [Component・Page・Layout・Loading](/api-reference/components) |
| `Routes`、`Middleware`                   | URL とページを対応付け、ミドルウェアの動作と適用範囲を定義する                 | [Routes・Middleware](/api-reference/routing)                  |
| `ServerFn`                               | Schema で入力を検証するサーバー関数を定義する                                  | [ServerFn](/api-reference/server-functions)                   |
| `withMiddleware`                         | 同じアプリケーション identity のまま、ミドルウェアを追加したファクトリーを作る | [Application](/api-reference/application)                     |
| `make`                                   | ルートとサービスの設定をアプリケーション定義にまとめる                         | [Application](/api-reference/application)                     |

定義ができたら、上の公開 API 一覧にある HTTP またはホスト用の API へ接続します。
ファクトリーの `make` が行うのは定義の組み立てであり、サーバーの起動ではありません。

## 依存バージョン一覧 {#versions}

このリファレンスは Effront `0.1.4` と、以下の依存パッケージの版を対象にしています。
core、vite、cloudflare、server、alchemy、markdown、tailwind を含め、導入する Effront パッケージはすべて `0.1.4` に揃えてください。

| パッケージまたはパッケージ群                                                                       | バージョン      |
| -------------------------------------------------------------------------------------------------- | --------------- |
| Effront パッケージ                                                                                 | `0.1.4`         |
| `react` と `react-dom`                                                                             | `19.3.0`        |
| `@vitejs/plugin-rsc`                                                                               | `0.5.35`        |
| `effect` と Effect の platform packages（`@effect/platform-browser` とホスト別のパッケージを含む） | `4.0.0-rc.112`  |
| `alchemy`                                                                                          | `2.0.0-beta.77` |
| `@comark/react`                                                                                    | `0.6.2`         |

基本のアプリケーション依存パッケージは、次のコマンドで導入します。

```bash
vp add @effront/core@0.1.4 effect@4.0.0-rc.112 @effect/platform-browser@4.0.0-rc.112
vp add react@19.3.0 react-dom@19.3.0
vp add -D @effront/vite@0.1.4 @vitejs/plugin-rsc@0.5.35
```

React と React DOM は同じ版を使い、`@vitejs/plugin-rsc@0.5.35` に含まれる `19.3.0` の RSC transport と揃えます。
[`ViewTransition`](https://react.dev/reference/react/ViewTransition) と [`addTransitionType`](https://react.dev/reference/react/addTransitionType) は安定版 React `19.3.0` の公開 API です。
ホストの platform packages を追加するときも、Effect family の版を揃えてください。
ホスト用や任意の機能用の依存パッケージは、一覧のすべてを追加するのではなく、それぞれのガイドに沿って導入します。
Vite 統合の公開 Vite peer dependency は `*` です。
このドキュメントのセットアップ手順では VitePlus を使います。
