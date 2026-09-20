## 既存の Effront アプリケーションを準備する {#setup}

Alchemy を使うと、アプリケーションを動かす Cloudflare Worker と、KV の名前空間などの利用するリソースを一緒にコードで定義できます。
このガイドでは、既存の Effront アプリケーションを Alchemy でローカル起動し、その後で KV を追加する手順を説明します。
設定を終えると、ローカル URL を開いてアプリケーションのページを確認できます。

この手順では、ページとルートを含むアプリケーションを `src/entry.effront.tsx` から default export しており、[共通の React・Effect の依存関係](../api-reference.md#versions) がインストール済みであることを前提とします。
アダプターとビルド用の連携パッケージを追加します。

```bash
vp add @effront/alchemy@0.1.4 alchemy@2.0.0-beta.77
vp add -D @effront/vite@0.1.4 @vitejs/plugin-rsc
```

Alchemy と Cloudflare runtime は `2.0.0-beta.77`、Effect 関連パッケージは `4.0.0-rc.112` に揃えてください。

## Alchemy で動かすアプリケーションを定義する {#worker}

まず `src/entry.workers.ts` を作成し、HTTP ハンドラーでアプリケーションを実行する Worker を定義します。
`makeApplicationHttpEffect` には、アプリケーションの default export を読み込む関数を渡します。

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

動的 import は読み込み用の関数の中に保ってください。
Alchemy はリクエストを処理する前のリソース準備時にも Worker の定義を評価するため、ファイルのトップレベルで import するとアプリケーションを早すぎる段階で読み込んでしまいます。
関数を渡すことで、リクエストが届くまで読み込みを遅らせます。
この例では、Worker の HTTP 境界で `Effect.orDie` を使い、残っているアプリケーションの失敗を defect に変換しています。
アプリケーションに応じたエラーレスポンスが必要な場合は、この箇所で明示的に方針を決めて処理してください。

次に、プロジェクトのルートに `alchemy.run.ts` を作成し、Worker を Stack に含めます。
これにより、Alchemy が管理するアプリケーションを指定し、Worker の URL を Stack の出力として公開します。

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

この例では、新しいアプリケーションの管理状態を `localState()` でローカルに保存します。

## 開発環境を起動してページを開く {#stack}

Alchemy を起動する前に、アプリケーションと Worker を一緒にビルドするよう Vite を設定します。
`vite.config.ts` に両方のプラグインを追加し、`effront()` を `effrontAlchemy()` より前に置いてください。

```typescript
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontAlchemy()],
});
```

デフォルトの設定は、ここまでのファイルパスに対応しています。
アプリケーションを別のパスに置く場合は `effront({ application })` を指定します。
Worker を別のパスに置く場合は `effrontAlchemy({ worker })` を指定します。
ファイルを移動した場合は、Worker と Stack の import も合わせて変更してください。
Alchemy CLI が Cloudflare の実行環境を用意するため、Cloudflare の実行用プラグインや Wrangler 設定を別途追加しないでください。

また、`2.0.0-beta.77` の CLI は、ローカル開発でもリソースを準備する前に設定済みの Cloudflare profile を必要とします。
profile が未設定の場合は、先に [Alchemy の公式ドキュメント](https://alchemy.run/docs) に従って認証設定を済ませてください。

`package.json` の scripts に `"dev": "alchemy dev"` を追加し、プロジェクトのルートで実行します。

```bash
vp run dev
```

`vp dev` だけでは Alchemy の実行環境が起動しないため、このスクリプトを使ってください。
Worker の準備ができたら、CLI に表示されるローカル URL を開き、`entry.effront.tsx` に定義したルートへアクセスします。
ページが表示されれば、Worker、アプリケーション、開発用の実行環境が接続できたことを確認できます。

## データ保存が必要になったら KV を追加する {#capabilities}

最初のページが動いたら、アプリケーションに必要な場合はデータ保存機能を追加します。
KV を使うには、Worker の定義を拡張して名前空間を作成し、クライアントを取得して、アプリケーションのサービスとして `makeApplicationHttpEffect` に渡します。
[KV を使う完全なサンプル](https://github.com/totto2727-org/effront/tree/main/examples/alchemy) では、必要な `ReadWriteNamespaceBinding` と、クライアントを利用するリクエストごとの Layer を含む設定を確認できます。
サービスの型や接続用の関数をアプリケーションに合わせる際は、[Alchemy API](../api-reference/alchemy.md) を参照してください。

リソースの生存期間は Worker の定義と分けて扱ってください。
アプリケーションの Layer はリクエストごとに取得されるため、リクエスト終了時に解放する接続などは Worker の構築時ではなく、この Layer で取得します。
描画するページや Server Function の戻り値を通じてブラウザーへ渡すのはアプリケーションのデータだけにし、サービスのクライアントや認証情報は含めないでください。
