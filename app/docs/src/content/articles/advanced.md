## 実行時の契約を読む {#chapters}

動くアプリケーションを作った後は、レスポンスがいつ完了し、どの更新が画面に反映されるかを確認します。 この章では、Effront の現在の Fetch 実装とブラウザー実装に沿って、運用や設計の判断に必要な境界を説明します。

- [リクエスト runtime と寿命](/advanced/request-runtime-and-lifetimes): Layer の取得、レンダーの Scope、ストリーム終了時の解放。

- [クライアントナビゲーション](/advanced/client-navigation): ネイティブの Navigation API、最初の commit、履歴キャッシュ。

- [Server Function の実行と更新](/advanced/server-function-execution-and-refresh): 戻り値と画面更新の分離、並行呼び出し、入力境界。

- [ビルド済みアプリケーションの起動](/advanced/production-startup): ホストの責務と、Workers・Node.js・Bun のビルド済み成果物の実行。

API の使い方は [はじめる](/guide/getting-started)、内部の処理を追う場合は[アーキテクチャ](/architecture/implementation/overview) を参照してください。
