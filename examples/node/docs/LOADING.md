# Loading / Suspense 実験室

Node サンプルの `/loading` は、待機の発生場所・依存関係・表示境界を分けて学ぶためのページです。
外部 API、Cloudflare 認証、デプロイは不要です。

## 起動

Node と VitePlus が使える環境で、このリポジトリのルートから実行します。
ブラウザーの JavaScript を有効にしてください。

```sh
vp install
vp exec --filter "./packages/*" -- vp pack
cd examples/node
vp dev --host 127.0.0.1 --port 4455 --strictPort
```

`http://127.0.0.1:4455/loading` を開いてください。
本番の Node HTTP サーバーで試す場合は dev を停止し、`examples/node` で次を実行します。

```sh
vp build
HOST=127.0.0.1 PORT=4455 vp run start
```

## 1. ハンドラーのないリンクで Loading

上部のカウンターを増やしてから「1. リンクで2秒待つ」を押します。
リンクは通常の `<a href="/loading/navigation">` で、`onClick` や独自のナビゲーション処理はありません。
移動先の `Page` が `Effect.sleep("2 seconds")` で待っている間、`EFFRONT.Loading.make` の fallback が表示されます。
同じルートスコープの `Layout` はその境界の外側にあるため、メニューとカウンターは表示されたままです。

Effront がクライアントナビゲーションを使うには、ブラウザーが Navigation API と `NavigationPrecommitController` の両方に対応している必要があります。
この経路ではレイアウトのカウンター状態も保持されます。
API 未対応環境でも通常のリンクとして移動できますが、ドキュメント全体のナビゲーションになり、クライアントの状態は再初期化されます。
JavaScript 無効時もリンクの移動自体はできますが、React のストリーム結果を表示するスクリプトが動かず、遅延ページは Loading のままになります。
初回表示やドキュメントナビゲーションのストリーミング表示は、ブラウザーや中継サーバーのバッファリングにも影響されます。
以下のブラウザーテストは、対応する Playwright Chromium のクライアントナビゲーションを検証します。

## 2. 並列・直列と表示単位は別

「2. 段階的な表示」には3つのカードがあります。
秒数はサーバー側に入れた待機時間で、通信や React の描画処理を含む保証値ではありません。

| カード | 待機の依存関係                               | 境界                     | 期待する見え方                                      |
| ------ | -------------------------------------------- | ------------------------ | --------------------------------------------------- |
| A      | A1（1秒）と A2（3秒）は独立                  | 兄弟それぞれに Suspense  | A1 が先に現れ、A2 の fallback は残る                |
| B      | B1（1秒）と B2（3秒）は独立                  | 共通の Suspense          | B1 の準備完了だけでは表示されず、両方そろって現れる |
| C      | 親（1.5秒）の結果を得てから子（1.5秒）を生成 | 親の境界の内側に子の境界 | 親の fallback → 親の結果と子の fallback → 子の結果  |

共通の Suspense は「まとめて表示する」境界であり、待機処理を直列にする仕組みではありません。
また、JSX が入れ子というだけで必ず直列になるわけではありません。
C は親の待機後に得た値を子に渡すため、本当に依存する順序になります。
境界が先に子を実行することはできません。

各結果にはサーバーで記録した開始・完了の時刻と実測待機時間を表示します。
A/B の兄弟の待機区間が重なり、C の子の開始が親の完了以降であることを比較してください。
これらは待機の時刻であり、ブラウザーに見えた時刻ではありません。
B1 の早い完了時刻が、共通境界によって遅れて表示されるのがポイントです。
別の実験へ移動して戻ると、新しいリクエストで再実行できます。

## 3. 操作で Suspend

「3. 操作で Suspend」の2つのカードは、クリックごとに生成した2秒の Promise を `React.use` で読みます。
これはサーバーへの通信ではなく、クライアント側の非同期更新です。
Promise を render 内で新しく作らないため、再描画のたびに新たな待機が発生することはありません。

| 操作            | ローカル境界なし                                              | 明示的なローカル Suspense                                    |
| --------------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| 通常更新        | 最寄りのルート Loading まで伝播し、ページ全体が一時的に隠れる | 結果欄だけが fallback に変わり、他のカードと操作ボタンは残る |
| Transition 更新 | すでに表示した結果を保持し、待機中の表示を出す                | 同じく前の結果を保持し、ローカル fallback は出さない         |

`startTransition` の例は、すでに表示された境界を再び隠さない挙動を観察するものです。
新しい境界の初回表示まで fallback が出なくなるという意味ではありません。
ルート Loading に置き換わる場合も外側のレイアウトは残り、完了後にはページの更新結果が現れます。
「更新 1」「更新 2」と繰り返し試せます。

## 実装を読む

- [`routes.tsx`](../src/features/loading/routes.tsx): `Loading`、永続レイアウト、サーバーの待機、兄弟・親子の境界構成。
- [`client.tsx`](../src/features/loading/client.tsx): イベント所有の Promise、`use`、通常更新、`useTransition`、局所的な境界。
- [`loading.e2e.ts`](../../../tests/e2e-server/loading.e2e.ts): 実際のホスト上で fallback・段階的な表示・状態保持・サーバーの待機区間を検証。

## ブラウザー検証

パッケージの bootstrap 後、リポジトリのルートから実行します。
Playwright Chromium が必要です。
未導入なら `tests/e2e-server` で `vp exec playwright install chromium` を実行してください。

```sh
cd tests/e2e-server
vp run test
```

既存の Node/Bun/preview/dev 回帰テストと、新しい Node/preview/dev の Loading テストを実行します。
Loading ページは Node サンプルにのみあるため、そのケースだけ Bun プロジェクトでは対象外です。
サーバーの起動・停止は既存の Playwright 設定が所有します。
ポート 4451〜4454 を空け、実行中に同じサンプルを別途 build しないでください。

## 参考

- [React Suspense: コンテンツを一度に、または入れ子で順次表示する](https://react.dev/reference/react/Suspense)
- [React use: Promise を読み取る](https://react.dev/reference/react/use)
- [React useTransition: 表示済みコンテンツを保持する](https://react.dev/reference/react/useTransition)
- [サンプルの開発ルール](../../AGENTS.md)
