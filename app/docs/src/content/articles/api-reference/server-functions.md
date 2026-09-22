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

> [!WARNING]
> ホストのバインディングや秘密情報を返さないでください。

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

Schema のデコードは、身元や権限を証明しません。
レコード ID、hidden フィールド、`previousState` は、クライアント由来の値です。

## 実行上の制約 {#execution}

`EFFRONT.withMiddleware(...)` から作った関数は、そのアプリケーション ID とミドルウェアチェーンを保持します。
関数のミドルウェアは、実行と更新後のレスポンスを包みます。
ページと関数それぞれのアクセス権の確認は、[認証と認可](/ja/best-practices/authentication-and-authorization)を参照してください。

RSC やその他のサーバーコードで直接 `await` して呼び出すと、`TypeError` で reject します。
他のサーバーコードでも必要な処理は通常の Effect に切り出し、両方から呼び出してください。

## リクエストプロトコル {#request-protocol}

Server Function の POST リクエストには、共通の [HTTP ボディサイズと `Content-Length` の制限](./http.md#handler)が適用されます。
[Fetch ハンドラー](./workers.md#fetch)にも同じ制限を記載しています。
ブラウザーからの呼び出しでは、Effront は React の引数デコーダーに `arraySizeLimit: 10_000` を渡します。

| 条件                                                                                                                            | ステータス |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `Origin` がない、URL として解析できない、`Host` がない、または Origin の URL の `host` が小文字にした `Host` ヘッダーと異なる。 | `403`      |
| ボディを読み取れない、読み取り中にサイズ上限を超える、または multipart データとして解析できない。                               | `400`      |
| React がブラウザー呼び出しの引数をデコードできない、デコード結果が引数配列ではない、または指定された関数を読み込めない。        | `400`      |
| ネイティブフォームのボディが multipart ではない、action をデコードできない、または Server Function の action が含まれない。     | `400`      |
| `Content-Length` が [HTTP の入口での検証](./http.md#handler)に失敗する。                                                        | `413`      |
| ネイティブフォームの Server Function の実行が失敗する、または実行後の React フォーム状態のデコードが失敗する。                  | `500`      |

`Origin` の検証は、ポートを含む URL の `host` を比較し、完全な origin やスキームは比較しません。
HTTP の `Content-Length` 検証は、Server Function の検証より先に実行します。
ヘッダーの検証を通過しても、受信バイト数が上限を超えると `400` になります。

アプリケーションの入力 Schema の失敗は、React のプロトコルデコードの失敗とは異なります。
ブラウザーからの呼び出しでは、Effront は入力 Schema やハンドラーの失敗を関数の結果に含めます。
更新後のページのレンダーが成功すれば、Flight レスポンスのステータスは `200` になります。
失敗結果は、Effront が[更新後のページ](/ja/advanced/server-function-execution-and-refresh#result-and-refresh)を反映する前に、呼び出しを reject します。
