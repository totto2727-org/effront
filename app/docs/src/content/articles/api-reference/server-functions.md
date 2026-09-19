## ServerFn.make {#make}

| API / 項目                          | 契約                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ServerFn.make({ input, handler })` | 同じ identity と Middleware チェーンを保持する Server Function 定義を返します。                                          |
| `input`                             | Schema decoder 一つ、または位置引数に対応する Schema decoder の readonly 配列。                                          |
| `handler`                           | デコード済みの位置引数を受け取り、Effect.Effect&lt;Output, E, AvailableServices&gt; を返します。E は任意のエラー型です。 |
| `戻り値の呼び出し型`                | 各 Schema の Encoded 側の引数を受け取り、Promise&lt;Output&gt; を返す関数です。                                          |

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

`EFFRONT` は共有するアプリケーション identity、`Effect` と `Schema` は `effect` の export です。二つ目の例は、呼び出し側では文字列の数値を送り、handler では number を受け取ります。

## 引数の対応 {#arguments}

| API / 項目                                            | 契約                                                  |
| ----------------------------------------------------- | ----------------------------------------------------- |
| `input: Schema.String`                                | 引数一つ。handler には string が渡されます。          |
| `input: [Schema.String, Schema.Finite]`               | 引数二つ。順番は配列の順序と一致します。              |
| `input: Schema.Tuple([Schema.String, Schema.Finite])` | タプル値を持つ引数一つ。Schema の配列とは区別します。 |
| `input: []`                                           | 引数なし。handler は () =&gt; Effect です。           |

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

この定義の呼び出し型は、前の状態と FormData を受け取ります。handler の二番目の引数はデコード済みの `{ name: string }` です。React の `useActionState` の位置引数に対応させる場合にも、この配列形式を使えます。

## 実行境界 {#execution}

ServerFn は React の Server Function として利用します。
`"use server"` モジュールから公開してください。
ブラウザーから呼び出すと、サーバー側で入力をデコードしてから handler の Effect を実行します。

通常のサーバー関数のように RSC 内から直接 await すると `TypeError` で拒否されます。サーバー内でも使いたい処理は通常の Effect として切り出し、ServerFn の handler から呼びます。返す値は React の転送可能な値にし、env や秘密値を含めないでください。
