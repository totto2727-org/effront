`@effront/alchemy` は、Alchemy で Effront アプリケーションを Cloudflare Workers 上にホストするためのネイティブ HTTP ハンドラーと Vite アダプターを提供します。

## HTTP ハンドラー {#http}

明示ローダーのヘルパーは `@effront/alchemy/cloudflare` からインポートします。
設定済みアプリケーションを使う引数なしのヘルパーは `@effront/alchemy/cloudflare/application` からインポートします。
エントリーを分けることで、独自のローダーを使うホストには設定済みアプリケーションのモジュールを読み込ませません。

| API                                   | 入力                                       | 戻り値                                                  |
| ------------------------------------- | ------------------------------------------ | ------------------------------------------------------- |
| `applicationHttpEffect(load)`         | 遅延アプリケーションローダー               | `HttpApplicationEffect<ApplicationError, Requirements>` |
| `applicationHttpEffect<Definition>()` | `effront()` で指定したアプリケーションの型 | 定義のエラーと要件を保持する `HttpApplicationEffect`    |

どちらも構築用 Effect ではなく、HTTP Effect を直接返します。
`context` オプション、Context のスナップショット、保存したランタイムとリクエストの手動マージはありません。
サービスはネイティブの `Effect.provideService`、または Layer と `Effect.provide` で提供します。
ネイティブ Alchemy ブリッジが現在のホストサービスとリクエスト Scope を管理します。
Effront はリクエストごとにアプリケーション Layer を新しく構築します。
サービスの優先順位はネイティブ Effect の規則に従い、現在のリクエストを特別に優先する独自の規則はありません。
ハンドラーを囲む外部のスコープ付き Layer は、ストリーミング本文の終了前に、ヘッダーの生成後に解放される可能性があります。
リクエスト所有の破棄可能なリソースは、そのような外部 Layer ではなく `EFFRONT.make` のアプリケーション Layer に置いてください。

明示形式は、公開型 `ApplicationLoader<Services, ApplicationError, Requirements>` を受け付けます。

```typescript
import type { ApplicationDefinition } from "@effront/core";

export type ApplicationLoader<Services, ApplicationError, Requirements> = () => Promise<
  ApplicationDefinition<Services, ApplicationError, Requirements>
>;
```

ローダーはリクエスト処理中に実行され、ランタイム引数を受け取りません。
`effront()` と `effrontAlchemy()` を使う場合は、ローダーを書く代わりにアプリケーションを型として参照できます。

```typescript
import { applicationHttpEffect } from "@effront/alchemy/cloudflare/application";
import { Effect } from "effect";
import type application from "./entry.effront";

const construct = Effect.succeed({
  fetch: applicationHttpEffect<typeof application>().pipe(Effect.orDie),
});
```

必要なデプロイ用 capability の取得は、引き続き Worker の構築時に行います。
たとえばネイティブ KV クライアントを yield し、ハンドラー自体は yield せずにサービスを提供します。

```typescript
const construct = Effect.gen(function* () {
  const cache = yield* Cloudflare.KV.ReadWriteNamespace(Cache);
  return {
    fetch: applicationHttpEffect<typeof application>().pipe(
      Effect.provideService(CacheClient, cache),
      Effect.orDie,
    ),
  };
});
```

