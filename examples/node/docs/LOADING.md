# Loading / Suspense 実験室

Node サンプルの `/loading` で、ページ移動・コンポーネントの更新・ブラウザーでの取得を待つ間、画面のどこが表示されたままになるかを比較します。
待機処理と同じホストのテキストファイルを使うため、外部 API、Cloudflare 認証、デプロイは不要です。

## 起動

リポジトリのルートから実行します。

```sh
vp install
vp exec --filter "./packages/*" -- vp pack
cd examples/node
vp dev --host 127.0.0.1 --port 4455 --strictPort
```

JavaScript を有効にしたブラウザーで `http://127.0.0.1:4455/loading` を開きます。
本番の Node HTTP サーバーと比較する場合は dev を停止し、`examples/node` で次を実行します。

```sh
vp build
HOST=127.0.0.1 PORT=4455 vp run start
```

## 1. ハンドラーのないリンクで Loading

1. 実験メニューの上にあるカウンターを増やします。
2. **1. リンクで2秒待つ**を押します。
3. 移動先の Page が `Effect.sleep("2 seconds")` で待つ間、ルート Loading が表示されることを確認します。
4. メニューとカウンターが Loading に置き換わらず、表示されたままになることを確認します。

リンクは通常の `<a href="/loading/navigation">` で、クリックハンドラーや独自のナビゲーション処理はありません。
`EFFRONT.Loading.make` が fallback を表示し、同じルートスコープの Layout はその境界の外側に残ります。

クライアントナビゲーションには Navigation API と `NavigationPrecommitController` の両方が必要です。
対応環境では、レイアウトのカウンター値も保持されます。
未対応環境ではドキュメント全体のナビゲーションになり、クライアントの状態は再初期化されます。
JavaScript 無効時もリンクは機能しますが、遅延コンテンツを表示する React のスクリプトが実行されず、Loading が残ります。
初回表示やドキュメントナビゲーションでは、ブラウザーや中継サーバーのバッファリングも表示のタイミングに影響します。
後述のブラウザーテストは、対応する Playwright Chromium のクライアントナビゲーションを検証します。

## 2. 並列・直列と表示単位は別

**2. 段階的な表示**を開き、3つのカードを比較します。
秒数はサーバー側の待機時間で、ブラウザーに表示されるまでの時間を保証するものではありません。

| カード | 待機処理                                   | Suspense の境界          | 確認する表示                                       |
| ------ | ------------------------------------------ | ------------------------ | -------------------------------------------------- |
| A      | 独立した A1（1秒）と A2（3秒）             | 兄弟それぞれに配置       | A1 が現れた後も、A2 の fallback が残る             |
| B      | 独立した B1（1秒）と B2（3秒）             | 共通の境界               | B1 が先に完了しても、両方そろうまで表示されない    |
| C      | 親（1.5秒）の結果を使って子（1.5秒）を開始 | 親の境界の内側に子の境界 | 親の fallback → 親の結果と子の fallback → 子の結果 |

共通の Suspense は表示をまとめる境界であり、処理を直列にする仕組みではありません。
C が直列になるのは、JSX が入れ子だからではなく、親の待機後に得た値で子を生成するためです。

結果に表示されるサーバーの開始・完了時刻と実測待機時間を比較してください。
A/B の兄弟の待機区間は重なり、C の子は親の完了後に始まります。
この時刻は処理の記録であり、ブラウザーに見えた時刻ではありません。
B1 の早い完了時刻も、共通境界から両方の結果が表示されるまで見えません。
別の実験へ移動して戻ると、新しいリクエストで繰り返せます。

## 3. 操作で Suspend

**3. 操作で Suspend**を開き、2つのカードで通常更新と Transition 更新を比較します。
クリックごとに作る2秒の Promise を `React.use` で読み取る例で、サーバーへの通信は行いません。

| 更新       | ローカル境界なし                          | ローカル Suspense あり                                           |
| ---------- | ----------------------------------------- | ---------------------------------------------------------------- |
| 通常       | ルート Loading がページ全体を一時的に隠す | 結果欄だけが fallback になり、ボタンと他のカードは残る           |
| Transition | 前の結果を保持し、待機中の表示を出す      | 前の結果を保持し、待機中の表示を出す。ローカル fallback は出ない |

