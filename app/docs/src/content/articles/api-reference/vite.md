## effront {#effront}

`@effront/vite` の `effront(options?: EffrontViteOptions): PluginOption[]` は、アプリケーションの開発・ビルド用プラグインを設定します。
React Compiler、React、RSC プラグインを含みます。
これらを重複登録しないでください。
ホストアダプターは別に登録します。

```typescript
import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});
```

この設定に対応するアプリケーションと Wrangler のファイルは [はじめに](/ja/guide/getting-started) を参照してください。

## EffrontViteOptions {#configuration}

| オプション    | 型       | 既定値                    | 契約                                                                             |
| ------------- | -------- | ------------------------- | -------------------------------------------------------------------------------- |
| `application` | `string` | `./src/entry.effront.tsx` | アプリケーション定義を default export するモジュール。Vite root を基準に解決する |
| `rsc`         | `string` | `./src/entry.workers.ts`  | 既定の Workers 連携で `{ fetch }` を公開するリクエストエントリー                 |

ブラウザーの起動コードは Effront が提供します。
`application` が選ぶのは、ブラウザーエントリーではなくアプリケーション定義です。
`@effront/core/application-entry` は Vite のエイリアスでそのモジュールに解決され、独立した公開パッケージサブパスではありません。
`effrontServer` や `effrontAlchemy` などのホストアダプターは、それぞれのリクエストエントリーを設定します。
Effect Schema JIT は、ブラウザー・SSR のエントリー、Node/Bun のホスト、`effront({ rsc })` が選ぶ RSC エントリーで個別に登録します。
ネイティブホストでは `plugins: [effront({ rsc: "./src/entry.rsc.ts" }), effrontServer()]` のように RSC パスを合わせ、実際のエントリーに JIT 登録を適用してください。[実行グラフごとの所有者](https://github.com/totto2727-org/effront/blob/main/packages/vite/docs/SCHEMA-JIT.md)も参照してください。

## effrontCloudflare {#cloudflare}

`@effront/cloudflare` の `effrontCloudflare(options?: EffrontCloudflareOptions): PluginOption[]` は Cloudflare Workers の開発・ビルド連携を追加します。
`effront()` の登録は別途必要です。

`EffrontCloudflareOptions` は、`viteEnvironment` を除く `@cloudflare/vite-plugin` のオプションを受け付けます。

```typescript
import { cloudflare } from "@cloudflare/vite-plugin";

export type EffrontCloudflareOptions = Omit<
  NonNullable<Parameters<typeof cloudflare>[0]>,
  "viteEnvironment"
>;
```

オプションは `cloudflare` プロパティで囲まずに直接渡し、そのまま転送されます。
Effront は `viteEnvironment` を、SSR を子に持つ RSC 環境に固定します。
実行時のバインディングは、このビルド用エントリーではなく `@effront/cloudflare/workers` から読み取ります。

| Vite 設定                       | SSR 出力先を明示しない場合の既定値       |
| ------------------------------- | ---------------------------------------- |
| 出力先の上書きなし              | `dist/rsc/ssr`                           |
| `build.outDir`                  | `<outDir>/rsc/ssr`                       |
| `environments.rsc.build.outDir` | `<rsc outDir>/ssr`。ルートの設定より優先 |

明示した `environments.ssr.build.outDir` が最優先され、その値は保持されます。
指定先は、Wrangler が Worker モジュールとしてバンドルできる場所である必要があります。
ビルド済み Worker には、生成された Wrangler 設定を使います。
ホストのコマンドは [Cloudflare Workers](/ja/platforms/cloudflare) を参照してください。