[Basic サンプル](https://github.com/totto2727-org/effront/tree/main/examples/basic) は `Cache`、`CacheClient`、必要なネイティブ KV バインディングを定義します。
クライアントの提供は、所有権の移転や寿命の延長を行いません。
所有者は、それを使うすべてのレスポンスの処理が終わるまで保持する必要があります。
Alchemy はストリーミングの完了、失敗、キャンセルまでリクエスト Scope を保持します。

型のみのインポートは Worker の実行コードから除去されます。
Plugin は `effront({ application })` で指定したアプリケーションを、RSC グラフでだけ静的にインポートします。
既定のエントリーは `./src/entry.effront.tsx` です。
パッケージの `react-server` エントリーも HTTP レンダラーを静的にインポートし、既定のデプロイ用エントリーはどちらの実行時モジュールも読み込みません。
アプリケーションのモジュールは isolate 初期化時に評価される可能性があるため、モジュール直下では宣言的な定義に留めてください。
型インポートは、そのエントリーと同じアプリケーションを参照してください。
TypeScript は型インポートと Vite 設定の一致までは検証しません。
アプリケーションの型は必要な capability とエラーを保持しますが、capability の実装は提供しません。

互換性とグラフ分離のために、独自のローダーを選ぶ明示的な遅延形式も使用できます。

```typescript
import { applicationHttpEffect } from "@effront/alchemy/cloudflare";

const fetch = applicationHttpEffect(() =>
  import("./entry.effront").then((module) => module.default),
);
```

動的インポートはローダーの中に置いてください。
共有 Worker エントリーで値として静的にインポートすると、インフラ構築時に RSC アプリケーションを評価してしまいます。
設定済み形式は、RSC 統合なしでリクエストを実行すると `TypeError` になります。
ハンドラーの作成時にはアプリケーションを読み込みません。
設定済みアダプターの経路では、アプリケーションとレンダラーに動的インポートを使いません。
ただし、Vite や基盤の RSC フレームワークがコード分割のために生成する動的インポートまで除去するものではありません。
この API は、アプリ固有の runtime Layer の導出や、デプロイ構成と実行時構成の統合は行いません。

ハンドラーは成功時にネイティブの `HttpServerResponse` を返し、[ネイティブ HTTP](./http.md) のエラーチャネルを保持します。
Alchemy が受け付けるエラーの union はより狭いため、`fetch` を返す前に残りのアプリケーションエラーを処理または変換してください。
`Effect.orDie` はその方針の一つであり、必須ではありません。
Worker と Stack の宣言は [Alchemy のセットアップ](../platforms/alchemy.md) を参照してください。

## effrontAlchemy {#vite}

`@effront/alchemy/cloudflare/vite` の `effrontAlchemy(options?: EffrontAlchemyOptions): PluginOption[]` は、`effront()` より後に登録する必要があります。

```typescript
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontAlchemy()],
});
```

> [!WARNING]
> プラグインの順序を逆にすると `TypeError` になります。

| オプション | 型       | 既定値                   | 契約                                                                                                  |
| ---------- | -------- | ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `worker`   | `string` | `./src/entry.workers.ts` | Alchemy Worker を default export するモジュール。Vite root を基準に指定する。空文字列は `TypeError`。 |

このアダプターに `application` オプションはなく、`effront()` の登録も行いません。
アプリケーションエントリーの変更は `effront({ application })` と Worker の型インポート、または明示ローダー内のインポートに反映します。
Worker エントリーは `effront({ rsc })` ではなく `effrontAlchemy({ worker })` で選びます。
ブリッジには Alchemy が注入する `ALCHEMY_STACK_NAME` と `ALCHEMY_STAGE` のバインディングが必要です。欠損または空の値は `TypeError` になり、`alchemy dev` から起動する必要があります。
SSR 出力は既定で RSC Worker 成果物の子ディレクトリに配置されます。明示した出力先は保持されますが、Worker 成果物と一緒にパッケージ化してください。

Worker 宣言には `vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } }` が必要です。
`vite.main`、別のランタイムプラグイン、Wrangler 設定は追加しないでください。
開発中のサーバーコードからは、インフラの provider factory を含む Node 専用のデプロイ・ローカルホスト用 export を使用できません。デプロイ時の export と本番ビルドには影響しません。
Alchemy は、Vite 単体ではなく `alchemy dev` を通じてホストプラグインとバインディングを提供します。
Alchemy `2.0.0-beta.81` は [ローカル起動](../platforms/alchemy.md#stack) でも設定済み Cloudflare profile を必要とします。
