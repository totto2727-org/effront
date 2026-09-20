`Routes` と `Middleware` は、共有する `Application.effront()` ファクトリーのメンバーです。

## Routes {#routes}

| メソッド                              | 入力                                           | 戻り値                                                        |
| ------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| `Routes.make({ layout?, loading? }?)` | 同じ ID の Layout と Loading。どちらも省略可能 | 共有 UI とファクトリーのミドルウェアスコープを持つ空の Routes |
| `routes.page(path, page)`             | パラメーターが一致する Page と絶対パスリテラル | Page を追加した新しい Routes                                  |
| `routes.mount(prefix, child)`         | 静的な絶対パスの接頭辞と、空でない子 Routes    | 子のパスに接頭辞を付け、入れ子の UI を保持した新しい Routes   |

`page` と `mount` は元の Routes を変更しません。
`withMiddleware` から派生したものを含め、すべての定義は同じアプリケーション ID を持つ必要があります。

たとえば `/` と `/:id` を登録した子を `/articles` にマウントすると、`/articles` と `/articles/:id` になります。
子の `/` は `/articles/` という登録パターンにはなりません。
`EFFRONT.make({ routes })` に渡すルートには、直接の Layout と、ツリー内の一つ以上の Page が必要です。

## ルートパス {#paths}

| パターン        | 一致するパス                                               | Page の Schema の `Encoded` キー |
| --------------- | ---------------------------------------------------------- | -------------------------------- |
| `/articles`     | 固定パス                                                   | `params` Schema なし             |
| `/articles/:id` | 1 セグメント                                               | `id`                             |
| `/manual/*path` | 残りのパス。`/manual` や `/manual/` の空のキャプチャも含む | `path`                           |

Schema のキーはパスのパラメーター名と完全に一致し、encoded 値は URL 文字列を受け付ける必要があります。
Page は [デコード済みの値](/ja/api-reference/components#params) を受け取ります。
マウントの接頭辞にパラメーターは使えません。

`/manual/*path` では、`/manual/a/b` が `"a/b"` を、`/manual` が `""` を渡します。
`Schema.String` など、空文字列を受け付ける Schema なら両方を扱えます。
キャプチャは一度 URL デコードされています。
再度デコードしないでください。
catch-all のリクエストパスに不正なパーセントエンコーディングがあると 404 になります。

**衝突**

- `/manual/*path` は `/manual` も使用するため、両者の登録は衝突します。
- より具体的な `/manual/about` と `/manual/:slug` は catch-all と共存でき、優先されます。
- 重複判定は大文字小文字とパラメーター名を区別しません。`/Articles` と `/articles`、`/articles/:id` と `/articles/:slug` はそれぞれ衝突します。
- マウント後のパスにも同じ衝突判定を適用します。

**登録の制約**

- パスは `/` で始まる絶対パスリテラルである必要があります。
- `/` 以外は末尾の `/`、空のセグメント、`.`、`..` を含められません。
- `?`、`#`、`%`、`;`、`\` は使用できません。
- `:name` はセグメント全体、`*name` は最後のセグメント全体を占める必要があります。
- 名前は空でなく、パス内で一意である必要があります。`:`, `*`, `.`, `-`、丸括弧は含められません。
- `/_effront` は予約済みです。ルートの `/:name` や `/*path` など、この名前空間に一致し得るパターンは `EFFRONT.make` が拒否します。

## Middleware {#middleware}

`Middleware.make(handler)` は同じ ID のミドルウェア定義を返します。
ハンドラーは後続の HTTP レスポンス Effect を受け取り、HTTP レスポンス Effect を返します。
後続のエラー型と残りのサービス要件を保持します。
リクエストを拒否する場合は、型付きの失敗を追加せず、401 などの HTTP レスポンスを返します。

`Middleware.make<{ provides: Service }>(handler)` は後続に提供するサービスを宣言します。
ハンドラーは実行時にその値を提供する必要があります。

```tsx
import { Context, Effect } from "effect";
import { EFFRONT } from "./effront";

class RequestLabel extends Context.Service<RequestLabel, { readonly value: string }>()(
  "example/RequestLabel",
) {}

const ProvideLabel = EFFRONT.Middleware.make<{ provides: RequestLabel }>((httpEffect) =>
  httpEffect.pipe(Effect.provideService(RequestLabel, { value: "request" })),
);
const Scoped = EFFRONT.withMiddleware(ProvideLabel);
const Home = Scoped.Page.make({
  render: () => Effect.map(RequestLabel, ({ value }) => <h1>{value}</h1>),
});
export const scopedRoutes = Scoped.Routes.make().page("/", Home);
```

`./effront` は共有するファクトリーを公開します。
Layout を持つルート Routes の下に `scopedRoutes` をマウントします。
`Scoped` で Routes を作るとミドルウェアが有効になります。
スコープ付き Page を作るだけでは有効になりません。
スコープ付き Page、Layout、Component は、そのスコープが有効であることを必要とします。
スコープ付き Server Function は、呼び出し時に自身のミドルウェアチェーンを適用します。

`withMiddleware` はミドルウェアの依存サービスが利用可能であることを要求し、提供されるサービスを派生ファクトリーに追加します。
別の ID や、同じチェーン内のミドルウェア重複は `TypeError` になります。
`withMiddleware(first).withMiddleware(second)` は `first`、`second`、後続処理の順に入り、逆順に戻ります。

スコープ付きミドルウェアの対象は、その Routes と Server Function です。
独自 HTTP、静的アセット、未知のルートは対象外です。
完全な例は [Middleware](/ja/guide/middleware)、より広いリクエストへの適用は [グローバル HTTP ミドルウェア](/ja/guide/http) を参照してください。
