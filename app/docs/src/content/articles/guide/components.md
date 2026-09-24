データへのアクセスをサーバー側に保ちながら、サーバーで描画する UI と操作を受け付ける Client Component を組み合わせます。
再利用できる挨拶の表示とカウンターを組み合わせる例で、それぞれのコンポーネントの役割を確認できます。

## 処理に合うコンポーネントを選ぶ {#boundary}

| 処理                                 | 使うもの                                   |
| ------------------------------------ | ------------------------------------------ |
| サービスからデータを取得して表示する | Page または `EFFRONT.Component`            |
| クリック、入力、ローカルの状態を扱う | Client Component                           |
| サーバーにデータを送信する           | [Server Function](/guide/server-functions) |

データの取得はサーバー側に置き、操作が必要な部分にだけ Client Component を加えます。

## サーバー側の表示を再利用する {#server}

[Routes](./routes.md#application) の `src/entry.effront.tsx` で `Welcome` を定義し、`HomePage` を置き換えます。

```tsx
// src/entry.effront.tsx: add before HomePage.
const Welcome = EFFRONT.Component.make({
  render: ({ name }: { readonly name: string }) => Effect.succeed(<p>Hello, {name}.</p>),
});

// Replace HomePage.
const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(<Welcome name="Ada" />),
});
```

開発サーバーに表示された URL を開くと `Hello, Ada.` と表示されます。
データを使う場合は、`render` が返す Effect の中で[アプリケーションサービス](./effect.md)を読み取ります。

## 操作できる UI を加える {#client-boundary}

`src/components/counter.tsx` を作り、先頭に `"use client"` を記述します。

```tsx
"use client";

import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((value) => value + 1)}>Count: {count}</button>;
}
```

`src/entry.effront.tsx` で import し、`HomePage` を再び置き換えます。

```tsx
// src/entry.effront.tsx: add to the imports.
import { Counter } from "./components/counter";

// Replace HomePage.
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

開発サーバーに表示された URL を開いて `Count: 0` をクリックすると、カウンターが増えます。
`Welcome` コンポーネントはサーバー側で描画されます。

> [!WARNING]
> Client Component とその import 先から、サーバー専用のサービスを import しないでください。
> props には表示に使う値を渡し、サービス、Request、環境オブジェクトは渡しません。
> 値は [React がシリアライズできるもの](https://react.dev/reference/rsc/use-client#serializable-types-returned-by-server-components)で、閲覧者に公開してよいものに限ります。

境界の規則は React の [`"use client"` リファレンス](https://react.dev/reference/rsc/use-client)を参照してください。
