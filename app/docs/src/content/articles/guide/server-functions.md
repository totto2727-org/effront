Server Function を使うと、フォームや Client Component からサーバー側の Effect ハンドラーを呼び出せます。
入力はサーバー側で Schema によって検証されます。
まずフォームから Server Function に名前を直接送り、その後 `useActionState` で応答と送信中の状態を表示します。

## アプリケーション定義を共有する {#identity}

`src/effront.ts` を作り、同じ `EFFRONT` をアプリケーションエントリーと Server Function のモジュールで import します。

```typescript
import { Application } from "@effront/core";

export const EFFRONT = Application.effront();
```

> [!WARNING]
> Page とアクションのために、別々のアプリケーション定義を作らないでください。

アクションがアプリケーションサービスを使う場合は、[サービスのガイド](/guide/effect)に沿って宣言と提供を行います。

## フォームを直接送信する {#forms}

Server Function をフォームの `action` に直接渡します。
ハンドラーは `Effect<void>` を返します。
`src/record-name.ts` を作り、先頭に `"use server"` を記述します。

```typescript
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

export const recordName = EFFRONT.ServerFn.make({
  input: Schema.fromFormData(Schema.Struct({ name: Schema.NonEmptyString })),
  handler: ({ name }) => Effect.logInfo("Name submitted", { name }),
});
```

## フォームを表示して送信する {#application}

`src/entry.effront.tsx` で共有の定義を import し、フォームを表示します。

```tsx
// src/entry.effront.tsx: replace the Application import.
import { EFFRONT } from "./effront";
// Add to the imports.
import { recordName } from "./record-name";

// Remove the local EFFRONT declaration.
// Replace HomePage.
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

ブラウザーで `/` を開いて `Ada` を入力し、**Record name** を選びます。
送信すると、サーバーログに `Name submitted` と出力されます。
データの保存や完了メッセージの表示は行いません。

> [!WARNING]
> Server Function には、ページ側とは別に入力の検証とアクセス制御が必要です。
> ページとは独立して呼び出せる API として公開されるためです。

## useActionState でフォームの状態を加える {#state}

サーバーの応答を表示し、送信中にボタンを無効にするため、状態を返す Server Function と Client Component を追加します。

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

> [!WARNING]
> `previousState` もクライアントから送信される信頼できない情報源です。
> できるだけ、個別に検証したフォーム引数を使ってください。
> `previousState` を使う場合は、上の例の Schema のように、必ずほかの入力と同等の検証を行ってください。

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

`src/entry.effront.tsx` で、直接送信するフォームを `GreetingForm` に置き換えます。

```tsx
// src/entry.effront.tsx: replace the recordName import.
import { GreetingForm } from "./greeting-form";

// Replace HomePage.
const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(<GreetingForm />),
});
```

ブラウザーで `/` を開いて `Ada` を入力し、**Greet** を選びます。
送信後、フォームに `Hello, Ada.` と表示されます。

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

> [!WARNING]
> Page などのサーバー側コードから、Server Function を直接呼び出さないでください。
> 同じ操作をサーバー側でも使う場合は、共有のサービスや Effect 関数に切り出します。

## 更新を扱う {#refresh}

呼び出しが成功すると、Effront は現在のルートを再描画します。
Page で保存済みの値を読み取れば、更新後の表示に反映されます。

## 失敗を扱う {#errors}

想定内の業務上の失敗は状態として返すと、`useActionState` で表示できます。
`src/greet.ts` で、`Admin` を予約済みの名前として扱います。

```typescript
// src/greet.ts: replace greet to return an expected failure as form state.
export const greet = EFFRONT.ServerFn.make({
  input: [
    Schema.Struct({ message: Schema.String }),
    Schema.fromFormData(Schema.Struct({ name: Schema.NonEmptyString })),
  ],
  handler: (_previousState, { name }) => {
    if (name === "Admin") {
      return Effect.succeed({ message: "That name is reserved." });
    }
    return Effect.succeed({ message: `Hello, ${name}.` });
  },
});
```

`Admin` を入力して **Greet** を選ぶと、`That name is reserved.` と表示されます。
`Ada` を入力して再び送信すると、`Hello, Ada.` と表示されます。
予約済みの名前の分岐は状態を返すため、アクションを失敗させずに `state.message` を更新します。

Schema のデコードに失敗した場合、ハンドラーは実行されません。
例えば、既存の `Schema.NonEmptyString` は、どちらの分岐にも進む前に空の名前を拒否します。
デコードやハンドラーの失敗はアクションの失敗になり、`state.message` は自動で更新されません。
不正なフィールドにインラインで説明を出す必要がある場合は、先に拒否するのではなく、ハンドラーが値を受け取って報告できる Schema を選びます。
状態とエラーの扱いは React の [useActionState リファレンス](https://react.dev/reference/react/useActionState)を参照してください。
