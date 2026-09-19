`@effront/vite` で Vite 設定に Effront を追加し、アプリケーションを実行するホストのアダプターを組み合わせます。
Cloudflare Workers では `@effront/cloudflare` を使います。
まずは次の既定の構成で登録し、エントリーファイルや Cloudflare の設定を変える場合にだけオプションを指定してください。

## Vite に Effront を登録する {#effront}

`effront(options?: EffrontViteOptions): PluginOption[]` は、Effront の開発・ビルド用プラグインを返します。
戻り値をホストのアダプターとともに Vite の `plugins` 配列へ登録します。
Cloudflare Workers 向けの既定の構成は次のとおりです。

```typescript
import { defineConfig } from "vite-plus";
import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";

export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});
```

`effront()` は React Compiler を有効にし、React プラグインと RSC プラグインを登録します。
これらのプラグインを同じ設定に重複登録しないでください。
この例を動かすためのアプリケーションファイルと Wrangler 設定は、[はじめる](/guide/getting-started) の手順で用意できます。

## エントリーファイルを指定する {#configuration}

`effront()` の 2 つのオプションで、アプリケーションを定義するファイルとリクエストを受け付けるファイルを指定できます。
既定のファイル配置を使う場合は、どちらも省略できます。

```typescript
export type EffrontViteOptions = {
  readonly rsc?: string;
  readonly application?: string;
};
```

| オプション    | 既定値                    | 用途                                                                                               |
| ------------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| `application` | `./src/entry.effront.tsx` | アプリケーション定義を公開するモジュールを指定します。パスは Vite の `root` を基準に解決されます。 |
| `rsc`         | `./src/entry.workers.ts`  | `{ fetch }` ハンドラーを公開する、リクエスト処理用のエントリーを指定します。                       |

次の例では、両方の既定値を明示しています。
ファイルを移動したり名前を変えたりした場合は、対応するパスに置き換えてください。

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

`application` が指すのはアプリケーション定義であり、ブラウザーのエントリーではありません。
ブラウザーの起動コードは Effront が提供します。
`@effront/core/application-entry` の import は、Vite alias を通じて指定したアプリケーションモジュールを参照します。
この alias は `@effront/core` の独立した公開 subpath ではありません。

## Cloudflare Workers を設定する {#cloudflare}

`effrontCloudflare(options?: EffrontCloudflareOptions): PluginOption[]` は、`effront()` と組み合わせる Workers 向けのプラグインを返します。
Cloudflare Vite プラグインのオプションは、`cloudflare` プロパティで囲まずに、この関数へ直接渡してください。
受け付ける型は次のとおりです。

```typescript
import { cloudflare } from "@cloudflare/vite-plugin";

export type EffrontCloudflareOptions = Omit<
  NonNullable<Parameters<typeof cloudflare>[0]>,
  "viteEnvironment"
>;
```

受け付けたオプションはすべて `@cloudflare/vite-plugin` へそのまま転送されます。
`viteEnvironment` は Effront が設定するため、指定できるオプションから除外されています。
実行時に `env` を読む場合は、このビルド用エントリーではなく `@effront/cloudflare/workers` を使います。

**出力ディレクトリー**

ビルド成果物の保存先を変える必要がなければ、既定の出力配置を使ってください。
既定では、Wrangler が SSR モジュールを Worker に取り込めるように `dist/rsc/ssr` へ出力します。
出力先を変える場合は、`effrontCloudflare()` のオプションではなく Vite 設定で指定します。

| Vite 設定                       | SSR の出力先を明示していない場合の動作                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `build.outDir`                  | このディレクトリー内の `rsc/ssr` に出力します。ただし、`environments.rsc.build.outDir` も指定した場合はそちらが優先されます。 |
| `environments.rsc.build.outDir` | このディレクトリー内の `ssr` に出力します。                                                                                   |

`environments.ssr.build.outDir` を明示すると、上記のどちらよりも優先されます。
Effront はその値を維持するため、変更後の場所でも Wrangler が SSR モジュールを取り込める構成にしてください。
ビルド後のローカル実行には、生成された Wrangler 設定を使います。
開発と本番実行のコマンドは [Cloudflare Workers](/platforms/cloudflare) を参照してください。
