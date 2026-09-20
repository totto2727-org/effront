## ホスティング方法を選ぶ {#support}

| 目的                                          | パッケージ            | セットアップ                                    |
| --------------------------------------------- | --------------------- | ----------------------------------------------- |
| Wrangler で Cloudflare Worker を管理する      | `@effront/cloudflare` | [Cloudflare Workers](./platforms/cloudflare.md) |
| Alchemy で Worker とリソースを定義する        | `@effront/alchemy`    | [Alchemy](./platforms/alchemy.md)               |
| Node.js または Bun の HTTP サーバーを起動する | `@effront/server`     | [Node.js / Bun](./platforms/node-bun.md)        |

Wrangler と Alchemy は、どちらも Cloudflare Workers を実行先に使います。

## ローカル開発を設定する {#architecture}

[はじめる](./guide/getting-started.md)でアプリケーションを作成し、上のセットアップから一つ選んで進めてください。
Wrangler と Node.js / Bun の構成では `vp dev` を使います。
Alchemy では `alchemy dev` を実行する `dev` スクリプトを使い、ローカル開発にも設定済みの Cloudflare profile が必要です。

## 本番の起動とアセットを準備する {#build-startup}

- [Workers](./platforms/cloudflare.md#local): ビルド後、生成された設定とブラウザー用アセットを使い、Wrangler でローカル実行します。
- [Node.js / Bun](./platforms/node-bun.md#node): ビルド後、対応するランタイムとアセットのマウント設定で、生成されたサーバーを起動します。

どちらも実行先へ移す際は、ビルド成果物全体を保持してください。
