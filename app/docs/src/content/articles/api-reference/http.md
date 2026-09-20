`@effront/core/http` は、型付きエラーと外部サービスの要件を保持するネイティブ Effect HTTP ハンドラーを公開します。

## HTTP の接続 API {#fetch}

| API                                               | 戻り値                                                  | ホストが提供するサービス                                                                  |
| ------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `toHttpEffect(application)`                       | ネイティブ HTTP Effect                                  | 現在のリクエスト、Scope、アプリケーションの外部要件                                       |
| `makeHttpEffect(application)`                     | ネイティブ HTTP Effect を構築する Effect                | 構築時の外部サービスと、実行時のリクエスト、Scope                                         |
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

`Content-Length` が負数、安全な整数でない値、または 10 MiB を超える値の場合、アプリケーションのサービスを取得する前に `413` を返します。
Server Function の POST は、このヘッダーがなくても受信バイト数を 10 MiB に制限します。
このハンドラーが `Content-Length` のない独自 HTTP ルートの本文をすべて実測するわけではありません。

## makeHttpEffect {#capture}

`makeHttpEffect(application)` は、型付きの失敗を持たない構築用 Effect を返します。
アプリケーションの外部サービスを要求し、その参照を捕捉した再利用可能な HTTP Effect を返します。
返された Effect は HTTP のエラーチャネルを保持し、引き続き現在のリクエストとリクエスト Scope を必要とします。
アプリケーション Layer はリクエストスコープのままです。

- 同じキーのサービスが現在のリクエストにある場合、その値を優先します。
- 構築時の Scope、HTTP リクエストサービス、ルーターサービス、Layer のメモ化状態は捕捉しません。
- 捕捉はサービスの取得や寿命の延長を行いません。所有者は、そのサービスを使うすべてのレスポンス本文の処理が終わるまで保持する必要があります。
- リクエストの完了によって、ホスト所有の捕捉済みサービスが破棄されることはありません。

[Alchemy アダプター](./alchemy.md) は、同じ捕捉と寿命の契約を持つ遅延アプリケーションローダーを提供します。
