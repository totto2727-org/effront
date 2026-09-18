## toHttpEffect {#handler}

`@effront/core/http` の `toHttpEffect(application)` は native Effect HTTP の `HttpServerResponse` を返す Effect です。
`HttpApplicationEffect<ApplicationError, Requirements>` はアプリケーションのエラーと外部要件、HTTP routing の error / requires markers を保持します。
ホストが `HttpServerRequest` と request Scope を提供し、残る外部要件も満たします。

```typescript
import { toHttpEffect } from "@effront/core/http";
import application from "./entry.effront";

export const handler = toHttpEffect(application);
```

同じ Effect を再利用しても、評価ごとに新しい Layer memo map でアプリケーションサービスを取得します。
Scope はレスポンスの生成だけでなく body の完了・エラー・キャンセルまで保持してください。
ヘッダーの生成だけを `Effect.scoped` で囲んで即座に Scope を閉じる構成にはしません。
[Node.js / Bun の serve](./server.md) と [Workers Fetch](./workers.md) は対応する host boundary を提供します。

## makeHttpEffect {#capture}

`makeHttpEffect(application)` は構築時の外部サービス参照を捕捉し、再利用可能な HTTP Effect を返す Effect です。
参照の捕捉はサービスの取得や寿命の延長ではありません。
所有者は全レスポンスの body が完了するまで捕捉した能力を生存させます。

構築時の Scope、request、route context、router、Layer memo map は持ち越しません。
実際の request context が捕捉した context より優先されます。
[Alchemy adapter](./alchemy.md) はこの境界を native Worker の能力と結び付けます。

## Fetch との使い分け {#fetch}

native HTTP は Effect の型付き失敗と必要サービスを保持する接続です。
`createFetchHandler` は Web `Request` / `Response` へ変換する互換境界で、Workers の env と execution context を request-local に渡します。
任意の外部サービスを自動供給する API ではありません。
アプリケーション定義の Layer 要件は [Application reference](./application.md#make) を参照してください。
