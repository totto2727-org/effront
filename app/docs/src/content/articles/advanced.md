## 実行時の契約 {#chapters}

- [Server Function の実行と更新](/advanced/server-function-execution-and-refresh): 更新後のページより先に関数の結果が届く理由と、画面更新の順序制御ではデータベースの書き込みを保護できない理由。
- [クライアントナビゲーション](/advanced/client-navigation): ページ間で保持される状態、URL が変わるタイミング、ストリーミングや履歴が遷移に与える影響。
- [リクエスト runtime と寿命](/advanced/request-runtime-and-lifetimes): ハンドラーが戻った後もリクエストのサービスを使える理由と、リソースが解放されるタイミング。

アプリケーションのセットアップは[はじめる](/guide/getting-started)と[プラットフォーム](/platforms)を参照してください。
動作の検証は[アプリケーションのテスト](/best-practices/testing#production)で扱います。
[アーキテクチャの各章](/architecture/implementation/overview)では、これらの契約を支える実装を説明します。
