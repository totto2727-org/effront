Effront では、データ取得をブラウザー側へ移さずに、ページに操作できる UI を追加できます。
サーバー側の処理は Page や再利用できる Server Component に置き、ユーザーの操作が必要な箇所に Client Component を表示します。
以下の例は、ルートに登録した Page と共有の `EFFRONT` 定義があるアプリケーションを前提にしています。

## 処理をどこに置くか決める {#boundary}

ページ全体をサーバー専用やクライアント専用にするのではなく、必要な処理に合わせてコンポーネントの役割を選びます。

| やりたいこと                                                    | 処理を置く場所                                             |
| --------------------------------------------------------------- | ---------------------------------------------------------- |
| アプリケーションのサービスからデータを読み取り、UI を組み立てる | Page または Server Component                               |
| クリックに反応する、入力を扱う、UI 内の状態を更新する           | Client Component                                           |
| 送信された入力を検証し、サーバー側のデータを更新する            | UI から呼び出す [Server Function](/guide/server-functions) |

例えば、サーバーで用意した挨拶の隣に、ブラウザーで管理するカウンターを表示できます。
挨拶にはブラウザーの状態が不要で、カウンターを増やすだけならサーバー側の更新は不要です。
この二つの役割を分けて作り、Page で組み合わせます。

## 再利用するサーバー側の表示を切り出す {#server}

`src/entry.effront.tsx` で、アプリケーションの既存の `EFFRONT` を使い、`Component.make` で共通の表示を定義します。
この例では挨拶を `Welcome` に切り出し、別の Page からも名前を変えて表示できるようにします。

```tsx
import { Effect } from "effect";

const Welcome = EFFRONT.Component.make({
  render: ({ name }: { readonly name: string }) => Effect.succeed(<p>こんにちは、{name} さん。</p>),
});

const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(<Welcome name="Ada" />),
});
```

`HomePage` をルートの Page として使うと、「こんにちは、Ada さん。」と表示されます。
Page が `name` を props として渡し、コンポーネントの `render` コールバックが挨拶を Effect で返します。
このような固定の表示には `Effect.succeed` を使えます。
サービスのデータが必要な場合は、`render` が返す Effect の中で取得し、その結果から組み立てた UI を返します。
同じアプリケーションの `EFFRONT` で作ったコンポーネントでは、Page と同様にアプリケーションのサービスを利用できます。

## Page を移さずに操作できる UI を加える {#client-boundary}

操作を担当するコンポーネントは `src/components/counter.tsx` という別のファイルに置き、先頭に `"use client"` を書きます。
React の状態やイベントハンドラーは、サーバー側の `render` コールバックではなく、このファイル内で使います。

```tsx
"use client";

import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((value) => value + 1)}>Count: {count}</button>;
}
```

`"use client"` は import 先のモジュールにも影響するため、このファイルからサーバー専用のサービスを import しないでください。
この境界の詳しい説明は [React のリファレンス](https://react.dev/reference/rsc/use-client)を参照してください。

`src/entry.effront.tsx` に戻り、`Counter` を import して、先ほどの `HomePage` の定義を次のものに置き換えます。
同じファイルにある `Welcome` と既存の `Effect` の import は残します。

```tsx
import { Counter } from "./components/counter";

const HomePage = EFFRONT.Page.make({
  render: () =>
    Effect.succeed(
      <>
        <Welcome name="Ada" />
        <Counter />
      </>,
    ),
});
```

ルートを開くと、挨拶と `Count: 0` のボタンが表示されます。
クリックするたびにボタンの数値が増え、Page のデータ取得はサーバー側に保たれます。

Client Component でもサーバーのデータが必要な場合は、表示や処理に使う値だけを渡します。
例えば、名前を取得したサービスではなく、表示する名前を渡します。
サーバーから Client Component に渡す props は、[React がシリアライズできる値](https://react.dev/reference/rsc/use-client#serializable-types-returned-by-server-components)であり、閲覧者に公開してよいものでなければなりません。
環境変数、Request、Effect のサービスを直接渡してはいけません。
ローカルの状態を変えるだけでなくサーバー側にデータを保存する UI には、前述の Server Function を使います。

スタイルを追加する場合は、[Tailwind CSS のガイド](/guide/styling)を参照してください。
`effrontTailwind()` を使わずにグローバル CSS を手動で読み込む場合は、Layout が実際に表示する export 済み Client Component から import します。
アプリケーション定義オブジェクトだけから CSS を import すると、ページに反映されない場合があります。
