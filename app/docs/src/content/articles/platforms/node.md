## サンプルを起動する {#setup}

Node.js 24.11 以降と [Vite+](https://viteplus.dev/) をインストールします。
Node.js 用のプロジェクトを作成し、依存パッケージをインストールします。

```bash
vp create effront -- my-app --platform node
cd my-app
vp install
vp dev
```

Vite が表示するローカル URL を開きます。一画面に `Hello, world` と表示されます。

## アプリケーションとサーバーのファイルを確認する {#entries}

サンプルにはホストの設定が揃っています。

| ファイル                | 役割                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `src/entry.effront.tsx` | HTML レイアウト、一つのページ、`/` ルートを定義します。                             |
| `src/entry.rsc.ts`      | 開発・本番用の HTTP `handler` をエクスポートします。                                |
| `src/entry.server.ts`   | `@effront/server/node` と `NodeRuntime.runMain` で Node.js のリスナーを起動します。 |
| `vite.config.ts`        | `effront()` と `effrontServer()` を登録します。                                     |
| `package.json`          | 依存パッケージと `start` コマンドを定義します。                                     |

`src/entry.effront.tsx` の `<h1>Hello, world</h1>` を `<h1>Hello, Effront!</h1>` に変えて保存します。サーバーを再起動せずに表示が更新されます。

## 本番ビルドをローカルで確認する {#assets}

開発サーバーを停止し、生成したプロジェクトで次を実行します。

```bash
vp build
```

ビルドすると、サーバーの起動ファイルは `dist/rsc/server.js`、生成されたブラウザー用アセットは `dist/client/assets` に出力されます。
`src/entry.server.ts` は生成アセットを `/assets/` 以下で配信します。

## Node.js サーバーを起動する {#node}

ビルド後、`examples/node` で次を実行します。

```bash
vp run start
```

このスクリプトは `node dist/rsc/server.js` を実行します。
`PORT` と `HOST` が未設定なら、[http://127.0.0.1:3000](http://127.0.0.1:3000) を開きます。
待ち受けアドレスを変更する場合は、起動前に `PORT` と `HOST` を設定してください。

リスナーとアセットのオプションは [サーバー API リファレンス](../api-reference/server.md) を参照してください。
Bun を使う場合は、別の [Bun サンプル](./bun.md)を参照してください。
