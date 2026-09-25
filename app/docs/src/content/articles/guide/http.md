独自の HTTP エンドポイントを使うと、Effront アプリケーションは Page の描画に加えて JSON を返せます。
どちらも同じアプリケーションサービスを利用できます。
この例では、[サービスのガイド](/guide/effect)のアプリケーションに `GET /api/greeting` を追加し、Page と API のレスポンスに共通のヘッダーを適用します。

## JSON エンドポイントを定義する {#router}

`src/http.ts` を作成します。

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

Page や Server Function の URL と重複しないパスを選び、予約領域の `/_effront` は使わないでください。

> [!WARNING]
> `jsonUnsafe` は、この文字列を含むオブジェクトのように、JSON に変換できると分かっている値だけに使います。
> 外部入力を受け付けるエンドポイントでは、入力を検証し、失敗を HTTP レスポンスとして処理してください。

## ルートとサービスを登録する {#services}

`src/entry.effront.tsx` の `effect` の import に `Layer` を追加し、`GreetingApi` を import します。

```typescript
// src/entry.effront.tsx: replace the effect import.
import { Effect, Layer } from "effect";
// Add to the imports.
import { GreetingApi } from "./http";

// Replace the default export.
const ApplicationLayer = GreetingApi.pipe(Layer.provideMerge(Greeting.layer));

export default EFFRONT.make({ routes, layer: ApplicationLayer });
```

`Layer.provideMerge` はルート登録に `Greeting` を提供し、Page でも使えるように出力に残します。
ブラウザーで `/api/greeting` を開きます。
ステータスは `200`、Content-Type は `application/json`、本文は次の値になります。

```json
{ "message": "Hello, Ada." }
```

既存の `/` の Page も引き続き挨拶を表示します。

## リソースをリクエスト内で使う {#boundary}

独自の HTTP リクエストでも、アプリケーションの Layer はリクエストごとに構築されます。
接続などのスコープ付きリソースは、そのリクエスト内だけで使ってください。
スコープはレスポンス本文の読み取り完了、失敗、キャンセルまで続きます。

> [!WARNING]
> 後のリクエストで使うために、リクエスト固有のサービスをモジュール変数に保存しないでください。

## 共通のレスポンスヘッダーを追加する {#global}

`src/application-layer.ts` を作成します。

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

`src/entry.effront.tsx` で共通の Layer を import し、ローカルの定義と不要な import を削除します。

```typescript
// src/entry.effront.tsx: replace the effect import to remove Layer.
import { Effect } from "effect";
// Replace the GreetingApi import.
import { ApplicationLayer } from "./application-layer";

// Remove the local ApplicationLayer declaration.
export default EFFRONT.make({ routes, layer: ApplicationLayer });
```

`/` と `/api/greeting` の両方に `x-content-type-options: nosniff` が付きます。

`global: true` は Page、Server Function、独自ルート、一致するルートのないリクエストを対象にします。
一つの Routes グループだけに適用する場合は、[スコープ付き Middleware](/guide/middleware) を使ってください。

> [!NOTE]
> この例が変更するのは、後続の Effect が成功して返したレスポンスだけです。
> 未登録の URL は `RouteNotFound` で失敗するため、そのエラーを処理してレスポンスを返さない限り、最終的な 404 にヘッダーは付きません。
> ホストが直接配信する静的アセットと、リクエストのサイズ超過に対するランタイムの早期 413 レスポンスは、ルーターを通りません。
> アセットのヘッダーはホスト側で設定してください。
