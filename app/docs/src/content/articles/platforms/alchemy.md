## Alchemy を選ぶ場合 {#setup}

`@effront/alchemy` は native Cloudflare Worker の構築時に取得した能力を、リクエスト単位のアプリケーションサービスへ接続する実験的アダプターです。
Workers を直接扱う場合は [standalone の手順](./cloudflare.md) を使います。
Alchemy と Cloudflare runtime は `2.0.0-beta.77`、Effect family は `4.0.0-rc.112` に揃えます。
[共通の React peers](../api-reference.md#versions) と `entry.effront.tsx` を準備してから追加します。

```bash
vp add @effront/alchemy@0.1.3 alchemy@2.0.0-beta.77
vp add -D @effront/vite@0.1.3 @vitejs/plugin-rsc
```

## Native Worker と Vite {#worker}

`src/entry.workers.ts` ではアプリケーションを静的 import せず、loader を渡します。
これによりインフラの構築時には RSC アプリケーションを評価しません。

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

`vite.config.ts` は共通コンパイラーとアダプターを分けて登録します。

```typescript
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontAlchemy()],
});
```

`application` は `effront()`、native Worker の `worker` は `effrontAlchemy()` のオプションです。
Alchemy CLI が runtime plugin と binding を注入するため、手動の host plugin や Wrangler 設定を追加しません。

## Stack とローカル起動 {#stack}

`alchemy.run.ts` に Stack を定義します。
以下は新しい利用者アプリケーション用の local state の例で、本サイトの deployment state 設定を変更する手順ではありません。

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

`package.json` の scripts に `"dev": "alchemy dev"` を追加し、`vp run dev` で起動します。
裸の `vp dev` は Alchemy の orchestration を通りません。
beta.77 の公式 CLI はローカル資源を使う場合も Cloudflare profile が必要です。
profile がなければ [公式の認証手順](https://alchemy.run/docs) を確認して利用者自身が設定してください。
認証なしのローカル test host の成功は CLI planning やリモート deployment の確認にはなりません。

## 能力とリクエストの境界 {#capabilities}

構築時に捕捉するのはサービス参照です。
値を Flight へシリアライズしたり RPC で運んだりする仕組みではありません。
アプリケーションの Layer はリクエストごとに取得し、リクエスト用サービスを構築時の値で上書きしません。
秘密値を描画結果や Server Function の戻り値へ含めないでください。

KV を使う完全な例は [native Alchemy example](https://github.com/totto2727-org/effront/tree/main/examples/alchemy)、能力を接続する関数の契約は [Alchemy API](../api-reference/alchemy.md) にあります。
