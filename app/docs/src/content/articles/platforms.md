Effront は、Cloudflare Workers と Node.js / Bun サーバー向けのアダプターを提供しています。
アプリケーションに合う実行先と管理方法を選んでください。

## ホスティング方法を選ぶ {#support}

- **Wrangler で Cloudflare Workers を管理する場合:** `@effront/cloudflare` を使い、[Cloudflare Workers ガイド](./platforms/cloudflare.md)に従います。
- **Alchemy で Worker と binding を管理する場合:** 実験版の `@effront/alchemy` アダプターを使い、[Alchemy ガイド](./platforms/alchemy.md)に従います。
- **Node.js または Bun でサーバープロセスを起動する場合:** `@effront/server` を使い、[Node.js / Bun ガイド](./platforms/node-bun.md)に従います。

Wrangler と Alchemy は異なるデプロイ先ではなく、Cloudflare Worker を管理する二つの方法です。

## ローカル開発を設定する {#architecture}

各プラットフォームのガイドでは、既存の Effront アプリケーションをホストに接続してローカルで開発するための設定を説明します。
パッケージのインストール、Vite の設定、ホスト用エントリーポイントの作成を扱い、ブラウザーでページを開いて変更を確認できるようにします。

## 本番の起動とアセットを準備する {#build-startup}

Wrangler と Node.js / Bun のガイドでは、本番用のエントリーポイントとブラウザーアセットの配信に加え、ビルド済みアプリケーションをローカルで起動する方法も扱います。
その設定を使い、デプロイ前にページの表示とブラウザーでの操作を確認してください。
