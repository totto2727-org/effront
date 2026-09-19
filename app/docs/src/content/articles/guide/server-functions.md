フォームの送信では、ブラウザー側のイベント処理だけでなく、入力の検証、サーバー側のサービスの呼び出し、結果の表示が必要になることがあります。
Effront の Server Function を使うと、個別の API エンドポイントを用意せずに、この流れをつなげられます。
このページでは、名前を送信して挨拶文を受け取るフォームを作り、その後で副作用だけを実行するフォームやオブジェクトを渡す呼び出しへ応用します。

中心となる例では、利用者にサーバーの処理結果を伝えるために `useActionState` を使います。
戻り値が不要なフォームなら、[action に直接渡す方法](#forms) のほうが簡単です。

## action で使うサービスを用意する {#identity}

フォームから名前を送り、サービスで挨拶文に変換します。
次の実装を `src/greeting.ts` に作成するか、[サービスのガイド](/guide/effect) の `Greeting` を再利用してください。
この例では「こんにちは、Ada さん。」という日本語の挨拶文を返します。

```typescript
import { Context, Effect, Layer } from "effect";

export class Greeting extends Context.Service<
  Greeting,
  { readonly message: (name: string) => Effect.Effect<string> }
>()("app/services/Greeting") {
  static readonly layer = Layer.succeed(Greeting, {
    message: (name) => Effect.succeed(`こんにちは、${name} さん。`),
  });
}
```

`src/effront.ts` で、このサービスを使うことを宣言します。
アプリケーションのエントリーと Server Function では、ファイルごとに `Application.effront()` を呼び出すのではなく、この同じ `EFFRONT` を import します。
サービスの実装は、後でページを組み立てるときに提供します。

```typescript
import { Application } from "@effront/core";
import { Greeting } from "./greeting";

export const EFFRONT = Application.effront<Greeting>();
```

## 挨拶文をフォームに返す {#state}

`src/greet.ts` を作成し、先頭に `"use server"` を記述します。
`ServerFn.make` には、入力の Schema と Effect を返す handler を渡します。
ここでは handler から `Greeting.message` を呼び出し、次のフォームの state を `{ message }` として返します。

`useActionState` は、前回の state に続いて、送信された `FormData` を渡します。
`input` の配列は、この二つの引数を順番に表しています。
`Schema.fromFormData` が `name` フィールドをデコードし、`Schema.NonEmptyString` が handler の実行前に空の名前を拒否します。
前回の state も検証されますが、クライアントから届く値を検証しただけで、権限や保存済みデータを証明する信頼できる情報になるわけではありません。

```typescript
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";
import { Greeting } from "./greeting";

const StateSchema = Schema.Struct({ message: Schema.String });
const FormSchema = Schema.fromFormData(Schema.Struct({ name: Schema.NonEmptyString }));

export const greet = EFFRONT.ServerFn.make({
  input: [StateSchema, FormSchema],
  handler: (_previousState, { name }) =>
    Effect.gen(function* () {
      const greeting = yield* Greeting;
      const message = yield* greeting.message(name);
      return { message };
    }),
});
```

次に、Client Component として `src/greeting-form.tsx` を作成します。
Server Function 自体を `useActionState` に渡し、返された action をフォームに接続して、`state.message` を結果として表示します。
送信中は `pending` の値を使ってボタンを無効にします。

`greet` を async 関数で包まず、そのまま参照を渡してください。
React が JavaScript の読み込み前のフォーム送信を扱うために使う、ネイティブの Server Function 参照を保てます。

```tsx
"use client";

import { useActionState } from "react";
import { greet } from "./greet";

export function GreetingForm() {
  const [state, formAction, pending] = useActionState(greet, { message: "" });
  return (
    <form action={formAction}>
      <input name="name" required />
      <button disabled={pending} type="submit">
        挨拶する
      </button>
      <p aria-live="polite">{state.message}</p>
    </form>
  );
}
```

## 送信から結果表示まで動かす {#application}

`src/entry.effront.tsx` にフォームを配置し、`EFFRONT.make` に `Greeting.layer` を渡します。
共有の `EFFRONT` で handler が必要とするサービスを宣言し、この Layer でその実装を提供します。

```tsx
import { Effect } from "effect";
import { EFFRONT } from "./effront";
import { Greeting } from "./greeting";
import { GreetingForm } from "./greeting-form";

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="ja">
        <body>{children}</body>
      </html>,
    ),
});

const HomePage = EFFRONT.Page.make({
  render: () =>
    Effect.succeed(
      <main>
        <GreetingForm />
      </main>,
    ),
});

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage),
  layer: Greeting.layer,
});
```

起動中の開発用アプリケーションで `/` を開きます。
`Ada` と入力し、「挨拶する」を押してください。
送信が完了すると、フォームに「こんにちは、Ada さん。」と表示されます。
この文字列は、入力欄のクライアント側イベント処理ではなく、サーバー側のサービスが生成したものです。

フォームの `required` 属性によって、ブラウザーは空欄をすぐに検出できます。
それとは別に、サーバーでは Schema が送信データを検証するため、利用者がページを書き換えても検証を回避できません。
失敗時に何を表示するかは、[更新と失敗の表示](#refresh) で説明するように明示的に設計します。

## 戻り値が不要なら action に直接渡す {#forms}

処理を実行するだけのフォームなら、戻り値が `void` の Server Function をそのまま `<form action>` に渡せます。
この方法を試すために、`src/follow-author.ts` を作成します。
著者 ID をデコードしてログに記録しますが、フォームに表示する state は返しません。

```typescript
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

export const followAuthor = EFFRONT.ServerFn.make({
  input: Schema.fromFormData(Schema.Struct({ authorId: Schema.NonEmptyString })),
  handler: ({ authorId }) => Effect.logInfo("著者をフォロー", { authorId }),
});
```

ID を送信するために、`src/follow-author-button.tsx` を作成します。
hidden フィールドの `name="authorId"` を Schema のフィールド名と揃えます。

```tsx
import { Effect } from "effect";
import { EFFRONT } from "./effront";
import { followAuthor } from "./follow-author";

export const FollowAuthorButton = EFFRONT.Component.make({
  render: ({ authorId }: { readonly authorId: string }) =>
    Effect.succeed(
      <form action={followAuthor}>
        <input name="authorId" type="hidden" value={authorId} />
        <button type="submit">フォローする</button>
      </form>,
    ),
});
```

これはログ出力の例であり、フォロー状態を保存する機能ではありません。
ログ出力を保存用サービスの呼び出しに置き換える前に、[Middleware](/guide/middleware) または handler で利用者を認証し、その操作を許可できるか確認してください。
hidden フィールドもクライアントが変更できる入力なので、有効な著者 ID が渡されたことだけでは、その利用者に操作権限があるとは判断できません。

二つのフォームを一緒に試すには、`src/entry.effront.tsx` を次の内容に置き換えます。

```tsx
import { Effect } from "effect";
import { EFFRONT } from "./effront";
import { Greeting } from "./greeting";
import { GreetingForm } from "./greeting-form";
import { FollowAuthorButton } from "./follow-author-button";

const RootLayout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="ja">
        <body>{children}</body>
      </html>,
    ),
});

const HomePage = EFFRONT.Page.make({
  render: () =>
    Effect.succeed(
      <main>
        <GreetingForm />
        <FollowAuthorButton authorId="ada" />
      </main>,
    ),
});

export default EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: RootLayout }).page("/", HomePage),
  layer: Greeting.layer,
});
```

「フォローする」を押し、サーバーのログに `authorId` が `ada` の「著者をフォロー」が出ることを確認してください。
この action はフォームの state を返さないため、フォームに完了メッセージは表示されません。

## FormData の代わりにオブジェクトを受け取る {#input}

Client Component のイベント処理などで、すでにオブジェクトを持っている場合は、その構造を `Schema.Struct` で直接指定します。
次の `src/greet-object.ts` は、クライアントからの `greetObject({ name: "Ada" })` を受け取り、挨拶文の文字列を返します。

```typescript
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";
import { Greeting } from "./greeting";

export const greetObject = EFFRONT.ServerFn.make({
  input: Schema.Struct({ name: Schema.NonEmptyString }),
  handler: ({ name }) => Effect.flatMap(Greeting, (service) => service.message(name)),
});
```

呼び出し側は Schema のエンコードされた型を渡し、handler はデコードされた型を受け取ります。
handler の引数には型注釈を重ねず、Schema から推論させます。
`useActionState` の例のように Schema を配列で指定すると、複数の位置引数を表します。
一つの `Schema.Array(...)` や `Schema.Tuple(...)` を指定した場合は、配列を値に持つ一つの引数を表します。

Server Function は React からの呼び出し口であり、Page などのサーバー側コードから呼び出す通常の async 関数ではありません。
サーバー側でも同じ処理を使う場合は、その処理を担うサービスや Effect の関数を共有します。
この例では、`Greeting.message` がその共有する処理です。

## 更新と失敗の表示を決める {#refresh}

Server Function の呼び出しが成功すると、Effront は現在のルートを再表示します。
handler でデータを保存する場合は、Page で保存済みの値を読み取ることで、再表示されたルートに更新内容を反映できます。
ルートを再取得するためだけに、別の通信方法を用意する必要はありません。

action 自体が失敗することと、成功した action が state としてエラーメッセージを返すことは異なります。
Schema のデコード失敗は handler の実行前に発生し、デコードの失敗も handler の失敗も、`state.message` の自動更新ではなく action の失敗として扱われます。
フォームのそばに表示したい想定内の業務上の失敗は、handler の中で state の値に変換してください。
Schema で拒否する不正な入力と、項目ごとのエラーを返すために handler で受け取る入力を区別して設計します。
状態管理とエラー処理については、React の [useActionState リファレンス](https://react.dev/reference/react/useActionState) を参照してください。
