`@effront/alchemy` を使うと、Effront アプリケーションを Alchemy の native Worker に接続し、リクエスト処理中にアプリケーション用のサービスを利用できます。
基本となる API は `makeApplicationHttpEffect` です。
Worker の構築時に実行し、得られた HTTP Effect を `fetch` として返します。
このリファレンスでは、ハンドラーの作成、必要なサービスの提供、Vite プラグインのオプションを説明します。
Worker の宣言と Stack を含む一式の設定は、[Alchemy のセットアップ](../platforms/alchemy.md) を参照してください。

## リクエストハンドラーを作る {#http}

**まず `makeApplicationHttpEffect` を使う**

`@effront/alchemy/cloudflare` から `makeApplicationHttpEffect` を import し、Worker を構築する Effect の中で呼び出します。
アプリケーションが構築時の追加サービスを必要としない場合、次の `construct` を `Cloudflare.Worker` の第 3 引数に渡せます。

```typescript
import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import { Effect } from "effect";

const construct = Effect.gen(function* () {
  const fetch = yield* makeApplicationHttpEffect(() =>
    import("./entry.effront").then((module) => module.default),
  );
  return { fetch: fetch.pipe(Effect.orDie) };
});
```

処理には 2 つの段階があります。
構築時に `yield* makeApplicationHttpEffect(...)` が再利用可能なハンドラーを作り、その後、リクエストを受け取るたびに Alchemy がそのハンドラーを実行します。
アプリケーションの読み込みと native HTTP response の生成は、後者の段階でのみ行われます。
例の `Effect.orDie` は後述するエラー境界での処理方針の一例であり、この方針を使う必要があるわけではありません。

**アプリケーションの import は loader の中に置く**

どちらのハンドラー API も、`@effront/alchemy/cloudflare` の `ApplicationLoader<Services, ApplicationError, Requirements>` を受け取ります。
型は `() => Promise<ApplicationDefinition<Services, ApplicationError, Requirements>>` なので、loader を次のように別の関数として定義できます。

```typescript
const load = () => import("./entry.effront").then((module) => module.default);
```

これを Worker モジュールの先頭での静的 import に置き換えないでください。
Alchemy はインフラの準備時に Worker の定義を評価しますが、アプリケーションはリクエスト処理時の RSC グラフに属します。
動的 import を loader の中に保つことで、インフラの構築時にアプリケーションが評価されるのを防ぎます。

**アプリケーション用サービスの渡し方を選ぶ**

Worker の構築時に作ったクライアントをアプリケーションが必要とする場合は、構築用の Effect を実行する前に、そのサービスを `makeApplicationHttpEffect(load)` へ提供します。
たとえば、`makeApplicationHttpEffect(load).pipe(Effect.provideService(CacheClient, kv))` は、アプリケーションの `CacheClient` サービスとして `kv` の参照を保持します。
`CacheClient` はアプリケーションが定義するサービスで、`kv` は Alchemy から取得済みである必要があります。
サービスの定義と KV クライアントの準備をまとめたコードは、[Alchemy のサンプル](https://github.com/totto2727-org/effront/tree/main/examples/alchemy) にあります。

構築用の Effect の Context を捕捉する代わりに、明示的な Effect Context を渡したい場合は、`applicationHttpEffect(load, { context? }?)` を使います。
この関数は HTTP ハンドラーの Effect を直接返すため、ハンドラーを取得するために `yield*` する外側の構築用 Effect はありません。
取得済みの `kv` クライアントを渡す例です。

```typescript
import { applicationHttpEffect } from "@effront/alchemy/cloudflare";
import { Context } from "effect";
import { CacheClient } from "./features/greeting/services";

const fetch = applicationHttpEffect(
  () => import("./entry.effront").then((module) => module.default),
  { context: Context.make(CacheClient, kv) },
);
```

保持するサービスがなければ、`context` は省略できます。
どちらの API でも、保持したサービスと同じキーのサービスが現在のリクエストにあれば、リクエスト側の値が優先されます。
構築時の HTTP サービス、Scope、Layer の memo map、Alchemy の `RuntimeContext`、Worker self、汎用の `Self`、Cloudflare 環境、元の Request、Worker 環境、実行コンテキストは捕捉対象から除外されます。
これらのホスト側サービスは、保存した構築時の Context ではなく、現在のリクエストから提供する必要があります。

**サービスの所有権は提供元に残す**

どちらの API も、捕捉するサービスの取得や寿命の延長は行いません。
保持されたクライアントの所有者は、それを使うすべてのレスポンスが完了・失敗・キャンセルのいずれかで終了するまで、クライアントを利用可能にしておく必要があります。
リクエスト単位で後処理が必要なリソースは、Worker の構築時ではなく、アプリケーションの Layer で取得してください。
この Layer はリクエストごとに取得され、Alchemy はストリーミングレスポンスの完了・失敗・キャンセルまでリクエストの Scope を保持します。

**`fetch` を返す前にアプリケーションのエラーを処理する**

どちらの API もアプリケーションの型付きエラーを保持しますが、Alchemy の native ハンドラーが受け付けるエラー型はそれより限定されています。
ハンドラーを `fetch` として返す前に、受け付けられないアプリケーションエラーを処理または変換してください。
最初の例では、`Effect.orDie` でそれらを defect に変換しています。
代わりに、アプリケーション独自のエラーレスポンス方針を実装することもできます。

## Worker のビルドを設定する {#vite}

Vite でアプリケーションと native Worker の接続部分をビルドできるよう、`@effront/alchemy/cloudflare/vite` の `effrontAlchemy(options?)` を `effront()` の後に登録します。

```typescript
import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontAlchemy()],
});
```

`EffrontAlchemyOptions` が持つオプションは `worker?: string` のみです。
Alchemy Worker を default export するモジュールを指定し、パスは Vite root を基準に解決され、既定値は `./src/entry.workers.ts` です。
空文字列を指定すると `TypeError` が発生します。
アプリケーションのエントリーを移動する場合は、代わりに `effront({ application })` を使い、Worker 内の動的 import も合わせて変更します。
Alchemy プラグインは `application` オプションを受け付けず、`effront()` を自動登録することもありません。

Worker の宣言には `vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } }` を設定します。
エントリーはアダプターが用意するため、`vite.main` を併せて指定しないでください。

開発用ホストは Vite 単体ではなく、`alchemy dev` で起動します。
Alchemy が Cloudflare の実行用プラグインとバインディングを用意するため、別の実行用プラグインや Wrangler 設定は追加しないでください。
Alchemy `2.0.0-beta.77` はローカル開発でも設定済みの Cloudflare profile を必要とします。
実行するコマンドと認証設定は、[ローカルでの起動](../platforms/alchemy.md#stack) を参照してください。
