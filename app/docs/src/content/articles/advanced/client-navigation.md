## ブラウザーのナビゲーションを使う {#native-navigation}

リンクには通常の `a` 要素を使います。Effront は React Router ではなく、ブラウザーの Navigation API で対象の遷移を intercept します。`window.navigation` と `NavigationPrecommitController` の両方がある場合に クライアントルーターを有効にします。History API による代替ルーターはありません。

```tsx
<a href="/settings">設定を開く</a>
```

intercept 可能で、ハッシュだけの移動、ダウンロード、フォーム送信、reload ではない遷移が対象です。 対応 API がないブラウザーでも Client Components の hydration、Server Functions、 現在のページのストリーム更新と開発時の HMR は有効です。リンクはドキュメント全体を移動します。 JavaScript を無効にした場合も SSR のリンクとネイティブ送信するフォームを利用できます。

## 最初の commit とストリーム完了 {#commit-and-stream}

- React Transition 内で遷移先の Flight を取得します。現在の画面は後続の画面が準備される間も維持します。 共通する Layout の先頭部分を保ちながら、新しいツリーを別の Transition で公開します。

- 通常のキャンセル可能な遷移では、遷移先の最初の UI commit で precommit handler が完了します。 ブラウザーは URL と履歴を commit し、標準のフォーカス移動とスクロール処理を進められます。 Suspense の全内容や Flight EOF を待つ必要はありません。

- commit 後の Flight は、EOF または React による当該レンダーの退役までブラウザー側の runtime が所有します。 別のリンクを押しただけで現在の表示のストリームを閉じず、後続のレンダーへの切り替えを確認して解放します。

commit 前の中止や後続遷移による置き換えは、未採用の画面候補を破棄して通信を解放します。 commit 後の残りのストリームは Browser Stop の signal から切り離されます。 その後の Flight エラーを扱うため、アプリケーションの適切な位置に React Error Boundary を設けます。 ブラウザーがキャンセル不可とする履歴移動では、precommit ではなく通常の intercept handler を使います。

## 履歴キャッシュとリダイレクト {#history-cache}

戻る・進むでは、遷移が commit した正確な履歴 entry id に紐づく完了済みツリーを再利用できます。 URL だけで共有するキャッシュではありません。push、replace、未キャッシュの履歴移動は新しい Flight を取得します。 履歴 entry の dispose で対応するキャッシュを削除し、ルート更新の準備時には全履歴キャッシュを無効化します。

Flight のリダイレクトはレスポンスの最終 URL を確認します。同一 origin の通常遷移では precommit の redirect を使い、別 origin や履歴移動中の URL 変更などではドキュメント移動へ切り替えます。 非成功レスポンスや Flight 以外のレスポンスもドキュメント移動として扱います。

フォーカスとスクロールはブラウザー標準の動作を使います。commit 後にも Suspense の内容が増えるため、 履歴に記録される位置は fallback 表示中の位置になり得ます。 ストリーム完了に合わせた独自のスクロール復元は実装されていません。

## ページ遷移のアニメーション {#transition-scope}

Effront は Page の描画に React の ViewTransition 境界を追加し、既定でページの切り替えをクロスフェードします。 共有する Layout は境界の外に残ります。アプリケーション全体の設定は PageViewTransition の Layer で、個々の Page は viewTransition で上書きします。

既定のクラス対応は通常の遷移を auto、hmr-refresh と navigation-ua-visual-transition を none にします。動きを減らす OS 設定では Page のアニメーションを抑制し、 設定が途中で変わっても入力値やフォーカスを保持します。

```tsx
import { Effect, Layer } from "effect";
import { PageViewTransition } from "@effront/core";

// EFFRONT.make の layer に渡す設定
const transitions = Layer.succeed(PageViewTransition, {
  default: {
    default: "auto",
    "hmr-refresh": "none",
    "navigation-ua-visual-transition": "none",
    "photo-next": "photo-fade",
  },
});

// このページだけ無効化
const QuietPage = EFFRONT.Page.make({
  viewTransition: false,
  render: () => Effect.succeed(<h1>Quiet page</h1>),
});
```

全体を無効にする場合は `Layer.succeed(PageViewTransition, { enabled: false })` を使います。 無効化はその Page の境界に適用します。有効なページから無効なページへ移動するときは、遷移元の終了アニメーションが残る場合があります。 独自のクラスを指定した場合は、アプリケーションの CSS で View Transition の疑似要素を装飾します。 クラスと種別の対応は [React の ViewTransition](https://react.dev/reference/react/ViewTransition) を参照してください。

```tsx
<a href="/photos/2" data-effront-transition-types="photo-next">
  次の写真
</a>
```

リンクの属性は push・replace に独自の種別を追加します。戻る・進むには再適用されません。 navigation と navigation-\*、server-function、hmr-refresh はフレームワークが付ける予約済みの種別です。 既存の startTransition と addTransitionType を利用し、URL の確定を Flight の完了まで待たせません。 後から解決する Suspense の表示には、アプリケーション側で個別の境界を追加できます。

ネイティブ API の仕様は[MDN の Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)を参照してください。
