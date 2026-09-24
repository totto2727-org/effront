# Loading / Suspense 実験室

Alchemy-managed Cloudflare Worker サンプルの `/loading` では、ページ移動、コンポーネント更新、ブラウザー取得中の表示境界を比較できます。`examples/basic` はこのサンプルへのシンボリックリンクです。

## 起動

リポジトリの依存関係とパッケージが準備済みの環境で、`examples/alchemy` から実行します。

```sh
vp run dev
```

Alchemy CLI の開発環境にはローカルプロファイルなどの前提条件があります。詳しくは [Alchemy integration](../../../packages/alchemy/docs/INTEGRATION.md) を参照してください。表示された開発 URL の `/loading` を JavaScript 有効のブラウザーで開きます。ポートを決め打ちした Vite サーバーや外部 API は使いません。Worker の KV greeting と About、Counter、Server Function は従来どおり `/` と `/about` にあります。

## 1. ハンドラーのないリンクで Loading

1. 実験メニューの上にあるカウンターを増やします。
2. **1. リンクで2秒待つ**を押します。
3. 移動先の Page が `Effect.sleep("2 seconds")` で待つ間、ルート Loading が表示され、外側のレイアウトとメニューは残ることを確認します。

リンクは通常の `<a href="/loading/navigation">` です。`EFFRONT.Loading.make` が fallback を表示します。Navigation API と `NavigationPrecommitController` に対応する環境ではクライアントナビゲーション中にレイアウトのカウンター値も保持されます。非対応環境ではドキュメントナビゲーションとなり、状態は再初期化されます。JavaScript 無効時もリンクは機能しますが、遅延コンテンツを表示する React のスクリプトが実行されず Loading が残ります。初回表示はブラウザーや中継サーバーのバッファリングに影響されます。

## 2. 並列・直列と表示単位

**2. 段階的な表示**で3つのカードを比較します。秒数はサーバーの待機時間であり、ブラウザーの表示時刻を保証しません。

| カード | 待機処理                             | Suspense の境界 | 確認する表示                                       |
| ------ | ------------------------------------ | --------------- | -------------------------------------------------- |
| A      | 独立した A1（1秒）と A2（3秒）       | 兄弟それぞれ    | A1 の後も A2 の fallback が残る                    |
| B      | 独立した B1（1秒）と B2（3秒）       | 共通            | B1 が先に完了しても両方そろうまで表示されない      |
| C      | 親（1.5秒）の結果を子（1.5秒）が使用 | 親の内側に子    | 親の fallback → 親の結果と子の fallback → 子の結果 |

共通境界は表示をまとめるもので、待機を直列化しません。C の子は親の結果を受け取ってから生成されるため直列です。各結果の UTC 開始・完了時刻と実測待機時間はサーバーの記録であり、ブラウザーへの表示時刻ではありません。別の実験に移動して戻ると新しいリクエストで繰り返せます。

## 3. 操作で Suspend

**3. 操作で Suspend**では、クリックイベントごとに作った2秒の Promise を `React.use` で読みます。サーバー通信はありません。

| 更新       | ローカル境界なし                      | ローカル Suspense あり                                       |
| ---------- | ------------------------------------- | ------------------------------------------------------------ |
| 通常       | ルート Loading がページを一時的に隠す | 結果欄のみ fallback になり、ボタンと他のカードは残る         |
| Transition | 前の結果を保持して待機中を表示        | 前の結果を保持して待機中を表示し、ローカル fallback は出ない |

ルート Loading の外側のレイアウトは残ります。操作を繰り返すと「更新 1」「更新 2」と変わります。Promise は render ではなくイベントで作るため再描画ごとに再開しません。`startTransition` は表示済みコンテンツを保持しますが、新しい境界の初回 fallback までは抑制しません。

## 4. 子が TanStack Query で取得

**4. Query で Suspend** (`/loading/query`) を開いて操作します。

1. **開始**で取得する子をマウントし、結果欄に初回 fallback が出ることを確認します。
2. **通常のキー変更**で未取得の項目を選ぶと結果欄は fallback になります。
3. **Transition のキー変更**で次の項目を選ぶと `isPending` 中は前の結果が残ります。
4. **同じキーを再取得**では `refetch()` 中もキャッシュが残り、`isFetching` と完了時刻が更新されます。再取得エラー時も表示済みデータとエラー説明が残り、再試行できます。

子が `useSuspenseQuery({ queryKey, queryFn })` を持ち、親は番号だけを渡します。`"use client"` コンポーネントも SSR されるため、クリック後にだけ取得する子をマウントします。JavaScript 無効時は取得しません。ブラウザーで2秒待ってから同じ Worker ホストの `/loading-query.txt?item=...` を取得します。本文はどのキーでも同じ静的テキストです。`cache: "no-store"` は HTTP キャッシュを避ける設定で、TanStack Query のキャッシュとは別です。`staleTime: Infinity` は自動再取得を避けます。

Suspend しない親が `QueryClient` を一度作り、Provider 内側の Suspense で子を囲みます。キャッシュはページのマウント中だけ保持されます。

## 実装

- [`routes.tsx`](../src/features/loading/routes.tsx): Loading、レイアウト、サーバー待機、兄弟と親子の境界。
- [`client.tsx`](../src/features/loading/client.tsx): イベントで作る Promise と通常/Transition 更新。
- [`query-client.tsx`](../src/features/loading/query-client.tsx): 安定した QueryClient とブラウザーで開始する子の取得。
- [`loading-query.txt`](../public/loading-query.txt): 同じホストから取得する静的レスポンス。

公式 Alchemy CLI の起動はプロファイルなどホスト固有の準備を要します。自動ブラウザー検証を追加する場合は、認証不要のテストホストだけでなく実 Worker でのストリーミング、静的ファイル配信、SSR と hydration も確認してください。

## 参考

- [TanStack Query Suspense](https://tanstack.com/query/latest/docs/framework/react/guides/suspense)
- [TanStack Query Background Fetching Indicators](https://tanstack.com/query/latest/docs/framework/react/guides/background-fetching-indicators)
- [React Suspense](https://react.dev/reference/react/Suspense)
- [React use](https://react.dev/reference/react/use)
- [React useTransition](https://react.dev/reference/react/useTransition)
