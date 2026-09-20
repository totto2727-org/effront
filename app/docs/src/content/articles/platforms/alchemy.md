## 既存の Effront アプリケーションを準備する {#setup}

[はじめる](../guide/getting-started.md)で用意した依存パッケージと `src/entry.effront.tsx` のアプリケーションに、Alchemy を追加します。

```bash
vp add @effront/alchemy@0.1.4 alchemy@2.0.0-beta.77
```

Alchemy と Cloudflare runtime は `2.0.0-beta.77`、[Effect 関連パッケージ](../api-reference.md#versions)は `4.0.0-rc.112` に揃えてください。
Alchemy CLI はローカル開発でも、設定済みの Cloudflare profile を必要とします。
アプリケーションを起動する前に、[Alchemy のドキュメント](https://alchemy.run/docs)に従って profile を設定してください。

## Alchemy で動かすアプリケーションを定義する {#worker}

`src/entry.workers.ts` を作成します。

```typescript
import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

export default Cloudflare.Worker(
  "App",
  {
    main: import.meta.url,
    compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
    vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } },
  },
  Effect.gen(function* () {
    const fetch = yield* makeApplicationHttpEffect(() =>
      import("./entry.effront").then((module) => module.default),
    );
    return { fetch: fetch.pipe(Effect.orDie) };
  }),
);
```

Alchemy によるリソースの準備時ではなくリクエスト中に読み込むため、アプリケーションの import はローダー関数内に保ってください。
`Effect.orDie` は、処理されずに残ったアプリケーションの失敗を Worker の HTTP 境界で defect に変換します。
特定のエラーレスポンスを返す場合は、この変換より前に失敗を処理してください。

プロジェクトのルートに `alchemy.run.ts` を作成します。

```typescript
import { localState, Stack } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import Worker from "./src/entry.workers";

export default Stack(
  "my-effront-app",
  { state: localState(), providers: Cloudflare.providers() },
  Effect.gen(function* () {
    const site = yield* Worker;
    return { url: site.url };
  }),
);
```

この Stack は管理状態をローカルに保存し、Worker の URL を出力します。

## 開発環境を起動してページを開く {#stack}

`vite.config.ts` を作り、`effront()` を `effrontAlchemy()` より前に登録します。

```typescript
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontAlchemy()],
});
```

`package.json` の scripts に `"dev": "alchemy dev"` を追加して実行します。

```bash
vp run dev
```

`vp dev` だけでは Alchemy の実行環境が起動しないため、このスクリプトを使ってください。
CLI に表示されたローカル URL を開き、アプリケーションに定義したルートにアクセスします。
「はじめる」のトップページなら、`Hello, Effront` が表示されます。

## バインディングを追加する {#capabilities}

[Alchemy のリソース API](https://alchemy.run/docs) でリソースを定義し、Worker にバインドします。
取得したクライアントをアプリケーションのサービスとして渡すには、[Alchemy API リファレンス](../api-reference/alchemy.md)を参照してください。
[連携サンプル](https://github.com/totto2727-org/effront/tree/main/examples/alchemy)では、KV を使ってこの接続を示しています。
