HTTP ホストがアプリケーションに求めるのは、現在のリクエストを処理する方法と、そのリクエストで使うサービスの明確な契約です。
`@effront/core/http` の native API は、その契約を Effect として表し、アプリケーションのエラー型や必要サービスの型を保ったまま、ホストから外部サービスを提供できるようにします。
このリファレンスでは、接続方法の選択、ハンドラーの実行、レスポンスのストリーミング中に必要なサービスの寿命を説明します。

## ホストとの接続方法を選ぶ {#fetch}

まず、ホストが必要とするインターフェースを確認してください。
既存の連携を使う場合は、[Node.js / Bun の serve](./server.md)、[Workers Fetch](./workers.md)、[Alchemy adapter](./alchemy.md)を参照してください。
自分でアプリケーションを接続する場合は、次のどちらかを選びます。

| ホストのインターフェース | API                                             | ホストが受け取るもの                                               |
| ------------------------ | ----------------------------------------------- | ------------------------------------------------------------------ |
| native Effect HTTP       | `@effront/core/http` の `toHttpEffect`          | 型付きのエラーと外部サービスの要件を持つ Effect                    |
| Workers 互換の Web Fetch | `@effront/core/workers` の `createFetchHandler` | `(request, env, executionContext) => Promise<Response>` 形式の関数 |

`createFetchHandler` は、渡された `env` と `executionContext` を各リクエスト内で利用できるようにします。
受け取れるのは、外部要件を `HttpRouter` と `HttpServerRequest` で満たせるアプリケーションであり、それ以外の任意のサービスをホストに要求するアプリケーションではありません。
追加の外部サービスが必要な場合は native HTTP を使い、リクエスト時にサービスを提供するか、後述する方法でホストの構築時に捕捉してください。

## toHttpEffect でリクエストを処理する {#handler}

`toHttpEffect` にアプリケーション定義を渡すと、再利用可能なハンドラーの Effect が得られます。
次のコードはハンドラーを準備するだけで、実行やサーバーの起動は行いません。

```typescript
import { toHttpEffect } from "@effront/core/http";
import application from "./entry.effront";

export const handler = toHttpEffect(application);
```

ホストはリクエストごとに、現在の `HttpServerRequest`、リクエスト用の `Scope`、アプリケーションや HTTP ルートが必要とする残りの外部サービスを提供して `handler` を実行します。
同じハンドラーを再利用する場合も、アプリケーション自身のサービスは、そのリクエスト用に Layer から構築されます。
Layer とその依存関係は、[Application の make](./application.md#make)で指定します。

ハンドラーの型は、`@effront/core/http` が公開する `HttpApplicationEffect<ApplicationError, Requirements>` です。
成功時の値は `HttpServerResponse` です。
エラー型には、アプリケーションや HTTP ルートのエラーに加え、フレームワークの描画、Server Function、プラットフォーム、HTTP のエラーが含まれます。
必要サービスの型には `HttpServerRequest` と `Scope` に加えて外部要件も残るため、ハンドラーを作成しただけでホストからのサービス提供が不要になるわけではありません。

ハンドラーが成功しても、返されたストリーミング body がリクエストのサービスを使い続けることがあります。
**body が完了・エラー・キャンセルに至るまで、リクエストの Scope を保持してください。**
レスポンスの生成だけを `Effect.scoped` で囲まないでください。
ヘッダーが準備できた時点で Scope を閉じると、body がサービスを使い終わる前に解放される可能性があります。
ホストが管理する必要があるのは、ヘッダーを生成する Effect だけでなく、レスポンス全体の寿命です。

**リクエスト body の上限。**
Fetch ホストだけでなく native ホストでも、`toHttpEffect` は `Content-Length` を検査し、不正な値や 10 MiB を超える値に対して `413` を返します。
Server Function の POST リクエストには、このヘッダーがなくても、実際に受信したバイト数に 10 MiB の上限が適用されます。
これは独自 HTTP ルートのあらゆる body に適用されるサイズ制限ではなく、ハンドラーは `Content-Length` のない独自ルートの body をすべて実測するわけではありません。

## makeHttpEffect でホストのサービスを捕捉する {#capture}

ホストの起動時に外部サービスが利用でき、その参照を後のリクエストでも再利用したい場合があります。
その場合は、`makeHttpEffect(application)` でハンドラーの構築とリクエスト処理を分けられます。
戻り値は構築用の Effect であり、直接レスポンスを返す Effect ではありません。

必要な外部サービスを提供して構築用 Effect を実行し、得られた HTTP Effect をホストへ渡します。
ホストは、返されたハンドラーを実行するたびに、現在の `HttpServerRequest` とリクエスト用の `Scope` を引き続き提供します。
アプリケーション Layer は捕捉時ではなくリクエストごとに構築され、前述したレスポンスの寿命の契約も適用されます。
[Alchemy adapter](./alchemy.md)は、native Worker との連携にこの構築方法を使います。

捕捉によって保存されるのはサービスへの参照であり、サービスの取得や寿命の延長は行われません。
**サービスの所有者は、そのサービスを使うすべてのレスポンス body の処理が終わるまで、サービスを利用可能に保つ必要があります。**
特に、ハンドラーの構築が完了したことだけを理由に、捕捉したサービスを解放しないでください。
個々のリクエストが完了しても、ホストが所有するこれらのサービスは破棄されません。

リクエスト固有の状態は、捕捉した参照とは分離されています。
構築時の Scope、HTTP リクエスト関連サービス、Layer のメモ化情報は、後のリクエストには復元されません。
現在のリクエストで捕捉済みのサービスと同じサービスが提供された場合は、現在のリクエストの値が優先されます。
