Server Function は、サーバー側で入力を検証して処理を実行します。呼び出し後の画面更新と返す値の数に応じて、次のガイドを選んでください。

## 呼び出し方を選ぶ {#choose}

| 必要なこと                                                 | 呼び出し方              | ガイド                                                     |
| ---------------------------------------------------------- | ----------------------- | ---------------------------------------------------------- |
| フォームを送信する、または更新後に現在のルートを再描画する | 通常の mutation         | [Mutation Server Function](./mutation-server-functions.md) |
| 現在のルートを更新せずに値を一つ読み取る                   | `query` / `queryAtom`   | [Query Server Function](./query-server-functions.md)       |
| 現在のルートを更新せずに値を段階的に読み取る               | `stream` / `streamAtom` | [Stream Server Function](./stream-server-functions.md)     |
