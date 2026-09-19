呼び出し元が表示用の Page ではなくデータを必要とする場合は、独自の HTTP ルートを使います。
既存の Page を残したまま、そこで使うアプリケーションサービスを JSON エンドポイントからも利用できます。

この例では、[サービスの章](/guide/effect) のアプリケーションを拡張します。
`/` は引き続き挨拶を表示し、`GET /api/greeting` はその挨拶を JSON で返します。
まずエンドポイントを定義し、その登録処理をアプリケーションの Layer に組み込んで応答を確認します。
その後、両方のルートに共通のレスポンスヘッダーを追加できます。

## JSON エンドポイントを定義する {#router}

`src/http.ts` を作り、次のルート登録処理を記述します。
`HttpRouter.use` は登録処理にルーターを渡し、`router.add` はメソッドとパスを、応答を生成する Effect に関連付けます。
ここでは、ハンドラーが `Greeting` サービスの `message("Ada")` を呼び出し、その結果を `message` フィールドを持つオブジェクトにまとめます。

```typescript
import { Effect } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { Greeting } from "./greeting";

export const GreetingApi = HttpRouter.use(
  Effect.fn(function* (router) {
    const greeting = yield* Greeting;
    yield* router.add(
      "GET",
      "/api/greeting",
      Effect.map(greeting.message("Ada"), (message) => HttpServerResponse.jsonUnsafe({ message })),
    );
  }),
);
```

独自のエンドポイントのパスは Page や Server Function の URL と重複しないように選び、予約領域の `/_effront` は使わないでください。
この例では、オブジェクトの値が JSON に変換できる文字列だと分かっているため、`HttpServerResponse.jsonUnsafe` を使います。
外部からの入力を受け付けるエンドポイントでは、入力を検証し、処理が失敗したときにどのような HTTP 応答を返すかも決めてください。

## エンドポイントを登録してリクエストを送る {#services}

`GreetingApi` をエクスポートするだけでは、アプリケーションには接続されません。
`src/entry.effront.tsx` で `Greeting.layer` と組み合わせ、既存の `layer: Greeting.layer` の代わりにその結果を `EFFRONT.make` に渡します。
`EFFRONT` と `routes` は、サービスの章の定義をそのまま使います。

```typescript
import { Layer } from "effect";
import { Greeting } from "./greeting";
import { GreetingApi } from "./http";

const ApplicationLayer = GreetingApi.pipe(Layer.provideMerge(Greeting.layer));

// EFFRONT と routes はサービスの章と同じ定義を使います。
export default EFFRONT.make({ routes, layer: ApplicationLayer });
```

ここでの `Layer.provideMerge` には、HTTP ルートの登録に必要なサービスを提供し、Page でも使えるようにそのサービスを出力に残す、という二つの役割があります。
これにより、サービスの実装を重複させずに、API と Page が同じサービスの契約を使えます。

開発中のアプリケーションを起動した状態で、そのオリジンの `/api/greeting` を開き、ブラウザーの Network パネルでリクエストを確認してください。
ステータスが `200`、`Content-Type` が `application/json` を含み、レスポンスボディが次の内容になっていることを確認します。

```json
{ "message": "こんにちは、Ada さん。" }
```

`/` も開き、既存の Page が引き続き挨拶を表示することを確認してください。
この日本語の挨拶はサンプルのサービスが返すもので、どちらの応答でも同じです。
別のステータスを返したい場合は、`HttpServerResponse.jsonUnsafe({ accepted: true }, { status: 202 })` のように応答に指定します。

## サービスのリソースをリクエスト内で使う {#boundary}

複数のルート定義でサービスを共有しても、そのサービスがサーバー全体で一つのインスタンスになるわけではありません。
Effront はリクエストごとにアプリケーション Layer を構築します。
挨拶の実装を、接続などのスコープ付きリソースを取得する実装に置き換える場合は、そのリソースをリクエストの生存期間内だけで使ってください。
リクエストのスコープはレスポンスボディの読み取り完了、エラー、キャンセルまで維持されるため、レスポンスヘッダーを生成した時点では生存期間は終わりません。
リクエスト固有のサービスインスタンスを、後のリクエストで使うためにモジュール変数へ保存しないでください。

## Page と API の応答にヘッダーを追加する {#global}

エンドポイントが動作したら、各ハンドラーに処理を追加せずに、応答に共通の設定を適用できます。
たとえば、次のグローバル Middleware は、Effront のルーターから成功として返された応答に `x-content-type-options: nosniff` を追加します。

この合成した Layer を `src/application-layer.ts` に記述します。
`src/entry.effront.tsx` では、ローカルの `ApplicationLayer` 定義を `./application-layer` からのインポートに置き換え、引き続き `EFFRONT.make` に渡してください。

```typescript
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { Greeting } from "./greeting";
import { GreetingApi } from "./http";

const GlobalHeaders = HttpRouter.middleware(
  (httpEffect) =>
    Effect.map(httpEffect, HttpServerResponse.setHeader("x-content-type-options", "nosniff")),
  { global: true },
);

export const ApplicationLayer = Layer.mergeAll(GreetingApi, GlobalHeaders).pipe(
  Layer.provideMerge(Greeting.layer),
);
```

`/api/greeting` と `/` にもう一度リクエストを送り、両方の応答に新しいヘッダーが含まれることを確認してください。
`global: true` を指定すると、Page、Server Function、ユーザー定義 HTTP ルート、未一致リクエストを含むルーター全体に Middleware が適用されます。
特定の Routes のスコープだけに設定を適用したい場合は、[スコープ付き Middleware](/guide/middleware) を使います。

ただし、Middleware が適用される範囲と、この例で実際に変更される応答は区別する必要があります。

- `Effect.map` が変更するのは、後続の Effect が成功として返した応答だけです。
  未一致リクエストは `RouteNotFound` の失敗となるため、最終的な 404 応答にはこのヘッダーが付きません。
  エラー応答も変更するには、対象の HTTP エラーを扱い、応答へ変換してください。
- ルーターの起動前に返される応答は、この Middleware を通りません。
  ホストが直接配信する静的アセットや、サイズ超過のリクエストに対してランタイムが先に返す 413 応答が該当します。
  アセットのヘッダーは、アセットを配信するホスト側で設定してください。
