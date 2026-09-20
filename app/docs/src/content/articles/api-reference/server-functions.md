`EFFRONT.ServerFn.make` は、Schema で引数をデコードし、Effect ハンドラーを実行する React Server Function を作ります。

## ServerFn.make {#make}

`EFFRONT.ServerFn.make({ input, handler })` は、呼び出し側のシグネチャが `(...encodedArgs) => Promise<Output>` の関数を返します。
`"use server"` モジュールから公開します。

```typescript
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

export const describe = EFFRONT.ServerFn.make({
  input: [Schema.FiniteFromString, Schema.String],
  handler: (count, label) => Effect.succeed({ count, label }),
});
```

`./effront` はアプリケーションで共有するファクトリーを公開します。
クライアントから `"2"` と `"items"` を渡すと、`{ count: 2, label: "items" }` が返ります。

| オプション | 契約                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| `input`    | 一つの Schema デコーダー、またはデコーダーの readonly 配列。呼び出し側は各 Schema の `Encoded` 型を渡す。 |
| `handler`  | デコード済みの `Type` を引数に受け取り、`Effect.Effect<Output, E, AvailableServices>` を返す。            |

`AvailableServices` は、アプリケーションのサービスとファクトリーのミドルウェアスコープが提供するサービスを含みます。
成功時のハンドラーの値が `Output` になります。
入力の Schema による再エンコードは行いません。
入力と出力は [React のシリアライズ契約](https://react.dev/reference/rsc/use-server#serializable-arguments-and-return-values) を満たす必要があります。
ホストのバインディングや秘密情報を返さないでください。
関数を呼び出す React コンポーネントは [Server Functions](/ja/guide/server-functions) を参照してください。

## 引数の形式 {#arguments}

| `input`                                        | 呼び出し側の引数 | ハンドラーの引数              |
| ---------------------------------------------- | ---------------- | ----------------------------- |
| `Schema.String`                                | 文字列一つ       | 文字列一つ                    |
| `[Schema.FiniteFromString, Schema.String]`     | 文字列、文字列   | 数値、文字列                  |
| `Schema.Tuple([Schema.String, Schema.Finite])` | タプル一つ       | `[string, number]` タプル一つ |
| `Schema.Array(Schema.String)`                  | 文字列配列一つ   | 文字列配列一つ                |
| `[]`                                           | なし             | なし                          |

Schema の配列は位置引数を表します。
配列やタプルの Schema は一つの引数を表します。
単一のデコーダーは、余分なネイティブ引数を無視し、引数の省略時には `undefined` をデコードします。

`useActionState` は、前の状態、`FormData` の順に引数を渡します。

```typescript
"use server";

import { Effect, Schema } from "effect";
import { EFFRONT } from "./effront";

export const update = EFFRONT.ServerFn.make({
  input: [
    Schema.Struct({ count: Schema.Finite }),
    Schema.fromFormData(Schema.Struct({ name: Schema.NonEmptyString })),
  ],
  handler: (previousState, form) =>
    Effect.succeed({ count: previousState.count + 1, name: form.name }),
});
```

すべての位置引数をデコードしてからハンドラーを実行します。
入力のデコード失敗や未処理のハンドラー失敗は呼び出しを reject し、`Output` や次の action state にはなりません。
想定内のドメインエラーをフォームの状態に表示する場合は、シリアライズ可能な結果として返してください。

## 実行上の制約 {#execution}

保護された操作の前に、ハンドラーまたはその [ミドルウェア](/ja/guide/middleware) で認証と認可を行う必要があります。
検証済みの識別子、hidden フィールド、前の状態もクライアント由来のデータであり、権限の証明にはなりません。
検証にスコープ付きサービスが必要なら、対応する `EFFRONT.withMiddleware(...)` ファクトリーから関数を作ります。
関数はそのアプリケーション ID とミドルウェアチェーンを保持します。

RSC やその他のサーバーコードで直接 `await` して呼び出すと、`TypeError` で reject します。
他のサーバーコードでも必要な処理は通常の Effect に切り出し、両方から呼び出してください。
