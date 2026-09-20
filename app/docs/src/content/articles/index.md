Effront は、Effect を基盤とする React メタフレームワークです。
React Server Components によるページの描画と、Server Functions によるユーザー操作の処理を、Effect のサービスや依存性注入と組み合わせて実装できます。

## ページを表示する {#boundaries}

[はじめる](./guide/getting-started.md)で、レイアウトとルートを持つトップページを作成します。
実行するには、[プラットフォームのセットアップ](./platforms.md)を選んでください。

## データとユーザー操作を扱う {#overview}

- [ルーティング](./guide/routes.md): URL をページに結び付け、ルートパラメーターを読み取り、レイアウトを共有します。
- [サービスの注入](./guide/effect.md): アプリケーションのサービスを提供し、ページの描画中に使います。
- [Server Functions](./guide/server-functions.md): ブラウザーからの入力を検証し、サーバー側のハンドラーを実行します。

## 次のガイドを選ぶ {#next}

- [Markdown](./guide/markdown.md) で記事を表示し、[スタイリング](./guide/styling.md)で Tailwind CSS を追加します。
- サービスの生存期間と画面の更新は[実行時の契約](./advanced.md)で確認できます。
- 処理とブラウザー上の動作を検証するには、[アプリケーションのテスト](./best-practices/testing.md)を参照してください。
- オプションや型は [API reference](./api-reference.md) で調べられます。
- 実装を読むには、[アーキテクチャの実装解説](/architecture/implementation/overview)に進んでください。
