Server Function を使うと、フォームや Client Component からサーバー側の Effect ハンドラーを呼び出せます。
入力はサーバー側で Schema によって検証されます。
以下の挨拶フォームは、React の `useActionState` でサーバーの応答を表示します。
戻り値が不要なフォームには、[直接 action に渡す方法](#forms)を使えます。

[はじめにのサンプル](./getting-started.md)を [http://127.0.0.1:1340](http://127.0.0.1:1340) で起動した状態で進めます。

## アプリケーション定義を共有する {#identity}

`src/effront.ts` を作り、同じ `EFFRONT` をアプリケーションエントリーと Server Function のモジュールで import します。

```typescript
import { Application } from "@effront/core";

export const EFFRONT = Application.effront();
```

Page とアクションのために、別々のアプリケーション定義を作らないでください。
アクションがアプリケーションサービスを使う場合は、[サービスのガイド](/guide/effect)に沿って宣言と提供を行います。

## フォームの状態を返す {#state}

`src/greet.ts` を作り、先頭に `"use server"` を記述します。

```typescript
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

export const greet = EFFRONT.ServerFn.make({
  input: [
    Schema.Struct({ message: Schema.String }),
    Schema.fromFormData(Schema.Struct({ name: Schema.NonEmptyString })),
  ],
  handler: (_previousState, { name }) => Effect.succeed({ message: `Hello, ${name}.` }),
});
```

`useActionState` は前回の状態、`FormData` の順に渡します。
`input` 配列は、ハンドラーの実行前に同じ順序で引数を検証します。
検証後も、前回の状態はクライアントが変更できる入力です。
権限や保存済みデータの証拠には使わないでください。

`src/greeting-form.tsx` を作成します。

```tsx
"use client";

import { useActionState } from "react";
import { greet } from "./greet";

export function GreetingForm() {
  const [state, formAction, pending] = useActionState(greet, { message: "" });
  return (
    <form action={formAction}>
      <label>
        Name
        <input name="name" required />
      </label>
      <button disabled={pending} type="submit">
        Greet
      </button>
      <p aria-live="polite">{state.message}</p>
    </form>
  );
}
```

JavaScript の読み込み前にもフォームを送信できるよう、async 関数で包まずに `greet` を直接 `useActionState` に渡します。
`required` はブラウザーで入力を確認し、Schema はサーバーでも検証します。

## フォームを表示して送信する {#application}

`src/entry.effront.tsx` を作成します。

```tsx
import { Effect } from "effect";
import { EFFRONT } from "./effront";
import { GreetingForm } from "./greeting-form";

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <body>{children}</body>
      </html>,
    ),
});

const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(<GreetingForm />),
});

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage),
});
```

[http://127.0.0.1:1340](http://127.0.0.1:1340) を開いて `Ada` を入力し、**Greet** を選びます。
送信後、フォームに `Hello, Ada.` と表示されます。

## 状態を返さずに送信する {#forms}

結果の値が不要なフォームでは、`void` を返す Server Function を直接 `action` に渡します。
`src/record-name.ts` を作成します。

```typescript
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

export const recordName = EFFRONT.ServerFn.make({
  input: Schema.fromFormData(Schema.Struct({ name: Schema.NonEmptyString })),
  handler: ({ name }) => Effect.logInfo("Name submitted", { name }),
});
```

エントリーモジュールの `GreetingForm` の import を削除し、`recordName` を import して `HomePage` を置き換えます。

```tsx
import { recordName } from "./record-name";

const HomePage = EFFRONT.Page.make({
  render: () =>
    Effect.succeed(
      <form action={recordName}>
        <label>
          Name
          <input name="name" required />
        </label>
        <button type="submit">Record name</button>
      </form>,
    ),
});
```

送信すると、サーバーログに `Name submitted` と出力されます。
データの保存や完了メッセージの表示は行いません。
ログ出力を保護が必要な更新に置き換える前に、ハンドラーまたはその [Middleware](/guide/middleware) で呼び出し元を認証し、操作を認可してください。
ページを保護してもアクションは保護されず、hidden フィールドもクライアントが変更できる入力です。

## オブジェクトを引数に取る {#input}

Client Component のイベントハンドラーがオブジェクトを持っている場合は、`Schema.Struct` を直接使います。
`src/greet-object.ts` を作成します。

```typescript
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

export const greetObject = EFFRONT.ServerFn.make({
  input: Schema.Struct({ name: Schema.NonEmptyString }),
  handler: ({ name }) => Effect.succeed(`Hello, ${name}.`),
});
```

クライアント側で import すると、`await greetObject({ name: "Ada" })` のように呼び出せます。
呼び出し側はエンコードされた入力を渡し、ハンドラーはデコードされた値を受け取ります。
Schema の配列は位置引数を表し、`Schema.Array(...)` や `Schema.Tuple(...)` は一つの配列値の引数を表します。

Page などのサーバー側コードから、Server Function を直接呼び出さないでください。
同じ操作をサーバー側でも使う場合は、共有のサービスや Effect 関数に切り出します。

## 更新と失敗を扱う {#refresh}

呼び出しが成功すると、Effront は現在のルートを再描画します。
Page で保存済みの値を読み取れば、更新後の表示に反映されます。

Schema のデコードに失敗した場合、ハンドラーは実行されません。
デコードやハンドラーの失敗はアクションの失敗になり、`state.message` は自動で更新されません。
想定内の業務上の失敗は、ハンドラーから状態の値として返します。
不正なフィールドにインラインで説明を出す必要がある場合は、先に拒否するのではなく、ハンドラーが値を受け取って報告できる Schema を選びます。
状態とエラーの扱いは React の [useActionState リファレンス](https://react.dev/reference/react/useActionState)を参照してください。
