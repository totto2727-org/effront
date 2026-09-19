## 実行時の契約を読む {#chapters}

動くアプリケーションを作った後は、レスポンスがいつ完了し、どの更新が画面に反映されるかを確認します。
この章では、サービスの解放時期や画面更新の競合など、アプリケーションの運用や設計に必要な契約を説明します。

- [リクエスト runtime と寿命](/advanced/request-runtime-and-lifetimes): Layer の取得、レンダーの Scope、ストリーム終了時の解放。

- [クライアントナビゲーション](/advanced/client-navigation): ネイティブの Navigation API、最初の commit、履歴キャッシュ。

- [Server Function の実行と更新](/advanced/server-function-execution-and-refresh): 戻り値と画面更新の分離、並行呼び出し、入力境界。

ホストの責務と起動方法は[プラットフォーム](/platforms)、起動後の受け入れ確認は[アプリケーションのテスト](/best-practices/testing#production) を参照してください。

API の使い方は [はじめる](/guide/getting-started)、内部の処理を追う場合は[アーキテクチャ](/architecture/implementation/overview) を参照してください。