ルート Loading に置き換わる場合も、外側のレイアウトは残ります。
完了後にもう一度操作し、「更新 1」「更新 2」と結果が変わることを確認してください。

Promise は render 内ではなくイベント内で作るため、再描画のたびに待機が始まることはありません。
この例の `startTransition` は表示済みのコンテンツを保持しますが、新しい境界の初回 fallback まで抑制するわけではありません。

## 4. 子が TanStack Query で取得

**4. Query で Suspend**または `http://127.0.0.1:4455/loading/query` を開き、順に操作します。

1. **開始**で取得する子をマウントします。キャッシュがないため、結果欄にローカル Suspense の fallback が出ます。
2. **通常のキー変更**で未取得の次の項目を選ぶと、結果欄が fallback に置き換わります。
3. **Transition のキー変更**でさらに次の項目を選ぶと、`isPending` の間は前の結果が残ります。
4. **同じキーを再取得**で `refetch()` を呼びます。キャッシュを表示したまま `isFetching` が変化し、完了時刻が更新されます。Transition も fallback も使いません。

子が `useSuspenseQuery({ queryKey, queryFn })` を持ち、親から渡すのは項目番号だけです。
Promise props や `React.use` は使いません。
`"use client"` のコンポーネントも SSR されるため、ブラウザーでクリックした後だけ取得する子をマウントします。
JavaScript 無効時は説明と開始ボタンが表示されますが、取得は始まりません。

各取得ではブラウザーで2秒待ってから、同じホストのファイル `public/loading-query.txt` を `fetch` します。
項目番号はキャッシュキーと URL の検索パラメーターに使いますが、静的ファイルの本文は変わりません。
`cache: "no-store"` は HTTP キャッシュを避ける設定で、TanStack Query のキャッシュとは別です。
`staleTime: Infinity` で自動再取得を避け、ボタン操作だけを比較します。

Suspend しない親が `QueryClient` を一度だけ作り、その Provider の内側にローカル Suspense を置くため、初回 Suspend でもクライアントは作り直されません。
キャッシュはページのマウント中だけ保持され、別のページへ移動して戻ると実験は開始前に戻ります。
再取得に失敗しても表示済みデータとエラー説明が残り、同じボタンから再試行できます。

## 実装を読む

- [`routes.tsx`](../src/features/loading/routes.tsx): Loading、永続レイアウト、サーバーの待機、兄弟・親子の境界。
- [`client.tsx`](../src/features/loading/client.tsx): イベントで作る Promise、`use`、通常更新、`useTransition`、ローカル境界。
- [`query-client.tsx`](../src/features/loading/query-client.tsx): クリック後の初回マウント、安定した QueryClient、子が所有する Query。
- [`query.e2e.ts`](../../../tests/e2e-server/query.e2e.ts): SSR とブラウザーの開始境界、初回取得とキー変更、キャッシュ再取得、失敗後の再試行。
- [`loading.e2e.ts`](../../../tests/e2e-server/loading.e2e.ts): 実ホストでの fallback、段階的な表示、状態保持、サーバーの待機区間。

## ブラウザー検証

パッケージの bootstrap 後、リポジトリのルートから実行します。
Playwright Chromium が未導入なら、先に `tests/e2e-server` で `vp exec playwright install chromium` を実行してください。

```sh
cd tests/e2e-server
vp run test
```

Node/Bun/preview/dev の回帰テストと、Node/preview/dev の Loading テストを実行します。
Loading ページは Node サンプルにのみあるため、そのケースは Bun プロジェクトでは実行しません。
Playwright 設定がサーバーを起動・停止します。
ポート 4451〜4454 を空け、実行中に同じサンプルを別途 build しないでください。

## 参考

- [TanStack Query Suspense: useSuspenseQuery、キー変更と Transition、QueryClient の寿命](https://tanstack.com/query/latest/docs/framework/react/guides/suspense)
- [TanStack Query: Background Fetching Indicators](https://tanstack.com/query/latest/docs/framework/react/guides/background-fetching-indicators)
- [React Suspense: コンテンツを一度に、または入れ子で順次表示する](https://react.dev/reference/react/Suspense)
- [React use: Promise を読み取る](https://react.dev/reference/react/use)
- [React useTransition: 表示済みコンテンツを保持する](https://react.dev/reference/react/useTransition)
- [サンプルの開発ルール](../../AGENTS.md)
