`@effront/core/http` は、型付きエラーと外部サービスの要件を保持するネイティブ Effect HTTP ハンドラーを公開します。

## HTTP の接続 API {#fetch}

| API                                               | 戻り値                                                  | ホストが提供するサービス                                                                  |
| ------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `toHttpEffect(application)`                       | ネイティブ HTTP Effect                                  | 現在のリクエスト、Scope、アプリケーションの外部要件                                       |
| [`createFetchHandler(application)`](./workers.md) | `(request, env, executionContext) => Promise<Response>` | Fetch Context。アプリケーション Layer の要件は `HttpRouter` と `HttpServerRequest` のみ。 |

既存のネイティブホスト連携には [Node.js / Bun](./server.md) と [Alchemy](./alchemy.md) があります。

## toHttpEffect {#handler}

```typescript
import { toHttpEffect } from "@effront/core/http";
import application from "./entry.effront";

export const handler = toHttpEffect(application);
```

入力は `ApplicationDefinition<Services, ApplicationError, Requirements>` です。
戻り値は、`@effront/core/http` が公開する `HttpApplicationEffect<ApplicationError, Requirements>` です。
Effect の作成だけでは実行やリスナーの起動は行いません。

| チャネル | 契約                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------- |
| 成功     | `HttpServerResponse.HttpServerResponse`                                                             |
| エラー   | アプリケーションと HTTP ルートのエラー、描画と Server Function の失敗、`PlatformError`、HTTP エラー |
| サービス | `HttpServerRequest.HttpServerRequest`、`Scope.Scope`、アプリケーションと HTTP ルートに残る外部要件  |

実行ごとに、現在のリクエスト用の [アプリケーション Layer](./application.md#make) を取得します。
**ホストは本文の完了、失敗、キャンセルまでリクエスト Scope を保持する必要があります。
**
レスポンス生成だけを `Effect.scoped` で囲むと、ストリーミング本文の処理が終わる前にサービスを解放する可能性があります。
HEAD レスポンスは本文が空でも、レスポンスのメタデータを保持します。

`Content-Length` が負数、安全な整数でない値、または 10 MiB を超える値の場合、アプリケーションのサービスを取得する前に `413` を返します。
Server Function の POST は、このヘッダーがなくても受信バイト数を 10 MiB に制限します。
このハンドラーが `Content-Length` のない独自 HTTP ルートの本文をすべて実測するわけではありません。

## ネイティブなサービスの提供 {#provision}

> [!WARNING]
> 破壊的変更: `makeHttpEffect(application)` を `toHttpEffect(application)` に置き換え、構築用の `yield*` や実行手順を削除してください。
> Alchemy の `makeApplicationHttpEffect` は `applicationHttpEffect` に置き換え、ハンドラーを得るための yield や実行も削除します。
> `{ context }` オプションは `Effect.provideService`、または Layer と `Effect.provide` に置き換えます。
> 旧 API は削除され、非推奨のラッパーはありません。サービスの優先順位はネイティブ Effect の規則に従い、現在のリクエストを特別に優先する独自の規則はありません。

外部サービスは、ネイティブの `Effect.provideService`、または Layer と `Effect.provide` で `toHttpEffect(application)` に直接提供します。
ハンドラー自体が HTTP Effect であり、それを返す構築用 Effect ではありません。
Context のスナップショットや、保存したランタイムとリクエストの手動マージは行いません。

```typescript
const handler = toHttpEffect(application).pipe(Effect.provideService(CacheClient, cache));
```

ホストは現在のリクエストと Scope を提供します。
Effront はリクエストごとに新しい Layer の memo map を使い、アプリケーション Layer を構築します。
共有サービスの提供は、所有権の移転や寿命の延長を行いません。
所有者は、そのサービスを使うすべてのレスポンス本文の処理が終わるまで保持する必要があります。
ハンドラーを囲む外部のスコープ付き Layer は、本文が終了する前に、ヘッダーの生成時点で解放される可能性があります。
リクエスト所有の破棄可能なリソースは、応答ストリームの寿命に従う `EFFRONT.make` のアプリケーション Layer に置いてください。
[Alchemy アダプター](./alchemy.md) も、アプリケーションの遅延読み込みと同じネイティブなサービス提供に対応します。
