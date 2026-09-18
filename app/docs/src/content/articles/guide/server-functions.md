`EFFRONT.ServerFn.make` は Schema と Effect の handler を結び付けます。 React の Server Function として公開することで、フォームや Client Component からサーバー側の処理を呼び出せます。 通信や参照のエンコードは React に任せ、アプリケーション独自の RPC エンドポイントを用意する必要はありません。

## アプリケーションと同じ定義を使う {#identity}

`src/effront.ts` に共有の定義を置き、Page、Layout、Routes、Server Function から import します。 この例は [サービス](/guide/effect) の Greeting を使います。 アプリケーションを閉じる `EFFRONT.make` には `layer: Greeting.layer` を渡してください。

```typescript
import { Application } from "@effront/core";
import { Greeting } from "./greeting";

export const EFFRONT = Application.effront<Greeting>();
```

## 入力の型とデコード {#input}

呼び出し側は Schema のエンコードされた型を渡し、handler はデコードされた型を受け取ります。 引数には手書きの型注釈を付けず、Schema から推論させます。 通常のオブジェクト入力には `Schema.Struct` を使います。 次の `src/greet-object.ts` は `{ name: "Ada" }` を受け取る Server Function です。

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

## フォームから直接呼び出す {#forms}

ネイティブフォームは FormData を渡すため、`Schema.fromFormData` でフィールドをデコードします。 戻り値が void の Server Function は、そのまま `form action` に渡せます。`src/follow-author.ts` の例では記録だけを行います。実際の保存処理はアプリケーションサービスから呼び出してください。

```typescript
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

export const followAuthor = EFFRONT.ServerFn.make({
  input: Schema.fromFormData(Schema.Struct({ authorId: Schema.NonEmptyString })),
  handler: ({ authorId }) => Effect.logInfo("著者をフォロー", { authorId }),
});
```

`src/follow-author-button.tsx` からネイティブの参照を渡します。

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

## useActionState で結果を表示する {#state}

`useActionState` は前回の state と今回の FormData を渡します。`input: [StateSchema, FormSchema]` とすると、それぞれの引数を個別に検証できます。 一つの `Schema.Array` や `Schema.Tuple` を input に渡した場合は、配列を値に持つ一つの引数です。`src/greet.ts` に状態付きの Server Function を定義します。

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

`src/greeting-form.tsx` でネイティブの Server Function 参照をそのまま useActionState に渡します。 独自の async ラッパーに置き換えないことで、React が JavaScript の読み込み前のフォーム送信も扱える形を保ちます。

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

## Page とアプリケーションへ組み込む {#application}

`src/entry.effront.tsx` で二つのフォームを表示し、Greeting の実装を提供します。

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

## 再表示と失敗の扱い {#refresh}

呼び出しの成功後は現在のルートを再表示します。更新結果を読む Page と更新処理が同じサービスの契約を使うため、画面の再取得を別の通信方式で実装する必要はありません。 入力のデコード失敗と handler の失敗は action の失敗として React のエラー処理へ届きます。 想定内の業務上の失敗をフォームに表示したい場合は、handler の中で明示的に state へ変換してください。

Server Function をサーバーグラフで通常の async 関数として直接呼び出すことはできません。 サーバー内で共有する処理は Effect のサービスや関数へ切り出し、React からの呼び出しだけを Server Function にします。 認証・認可は入力 Schema とは別に、[Middleware](/guide/middleware) や handler で確認します。 hidden フィールドや前回の state もクライアントから届く入力です。
