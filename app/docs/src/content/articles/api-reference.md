## バージョンと依存関係 {#versions}

このガイドは次回リリース `0.1.4` を対象にしています。
以下のインストール手順は `0.1.4` の公開後に利用できます。
core、vite、cloudflare、server、alchemy、markdown、tailwind の Effront パッケージは同じ版を揃えます。

```bash
vp add @effront/core@0.1.4 effect@4.0.0-rc.112 @effect/platform-browser@4.0.0-rc.112
vp add react@19.3.0 react-dom@19.3.0
vp add -D @effront/vite@0.1.4 @vitejs/plugin-rsc@0.5.35
```

React / React DOM は安定版 `19.3.0` に揃えます。
[`ViewTransition`](https://react.dev/reference/react/ViewTransition) と [`addTransitionType`](https://react.dev/reference/react/addTransitionType) はこの安定版の公開 API です。
RSC transport も `19.3.0` を内包する `@vitejs/plugin-rsc@0.5.35` を使い、Effect family も対応する版を一致させてください。
ホスト用 platform packages も Effect `4.0.0-rc.112` に揃えます。
Alchemy は `2.0.0-beta.77`、Markdown の React renderer は `@comark/react@0.6.2` を使います。
ホストと optional な機能に必要な追加依存は、それぞれの手順で導入します。
Vite の public peer は `*` ですが、ここでは VitePlus を使う構成を案内します。

## 公開エントリーポイント {#exports}

アプリケーションを定義する API、リクエストを処理する API、ビルド設定を分けて読み込みます。以下は現在の Effront パッケージの公開契約です。

| API / 項目                                                                                      | 契約                                                                                         |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `@effront/core`                                                                                 | Application、PageViewTransition を公開。実行時の import には react-server 条件が必要です。   |
| `@effront/core/http`                                                                            | [native HTTP Effect と構築時の能力の捕捉](./api-reference/http.md)                           |
| `@effront/core/workers`                                                                         | Fetch ハンドラー、リクエストコンテキストと型付き reader を公開します。                       |
| `@effront/vite`                                                                                 | effront と EffrontViteOptions。アプリケーションの開発・ビルド設定です。                      |
| `@effront/cloudflare`                                                                           | effrontCloudflare と EffrontCloudflareOptions。Cloudflare のビルド・開発統合です。           |
| `@effront/cloudflare/workers`                                                                   | CloudflareExecutionContext と Cloudflare 向けの型付き reader。リクエスト処理から利用します。 |
| `@effront/server/node`・`@effront/server/bun`・`@effront/server/assets`・`@effront/server/vite` | [native hosting・assets・Vite middleware](./api-reference/server.md)                         |
| `@effront/alchemy/cloudflare`・`@effront/alchemy/cloudflare/vite`                               | [native Worker の能力とビルド統合](./api-reference/alchemy.md)                               |
| `@effront/markdown`                                                                             | [collection と Comark parsing](./api-reference/markdown.md)                                  |
| `@effront/tailwind`                                                                             | [Tailwind CSS の自動接続](./api-reference/tailwind.md)                                       |

アプリケーションの組み立てには以下の API を使います。
ファクトリーの戻り値の型は推論されます。

## API 索引 {#index}

- [Application](/api-reference/application): identity、サービス型、make。

- [Component・Page・Layout・Loading](/api-reference/components): 描画と入力。

- [Routes・Middleware](/api-reference/routing): ルート構成とスコープ。

- [ServerFn](/api-reference/server-functions): Schema 入力とサーバー実行。

- [Fetch・Workers context](/api-reference/workers): ホストとの接続と reader。

- [Vite・Cloudflare plugins](/api-reference/vite): オプションと出力構成。

- [Native HTTP](./api-reference/http.md): request Scope と外部要件。
- [Node.js / Bun server](./api-reference/server.md): listener と assets。
- [Alchemy](./api-reference/alchemy.md): construction capabilities。
- [Markdown](./api-reference/markdown.md): collection と参照解決。
- [Tailwind](./api-reference/tailwind.md): CSS integration。
