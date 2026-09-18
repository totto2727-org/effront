Effront のアプリケーション Layer は Effect の HttpRouter を要求できます。 そこに登録した HTTP ルートは Page や Server Function と同じ Fetch ハンドラーで処理されます。 JSON API、ヘルスチェック、外部サービスからの通知など、React の表示とは別の HTTP 応答を返す用途に使います。

## HttpRouter にルートを登録する {#router}

`HttpRouter.use` は Layer の構築時に router を受け取ります。[サービス](/guide/effect) で定義した Greeting を取得し、GET の応答を登録します。 次の `src/http.ts` は `/api/greeting` で JSON を返します。

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

応答はネイティブの HttpServerResponse で構築します。 たとえば `HttpServerResponse.jsonUnsafe({ accepted: true }, { status: 202 })` は 202 の JSON 応答です。 jsonUnsafe は JSON に変換できる既知の値に使い、入力検証や失敗の扱いは HTTP handler 側で定義してください。 Page や Server Function と異なる URL を選び、`/_effront` の予約領域を避けます。

## Page と HTTP でサービスを共有する {#services}

HTTP 登録処理が要求するサービスを `Layer.provideMerge` で提供します。 単に provide するのではなく merge して出力にも残すことで、Page、Layout、Component、Server Function にも同じサービスを提供できます。 サービスの章の entry.effront.tsx で、`layer: Greeting.layer` の代わりに次の ApplicationLayer を渡します。

```typescript
import { Layer } from "effect";
import { Greeting } from "./greeting";
import { GreetingApi } from "./http";

const ApplicationLayer = GreetingApi.pipe(Layer.provideMerge(Greeting.layer));

// EFFRONT と routes はサービスの章と同じ定義を使います。
export default EFFRONT.make({ routes, layer: ApplicationLayer });
```

ネイティブの HttpApi や RPC の HTTP ルート登録 Layer も、最終的に同じ HttpRouter へ登録し、要求するサービスを満たす形で合成します。 Effront 専用の API・RPC プロトコルはありません。この章では基本となる HttpRouter の合成を示しています。

## グローバル Middleware を登録する {#global}

`HttpRouter.middleware(handler, { global: true })` はルーター全体へ登録する Layer を返します。`src/application-layer.ts` で HTTP ルートとまとめ、アプリケーションの layer に渡します。

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

このグローバル Middleware は Effront のルーターに到達した Page、Server Function、ユーザー定義 HTTP と未一致リクエストを対象にします。 ただし、この例の Effect.map がヘッダーを追加するのは、後続の Effect が成功として返した応答だけです。 未一致リクエストは RouteNotFound の失敗となるため、最終的な 404 応答にはこの例のヘッダーは付きません。 失敗時の応答も変更したい場合は、対象の HTTP エラーを扱って応答へ変換する処理を別途定義してください。[スコープ付き Middleware](/guide/middleware) のように特定の Routes の内側だけへ限定されません。

## Fetch の境界とリソースの生存期間 {#boundary}

「グローバル」はこの Fetch 内のルーターに対する範囲です。 ホストが Effront の Fetch を呼ぶ前に処理する応答には適用されません。 ホストが直接配信する静的アセットにはこの Layer の Middleware を適用できないため、アセットの共通ヘッダーはホスト側で設定します。 Fetch ランタイムがルーターの起動前に返すリクエストサイズ超過の 413 も対象外です。

アプリケーション Layer はリクエストごとに構築され、同じリクエストの処理にサービスを提供します。 スコープの解放は Response body の読み取り完了、エラー、キャンセルに結び付きます。 常駐サーバー全体の終了時までサービスが生存する、という契約ではありません。 ホストとの接続方法は [プラットフォーム](/platforms) を参照してください。
