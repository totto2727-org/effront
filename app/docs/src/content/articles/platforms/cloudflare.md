## Alchemy native Worker（実験版） {#alchemy}

Alchemy を使う場合は [専用のセットアップ](./alchemy.md) を参照してください。
以下は Alchemy を使わない standalone Workers の手順です。

## 公開版の standalone セットアップ {#setup}

アプリケーションにホストアダプターとWranglerを追加します。 Cloudflare Vite pluginはアダプターの依存関係に含まれます。

```bash
vp add -D @effront/cloudflare wrangler
```

Wranglerの詳細は [公式設定リファレンス](https://developers.cloudflare.com/workers/wrangler/configuration/) を参照してください。

```text
src/
  entry.workers.ts
  entry.effront.tsx
vite.config.ts
wrangler.jsonc
```

`src/entry.workers.ts` から Fetch ハンドラーを公開します。

```typescript
import { createFetchHandler } from "@effront/core/workers";
import application from "./entry.effront";

export default { fetch: createFetchHandler(application) };
```

`wrangler.jsonc` の最小設定です。

```json
{
  "name": "my-effront-app",
  "main": "src/entry.workers.ts",
  "compatibility_date": "2026-09-12",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "binding": "ASSETS" }
}
```

## Vite 設定 {#vite}

共通の `effront()` と Workers 用の `effrontCloudflare()` を登録します。

```typescript
import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});
```

Cloudflare の option が必要な場合は `effrontCloudflare({ ...options })` と直接渡します。
通常の設定では option は不要です。
`cloudflare` で入れ子にせず、React plugin と Vite RSC plugin を別途登録しないでください。
デフォルトの Worker entry は `src/entry.workers.ts`、アプリケーション定義は `src/entry.effront.tsx` です。

## ローカル実行と検証 {#local}

```bash
vp dev

# ビルド済み成果物を Vite と独立に実行する
vp build
vp exec wrangler dev --local --config dist/rsc/wrangler.json
```

開発時もサーバー側のコードは Workers 環境で動きます。
ビルド後は元のソースではなく、生成された `dist/rsc/wrangler.json` を指定して起動してください。
ローカル検証に Cloudflare の認証やデプロイは不要です。

## リクエストコンテキスト {#context}

Fetch export は `(request, env, executionContext)` を受けます。サーバー側 Effect の中で型付きの host 値を取得できます。

```typescript
import { Effect } from "effect";
import { createWorkersContextAccessors } from "@effront/cloudflare/workers";

type Env = { APP_LABEL: string; SERVER_TOKEN?: string };
export const { getWorkersEnv, getWorkersRequestContext } = createWorkersContextAccessors<Env>();

const requestInfo = Effect.gen(function* () {
  const env = yield* getWorkersEnv();
  const context = yield* getWorkersRequestContext();
  return { label: env.APP_LABEL, path: new URL(context.request.url).pathname };
});
```

factory にアプリケーションの Env を一度指定すると、生成した取得関数がその型を返します。 ExecutionContext は `waitUntil(promise: Promise<unknown>): void`を持つ型に設定済みです。個別の呼び出しで型を指定する場合は、同じモジュールが公開する`getWorkersEnv<Env>()` と `getWorkersRequestContext<Env>()`も使えます。リクエスト処理中の Effect から取得してください。

型指定だけでは binding の値を実行時に検証しません。
必要に応じて Layer で検証してください。

## 環境値と秘密値 {#secrets}

bindings と local secrets の設定は [Cloudflare environment variables documentation](https://developers.cloudflare.com/workers/configuration/environment-variables/)を参照してください。Effront は env を HTML や Flight に自動直列化しませんが、JSX や Client props に 明示的に渡した値は公開されます。
