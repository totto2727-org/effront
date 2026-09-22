[Alchemy サンプル](https://github.com/totto2727-org/effront/tree/main/examples/alchemy)を使い、Alchemy が管理する Cloudflare Worker で Effront アプリケーションを開発します。
ホストの設定は揃っているため、まず起動してからページの内容を変更できます。

## サンプルを準備する {#setup}

Node.js 24.11 以降と [Vite+](https://viteplus.dev/) をインストールします。
サンプルは Alchemy を `2.0.0-beta.77` に固定しており、この版の CLI はローカル開発でも Cloudflare profile の設定を必要とします。
起動前に [Alchemy のドキュメント](https://alchemy.run/docs)に従って profile を設定してください。

```bash
git clone https://github.com/totto2727-org/effront.git
cd effront
vp install
vp exec --filter "./packages/*" -- vp pack
cd examples/alchemy
```

## アプリケーションとリソースの定義を確認する {#worker}

最初のセットアップでは設定を作り直さず、次のファイルに注目してください。

| ファイル                | 役割                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `src/entry.effront.tsx` | ページ、ルートレイアウト、ルートを定義します。ページの内容を変更する場合はここから始めます。 |
| `src/entry.workers.ts`  | Worker を宣言し、アプリケーションを接続して、開発用ポートを `1337` に設定します。            |
| `alchemy.run.ts`        | Stack を定義し、管理用の状態をローカルに保存して、Worker の URL を出力します。               |
| `vite.config.ts`        | `effront()` と `effrontAlchemy()` を Tailwind とともに登録します。                           |
| `package.json`          | 依存パッケージを固定し、`dev` を `alchemy dev` として定義します。                            |

## 開発サーバーを起動する {#stack}

`examples/alchemy` で次を実行します。

```bash
vp run dev
```

CLI が準備完了を示したら、[http://localhost:1337](http://localhost:1337) を開きます。
トップページに `Hello, world!` と `Hello from Alchemy KV` が表示されます。
`Count: 0` のクリック、挨拶フォームの送信を試し、**About** から [http://localhost:1337/about](http://localhost:1337/about) に移動します。

`src/entry.effront.tsx` の見出しを変更して保存し、開発中の更新を確認します。

## 必要に応じてリソースを追加する {#capabilities}

リソースを追加する場合は、[Alchemy のリソース API](https://alchemy.run/docs) と [Effront の Alchemy API リファレンス](../api-reference/alchemy.md)を参照してください。
