通常のリンクで、共有 Layout を維持したまま Page を切り替えられます。

## 通常のリンクで移動する {#native-navigation}

登録済みのページへはアンカーで移動します。

```tsx
<a href="/settings">Settings</a>
```

検索欄などの状態をページ間で保持するには、共有 Layout に配置してください。
対応ブラウザーでは、既定で Page がフェードし、共有 Layout はアニメーションの対象外です。

> [!NOTE]
> クライアントナビゲーションに非対応のブラウザーはドキュメント全体を読み込むため、Layout の状態はリセットされます。
> JavaScript が無効でもリンクは利用できます。
> 詳細は[ブラウザーの対応](/ja/architecture/implementation/navigation#browser-start)を参照してください。

## Page のアニメーションを無効にする {#transition-scope}

以下の抜粋では、`./effront` の共有ファクトリー `EFFRONT` と、`./routes` の[登録済みのルート定義](/ja/guide/routes#application)を使います。

Page 定義:

```tsx
import { Effect } from "effect";
import { EFFRONT } from "./effront";

export const SettingsPage = EFFRONT.Page.make({
  viewTransition: false,
  render: () => Effect.succeed(<h1>Settings</h1>),
});
```

`SettingsPage` を [Routes.page](/ja/guide/routes#routes) で登録してください。
リンクから登録先の URL へ移動すると、Settings 自体の Page アニメーションは発生しません。

> [!NOTE]
> 遷移元の Page でアニメーションが有効なら、遷移元はアニメーションする場合があります。
> OS の動きを減らす設定は、入力状態やフォーカスをリセットせずに Page のアニメーションを抑制します。

## アプリケーション全体のアニメーションを無効にする {#global-config}

アプリケーション定義:

```tsx
import { PageViewTransition } from "@effront/core";
import { Layer } from "effect";
import { EFFRONT } from "./effront";
import { routes } from "./routes";

export default EFFRONT.make({
  routes,
  layer: Layer.succeed(PageViewTransition, { enabled: false }),
});
```

Page 側で明示的に有効にしない限り、Page アニメーションなしで切り替わります。
Settings だけアニメーションを有効にするには、Page 定義を置き換えます。

```tsx
export const SettingsPage = EFFRONT.Page.make({
  viewTransition: { enabled: true },
  render: () => Effect.succeed(<h1>Settings</h1>),
});
```

対応ブラウザーでは、動きを減らす設定が無効なら Settings のアニメーションを利用できます。
独自のアニメーションやその他の設定は [PageViewTransition リファレンス](/ja/api-reference/components#view-transition)を参照してください。

## 内容が届くまで読み込み UI を表示する {#commit-and-stream}

遷移先は、内容の読み込みが完了する前に表示される場合があります。
内容が届くまで [Loading または Suspense](/ja/guide/routes#mount)を表示してください。
ストリーミング中に失敗し得る内容には [React Error Boundary](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)を追加してください。
URL の更新タイミングとキャンセルの動作は[画面表示とストリームの完了](/ja/architecture/implementation/navigation#transition-commit)を参照してください。

## 戻る・進むと再読み込み {#history-cache}

戻る・進むでは、その履歴エントリーで読み込みが完了したレスポンスを再利用できます。
再読み込みや[ドキュメント読み込みへの切り替え](/ja/architecture/implementation/navigation#flight-load)では、新しいドキュメントを読み込みます。

> [!NOTE]
> ドキュメント全体を読み込むと、Layout の状態は失われます。
> 重要なユーザー入力は、Layout とは別に保存してください。
