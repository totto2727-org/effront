ページを移動しても、メニューの開閉状態や検索欄の入力値を保てます。
Effront では、こうした操作部品を共有 Layout に置き、通常のリンクで移動しながら、Page の内容だけをアニメーションさせられます。
まずこの構成を用意し、画面に合ったアニメーションと読み込み中の表示を選びます。

## 共通の操作部品を Page の外に置く {#native-navigation}

ページを移動しても状態を残したい操作部品は、対象のルートが共有する Layout に置きます。
ルートごとに切り替わる内容は、それぞれの Page に置きます。
移動先へのリンクには、通常のアンカーを使います。

```tsx
<a href="/settings">設定を開く</a>
```

クライアントナビゲーションでは、Effront は共有 Layout を維持したまま Page を更新します。
そのため、Layout 内の検索欄は、リンクで移動しても入力値を保てます。
状態を残したいコンポーネントに URL ごとに変わる `key` を付けたり、各 Page の中で作り直したりしないでください。
再マウントすると状態がリセットされます。

この動作には、ブラウザーの `window.navigation` と `NavigationPrecommitController` の両方が必要です。
対応していないブラウザーでは、同じリンクでもドキュメント全体を読み込むため、メモリ上のクライアント状態はページをまたいで保持されません。
JavaScript が有効であれば、Client Components と Server Functions は引き続き利用できます。
JavaScript が無効でも、サーバーで描画したリンクやブラウザー標準のフォーム送信は利用できます。

ハッシュだけの移動、ダウンロード、フォーム送信、再読み込みは、クライアント側のページ切り替えとして扱わず、ブラウザーに任せます。
ブラウザーが介入を許可しない遷移も、そのままブラウザーに任せます。
基盤となるブラウザー API は [MDN の Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) を参照してください。

## 切り替わる内容のアニメーションを選ぶ {#transition-scope}

共通の操作部品を Layout に置けば、既定のアニメーションもその構成に合った範囲に適用されます。
対応ブラウザーでは Page がクロスフェードし、共有 Layout はアニメーションの対象外に残ります。
この既定の動作に追加設定は不要です。
OS で動きを減らす設定が有効な場合は Page のアニメーションを抑制し、ページを開いている途中で設定を変えても入力値やフォーカスを失いません。

既定の動作が合わない場合にだけ、設定を上書きします。

- 特定の Page のアニメーションを無効にするには、`Page.make` に `viewTransition: false` を指定します。
- アプリケーション全体で Page のアニメーションを無効にするには、`EFFRONT.make` の `layer` オプションに `Layer.succeed(PageViewTransition, { enabled: false })` を渡します。
- 全体を無効にしたうえで特定の Page だけ有効に戻すには、その Page に `viewTransition: { enabled: true }` を指定します。

各 Page はそれぞれの設定に従うため、アニメーションが有効な Page から無効な Page へ移動しても、遷移元の終了アニメーションが残る場合があります。
すでにマウントされた Page の `enabled` を変更すると、OS の動きを減らす設定を変更した場合とは異なり、その Page 内の状態がリセットされることがあります。

独自の動きを付けるには、`PageViewTransition` で遷移の種別と CSS クラスを対応付けます。
たとえば写真を順に見る画面では、通常の遷移を既定のアニメーションに保ちながら、`photo-next` という種別で `photo-fade` を選べます。
以下の `transitions` Layer を `EFFRONT.make({ routes, layer: transitions })` に渡し、必要に応じてほかのアプリケーション用 Layer と組み合わせます。
別に示した `QuietPage` は、Page 単位で無効にする例です。

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

`photo-fade` に対応する View Transition の疑似要素のスタイルは、アプリケーションの CSS に用意してください。
この対応表が選ぶのはクラスであり、組み込みの写真用アニメーションではありません。
種別とクラスの対応表はマージされずに置き換わるため、この例では HMR とブラウザー自身による視覚的な遷移に対する既定の `none` の指定も残しています。
Page の `viewTransition` はアプリケーションの設定をプロパティごとに上書きし、対応表にも同じ置き換えの規則が適用されます。

リンクで独自の種別を選ぶには、`data-effront-transition-types` を使います。

```tsx
<a href="/photos/2" data-effront-transition-types="photo-next">
  次の写真
</a>
```

この属性で種別が追加されるのは、履歴を追加または置き換える push・replace の遷移だけです。
後から戻る・進むを操作しても、その種別は再適用されません。
独自の名前を使い、予約されている `navigation`、`navigation-*`、`server-function`、`hmr-refresh` は使わないでください。

このアニメーションの対象は Page の切り替えであり、その後に Page 内で起きる更新すべてではありません。
Suspense の解決後に表示される内容にもアニメーションが必要であれば、その内容を React の ViewTransition 境界で囲みます。
遷移のクラス、種別、スタイルの詳細は [React の ViewTransition](https://react.dev/reference/react/ViewTransition) を参照してください。

## 遷移後に届く内容の表示に備える {#commit-and-stream}

遷移先は、すべての内容を読み込み終わる前に、Suspense の fallback を含んだ状態で表示されることがあります。
fallback には読み込み中だとわかる UI を用意し、残りのストリームを受け取る途中で失敗し得る内容を React Error Boundary で囲みます。
ページが最初に表示されたからといって、レスポンスの全内容を正常に受け取り終えたとは限りません。

遷移先を表示できるようになるまでは、現在のページが表示されたままになります。
通常のキャンセル可能な遷移では、遷移先の最初の表示に合わせて URL と履歴が確定し、ブラウザー標準のフォーカス移動とスクロール処理が進みます。
戻る・進むにはキャンセル不可の遷移もあり、その場合は画面より先に URL が変わることがあります。

表示待ちの遷移先が現れる前に別の移動先を選ぶと、Effront は表示待ちの遷移先を破棄し、その通信を終了します。
まだ表示されているページは、ストリームが完了するか新しいページに置き換わるまで、内容を受け取り続けられます。
いったん表示されたページの残りのストリームはブラウザーの停止操作では中断されないため、その後の失敗を遷移のキャンセルで処理しようとせず、エラー表示を用意してください。

## 戻る・進むとページ全体の読み込みを考慮する {#history-cache}

戻る・進むでは、その履歴項目で以前の読み込みが完了した内容を再利用できます。
同じ URL へのすべての訪問で共有するキャッシュではないため、履歴を追加または置き換える場合は移動先を取得し直します。
履歴項目に保存された内容がない場合も、新たな取得が必要です。
保存済みの内容へ戻る場合でも、読み込みを待つ場合でも使えるページにしてください。

スクロール復元とフォーカスは、引き続きブラウザーの動作に従います。
最初の表示の後で Suspense の内容が増えると、fallback を表示していたときの位置へ復元されることがあります。
Effront はストリームの全内容が届くまで待ってから、改めて位置を復元するわけではありません。

通常の同一オリジンへのリダイレクトは、クライアントナビゲーションとして続行できます。
別オリジンへのリダイレクト、履歴移動中に URL が変わるリダイレクトなど、クライアントナビゲーションを続けられない場合は、ドキュメント全体を読み込みます。
HTTP の非成功レスポンスや、ページ更新に使う Flight 形式以外のレスポンスを受け取った場合も、ドキュメント全体の読み込みに切り替わります。
こうした読み込みでは共有 Layout のメモリ上のクライアント状態は残らないため、ユーザーが失ってはいけないデータの永続保存を Layout の状態保持だけに頼らないでください。
