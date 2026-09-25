## サンプルを準備する {#setup}

Node.js 24.11 以降と [Vite+](https://viteplus.dev/) をインストールします。

> [!IMPORTANT]
> サンプルは Alchemy を `2.0.0-beta.77` に固定しており、この版の CLI はローカル開発でも Cloudflare profile の設定を必要とします。
> 起動前に [Alchemy のドキュメント](https://alchemy.run/docs)に従って profile を設定してください。

```bash
vp create effront -- my-app --platform alchemy-cloudflare
cd my-app
vp install
```

## アプリケーションとリソースの定義を確認する {#worker}

一画面のサンプルにはホストの設定が揃っています。

| ファイル                | 役割                                                                      |
| ----------------------- | ------------------------------------------------------------------------- |
| `src/entry.effront.tsx` | HTML レイアウト、一つのページ、`/` ルートを定義します。                   |
| `src/entry.workers.ts`  | Worker を宣言し、リクエストまでアプリケーションの読み込みを遅延させます。 |
| `alchemy.run.ts`        | Stack を定義し、Worker の URL を出力します。                              |
| `vite.config.ts`        | `effront()` と `effrontAlchemy()` を登録します。                          |
| `package.json`          | `dev` を `alchemy dev` として定義します。                                 |

## 開発サーバーを起動する {#stack}

生成したプロジェクトで次を実行します。

```bash
vp run dev
```

準備できたら、Alchemy が表示するローカル URL を開きます。一画面に `Hello, world` と表示されます。
`src/entry.effront.tsx` の `<h1>Hello, world</h1>` を `<h1>Hello, Effront!</h1>` に変えて保存します。

## 必要に応じてリソースを追加する {#capabilities}

KV や D1 などのリソースを使うアプリケーションサービスは [Alchemy Basic](https://github.com/totto2727-org/effront/tree/main/examples/basic)、[Alchemy のリソース API](https://alchemy.run/docs)、[Effront の Alchemy API リファレンス](../api-reference/alchemy.md)を参照してください。
