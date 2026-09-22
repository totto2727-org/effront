[Node.js サンプル](https://github.com/totto2727-org/effront/tree/main/examples/node)を開発モードで動かし、ビルド後に Node.js の HTTP サーバーを起動します。

## サンプルを起動する {#setup}

Node.js 24.11 以降と [Vite+](https://viteplus.dev/) をインストールします。
リポジトリをクローンし、ワークスペースのパッケージをビルドしてからサンプルを起動します。

```bash
git clone https://github.com/totto2727-org/effront.git
cd effront
vp install
vp exec --filter "./packages/*" -- vp pack
cd examples/node
vp dev
```

[http://127.0.0.1:1341](http://127.0.0.1:1341) を開きます。
トップページに `Hello, world!` と表示されます。
`Count: 0` をクリックしてカウンターが増えることを確認し、**About** から [http://127.0.0.1:1341/about](http://127.0.0.1:1341/about) に移動します。

## アプリケーションとサーバーのファイルを確認する {#entries}

サンプルにはホストの設定が揃っています。
ページやサーバーの動作を変更するときは、次のファイルから確認してください。

| ファイル                | 役割                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `src/entry.effront.tsx` | ルートレイアウト、ページ、ルートを定義します。                                                 |
| `src/entry.rsc.ts`      | アプリケーションの HTTP `handler` をエクスポートし、開発中の更新を受け付けます。               |
| `src/entry.server.ts`   | `@effront/server/node` と `NodeRuntime.runMain` で Node.js のリスナーを起動します。            |
| `vite.config.ts`        | `effront()` と `effrontServer()`、Tailwind を登録し、開発用とプレビュー用の URL を固定します。 |
| `package.json`          | 依存パッケージと `start` コマンドを定義します。                                                |

`src/entry.effront.tsx` の見出しを変更して保存します。
サーバーを再起動せずに [http://127.0.0.1:1341](http://127.0.0.1:1341) の表示が更新されます。

## 本番ビルドをローカルで確認する {#assets}

開発サーバーを停止し、`examples/node` で次のコマンドを実行します。

```bash
vp build
vp preview
```

[http://127.0.0.1:4341](http://127.0.0.1:4341) を開いて、ビルド済みのページとブラウザー用アセットを確認します。
これは Vite のプレビューであり、Node.js の本番リスナーではありません。

ビルドすると、サーバーの起動ファイルは `dist/rsc/server.js`、生成された JavaScript と CSS は `dist/client/assets`、公開ファイルは `dist/client` に出力されます。
`src/entry.server.ts` は生成アセットを `/assets/` 以下で、公開ファイルをそれぞれのパスで配信するように設定済みです。

## Node.js サーバーを起動する {#node}

プレビューを停止して、次を実行します。

```bash
vp run start
```

このスクリプトは `node dist/rsc/server.js` を実行します。
`PORT` と `HOST` が未設定なら、[http://127.0.0.1:3000](http://127.0.0.1:3000) を開きます。
この URL では、Node.js がビルド済みアプリケーションを配信します。
待ち受けアドレスを変更する場合は、起動前に `PORT` と `HOST` を設定してください。

リスナーとアセットのオプションは [サーバー API リファレンス](../api-reference/server.md) を参照してください。
Bun を使う場合は、別の [Bun サンプル](./bun.md)を参照してください。
