まずは[最小構成の Bun サンプル](https://github.com/totto2727-org/effront/tree/main/examples/bun)または `vp create effront -- my-app --platform bun` から始められます。
ナビゲーションなどの高機能な例は [Alchemy Basic](https://github.com/totto2727-org/effront/tree/main/examples/basic) を参照してください。以前の高機能な Bun アプリケーションは[サーバーテスト専用の fixture](https://github.com/totto2727-org/effront/tree/main/tests/e2e-server/fixtures/bun)として保持しています。

## サンプルを起動する {#setup}

Node.js 24.11 以降と [Vite+](https://viteplus.dev/) をインストールします。
本番サーバー用に [Bun 1.4.2 以降](https://bun.sh/docs/installation) もインストールします。
Vite の開発サーバーは Node.js を使うため、両方のランタイムを用意してください。

```bash
vp create effront -- my-app --platform bun
cd my-app
vp install
vp dev
```

Vite が表示するローカル URL を開きます。一画面に `Hello, world` と表示されます。

## アプリケーションとサーバーのファイルを確認する {#entries}

サンプルにはホストの設定が揃っています。

| ファイル                | 役割                                                                          |
| ----------------------- | ----------------------------------------------------------------------------- |
| `src/entry.effront.tsx` | HTML レイアウト、一つのページ、`/` ルートを定義します。                       |
| `src/entry.rsc.ts`      | アプリケーションの HTTP `handler` をエクスポートします。                      |
| `src/entry.server.ts`   | `@effront/server/bun` と `BunRuntime.runMain` で Bun のリスナーを起動します。 |
| `vite.config.ts`        | `effront()` と `effrontServer()` を登録します。                               |
| `package.json`          | 依存パッケージと `start` コマンドを定義します。                               |

`src/entry.effront.tsx` の `<h1>Hello, world</h1>` を `<h1>Hello, Effront!</h1>` に変えて保存します。サーバーを再起動せずに表示が更新されます。

## 本番ビルドをローカルで確認する {#assets}

開発サーバーを停止し、生成したプロジェクトで次を実行します。

```bash
vp build
```

ビルドすると、サーバーの起動ファイルは `dist/rsc/server.js`、生成されたブラウザー用アセットは `dist/client/assets` に出力されます。
`src/entry.server.ts` は生成アセットを `/assets/` 以下で配信します。

## Bun サーバーを起動する {#bun}

ビルド後、`examples/bun` で次を実行します。

```bash
vp run start
```

このスクリプトは `bun dist/rsc/server.js` を実行します。
`PORT` と `HOST` が未設定なら、[http://127.0.0.1:3000](http://127.0.0.1:3000) を開きます。
待ち受けアドレスを変更する場合は、起動前に `PORT` と `HOST` を設定してください。
最小構成は本番で `@effect/platform-bun` を、開発時に `@effect/platform-node` を使います。

リスナーとアセットのオプションは [サーバー API リファレンス](../api-reference/server.md) を参照してください。
Node.js を使う場合は、別の [Node.js サンプル](./node.md)を参照してください。
