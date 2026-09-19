## アプリケーションの処理 {#services}

Page や Server Function から呼ぶ処理を Effect として切り出すと、表示から独立して検証できます。 テスト用のサービス実装を Layer で提供し、戻り値、業務上のエラー、保存内容を確認します。 アプリケーション全体にテスト用サービスを使う場合は、`EFFRONT.make` の `layer` に渡します。

## ページとユーザー操作 {#pages}

起動したアプリケーションに実ブラウザーでアクセスし、利用者が見る結果を確認します。 起動設定は [はじめる](/guide/getting-started)、ホストごとの設定は[プラットフォーム](/platforms) を参照してください。

- URL に対応する記事やデータが表示されること。

- リンクで目的のページへ移動できること。

- フォーム送信が保存内容と画面に反映されること。

- 入力エラーやアクセス権限に応じた案内が表示されること。

## ビルド済みアプリケーションの受け入れ確認 {#production}

開発サーバーだけでなく、利用するホストのビルド済み成果物でも利用者の操作を試してください。
起動方法と成果物の配置は[プラットフォーム](../platforms.md#build-startup) を参照してください。

- 直接 URL を開き、SSR の HTML、スタイル、hydration を確認します。
- Flight 遷移、戻る・進む、Navigation API 非対応ブラウザーでのドキュメント移動を確認します。
- Server Function の戻り値と更新後の画面、JavaScript 無効時のフォーム送信を確認します。
- Suspense の遅延部分とキャンセル、秘密値が HTML や Flight に含まれないことを確認します。
- 静的ファイルの URL と 404 を確認します。
- ホスト固有 API は、そのホストの production entry で確認します。dev / preview の成功だけで判断しません。

## テストツール {#tools}

テストの書き方は [Vitest](https://vitest.dev/guide/)、 ブラウザーテストとサーバー自動起動は[Playwright](https://playwright.dev/docs/test-webserver) の公式ガイドを参照してください。
