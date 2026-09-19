`EFFRONT.ServerFn.make` を使うと、フォーム送信やクライアントでの操作をきっかけに、サーバー上で Effect による処理を実行できます。
呼び出し側が送れる値を定義し、デコード済みの値を使って処理を実装して、呼び出し側に必要なデータを返します。
このリファレンスでは、その契約と引数の形、保護が必要な操作を行う前の確認事項を説明します。
React コンポーネントへの組み込み方やアプリケーションの設定は、[Server Functions ガイド](/guide/server-functions) を参照してください。

## 呼び出し可能な処理を定義する {#make}

`EFFRONT.ServerFn.make({ input, handler })` で処理を定義します。
Page やサービスと同じアプリケーションに属する関数にするため、アプリケーションで共有する `EFFRONT` を使います。
以下は定義部分の抜粋で、`Effect` と `Schema` を `effect` から import していることを前提としています。
React から利用できるようにするには、これらの関数を `"use server"` モジュールから export してください。

```typescript
const rename = EFFRONT.ServerFn.make({
  input: Schema.Struct({ name: Schema.NonEmptyString }),
  handler: ({ name }) => Effect.succeed({ name }),
});
const describe = EFFRONT.ServerFn.make({
  input: [Schema.FiniteFromString, Schema.String],
  handler: (count, label) => Effect.succeed({ count, label }),
});
```

これらの最小限の handler は、データを保存せずに返します。
`rename` に `{ name: "Ada" }` を送ると、結果も `{ name: "Ada" }` になります。
`describe` では、呼び出し側が `"2"` と `"items"` を送るのに対し、handler は数値の `2` と文字列の `"items"` を使って処理します。
結果は `{ count: 2, label: "items" }` です。
Schema が入力を変換する場合は、この違いが重要です。
呼び出し側は Schema の `Encoded` 型を使い、handler はデコード済みの `Type` 型を使います。

| 定義の要素        | 契約                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `input`           | 受け取る引数を決める、一つの Schema decoder または decoder の readonly 配列。                                      |
| `handler`         | デコード済みの引数を受け取り、任意のエラー型 `E` を持つ `Effect.Effect<Output, E, AvailableServices>` を返します。 |
| `make` が返す関数 | `Encoded` 側の引数を受け取り、React 経由で呼び出すと `Promise<Output>` を返します。                                |

handler の Effect が成功したときの値が `Output` になります。
この値が入力の Schema で再エンコードされることはありません。
[React がシリアライズできる値](https://react.dev/reference/rsc/use-server#serializable-arguments-and-return-values)だけを返し、ホストの `env` バインディングや秘密値を結果に含めないでください。

## 呼び出し側に合わせて引数を定義する {#arguments}

`input` は、handler 内で扱いたい値の形だけでなく、呼び出し側のコードが渡す引数に合わせて選びます。
Schema の配列は複数の位置引数を表し、配列やタプルの Schema は、そのコレクションを値に持つ一つの引数を表します。

| 呼び出し側が渡すもの     | `input`                                        | handler が受け取るもの                                             |
| ------------------------ | ---------------------------------------------- | ------------------------------------------------------------------ |
| 文字列一つ               | `Schema.String`                                | `string` 一つ。                                                    |
| 文字列と、それに続く数値 | `[Schema.String, Schema.Finite]`               | その順序の二つの引数。                                             |
| 一つの値としてのタプル   | `Schema.Tuple([Schema.String, Schema.Finite])` | `[string, number]` のタプル一つ。                                  |
| 一つの値としての配列     | `Schema.Array(Schema.String)`                  | 文字列の配列一つ。                                                 |
| 値を渡さない             | `[]`                                           | 引数を受け取らないため、handler は `() => Effect` の形になります。 |

`useActionState` では、React が前回の state を第一引数、送信された `FormData` を第二引数に渡します。
それぞれに Schema を指定すると、handler は検証済みの state オブジェクトとデコード済みのフォームフィールドを扱えます。

```typescript
const update = EFFRONT.ServerFn.make({
  input: [
    Schema.Struct({ count: Schema.Finite }),
    Schema.fromFormData(Schema.Struct({ name: Schema.NonEmptyString })),
  ],
  handler: (previousState, form) =>
    Effect.succeed({
      count: previousState.count + 1,
      name: form.name,
    }),
});
```

この例では、呼び出し側は `{ count: number }` と `FormData` を渡し、handler は `{ count: number }` と `{ name: string }` を受け取ります。
返される state には、送信された名前と、一つ増えたカウントが入ります。
Effront はすべての位置引数をデコードしてから handler を呼び出すため、どちらかの引数のデコードに失敗すると handler は実行されません。
ここで検証するのは state やフォームフィールドの形であり、呼び出し側がそれらを使う権限ではありません。

入力のデコード失敗や handler で処理されなかった失敗は、関数の `Output` や次の action state にはならず、クライアントからの呼び出しを reject します。
想定内の業務上の失敗をフォームの state として表示したい場合は、Effect を失敗させるのではなく、その失敗を表すシリアライズ可能な結果を handler から返してください。

## 操作を保護し、処理を再利用する {#execution}

保護が必要な操作を行う前に、[Middleware](/guide/middleware) または handler で認証・認可を確認してください。
有効な識別子、hidden フィールド、前回の state も、クライアントから届いた入力であることに変わりはありません。
Schema の検証に通っただけでは、対応するリソースの読み取りや変更が許可されているとは判断できません。

これらの確認で Middleware が提供するサービスを使う場合は、対応する `EFFRONT.withMiddleware(...)` の定義から Server Function を作成します。
関数はその定義のアプリケーション identity と Middleware チェーンを保持し、handler はそのスコープで利用可能なサービスを要求できます。
操作のために別のアプリケーションを作るのではなく、このスコープの定義を使ってください。

React からの呼び出し口と、サーバー内でも呼び出したい処理は分けておきます。
Server Function を RSC などのサーバーコードで通常の async 関数のように直接 `await` することはできず、その呼び出しは `TypeError` で拒否されます。
再利用する処理を通常の Effect として切り出し、Server Function の handler と、必要に応じて他のサーバーコードから呼び出してください。
