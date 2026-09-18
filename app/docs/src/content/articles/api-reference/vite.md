## @effront/vite {#effront}

`effront(options: EffrontViteOptions = ): PluginOption[]` は React Compiler、RSC・SSR・ブラウザーの各エントリー、アプリケーション定義の alias を設定します。

```typescript
export type EffrontViteOptions = {
  readonly rsc?: string;
  readonly application?: string;
};
```

| API / 項目                        | 契約                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `rsc`                             | 既定値 ./src/entry.workers.ts。{ fetch } を公開する RSC 環境のエントリー。                                    |
| `application`                     | 既定値 ./src/entry.effront.tsx。アプリケーション定義を公開するモジュール。Vite の root を基準に解決されます。 |
| `@effront/core/application-entry` | application オプションから生成される Vite alias。パッケージの独立した公開 subpath ではありません。            |

React plugin と RSC plugin はこの統合が登録します。同じ構成へ重複登録しないでください。`application` は `src/entry.effront.tsx`のアプリケーション定義を参照します。ブラウザーの起動コードはEffrontが提供します。

## @effront/cloudflare {#cloudflare}

`effrontCloudflare(options: EffrontCloudflareOptions = ): PluginOption[]` は Cloudflare Vite plugin を構成します。オプションの型は次の定義です。

```typescript
import { cloudflare } from "@cloudflare/vite-plugin";

export type EffrontCloudflareOptions = Omit<
  NonNullable<Parameters<typeof cloudflare>[0]>,
  "viteEnvironment"
>;
```

| API / 項目                      | 契約                                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `options`                       | viteEnvironment 以外の Cloudflare Vite plugin オプションを、そのまま転送します。cloudflare プロパティの下へネストしません。 |
| `viteEnvironment`               | rsc と、その子環境 ssr に固定されます。オプションから変更できません。                                                       |
| `SSR の出力先`                  | 既定で RSC 出力ディレクトリー内の ssr。通常は dist/rsc/ssr です。                                                           |
| `environments.ssr.build.outDir` | 利用者が明示した場合は維持されます。変更時も Wrangler が SSR モジュールを取り込める構成にします。                           |

RSC と SSR は Cloudflare の workerd で動作します。ビルド後のローカル実行には生成された Wrangler 設定を使います。ランタイムで env を読む場合は、このビルド用エントリーではなく `@effront/cloudflare/workers` を読み込みます。

## 組み合わせ方 {#configuration}

```typescript
import { defineConfig } from "vite-plus";
import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";

export default defineConfig({
  plugins: [
    effront({
      rsc: "./src/entry.workers.ts",
      application: "./src/entry.effront.tsx",
    }),
    effrontCloudflare(),
  ],
});
```

上記のエントリーパスは既定値なので `effront()` と省略できます。Wrangler 設定を含む実行可能な初期構成は [はじめる](/guide/getting-started)、ホスト固有の設定は [Cloudflare Workers](/platforms/cloudflare) を参照してください。
