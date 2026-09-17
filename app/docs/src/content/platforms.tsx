import { CodeBlock } from "../components/code-block";
import type { CodeLanguage } from "../components/code-block";
import type { DocPage } from "./types";

const code = (source: string, language: CodeLanguage) => (
  <CodeBlock code={source} language={language} />
);

export const platformPages: readonly DocPage[] = [
  {
    slug: "/platforms",
    title: "プラットフォーム",
    description: "実行環境に合わせたホスト統合を選びます。",
    section: "Platforms",
    headings: [
      { id: "architecture", title: "ホスト統合の役割" },
      { id: "support", title: "対応状況" },
    ],
    content: () => (
      <>
        <h2 id="architecture">ホスト統合の役割</h2>
        <p>
          Effront のコアは native Effect HTTP と Web 標準の Fetch 境界を提供します。
          共通のビルド統合は <code>@effront/vite</code>
          、実行環境との接続はホスト用プラグインが担当します。 利用するホスト用プラグインを{" "}
          <code>effront()</code> と組み合わせて登録します。
        </p>
        <p>
          standalone 構成は、アプリケーション定義の <code>entry.effront.tsx</code> と Fetch
          を公開する
          <code>entry.workers.ts</code> を使います。Vite
          とホスト用プラグインは後者を直接読み込みます。将来の Node / Bun 向けには、
          <code>entry.server.ts</code> から Fetch を接続する方式と、Runtime を再利用して Effect HTTP
          で直接ホストする方式を検討しています。
        </p>
        <p>
          この実験ブランチでは、examples と本サイトを Alchemy native Worker に移行しています。
          <code>@effront/alchemy/cloudflare</code> が構築時の能力を捕捉し、 core の native Effect
          HTTP handler へリクエスト単位で接続します。 Alchemy アダプターは評価中の private workspace
          package です。
        </p>
        <h2 id="support">対応状況</h2>
        <ul>
          <li>
            <a href="/platforms/cloudflare">Cloudflare Workers</a>:<code>@effront/cloudflare</code>{" "}
            で、開発サーバーと Wrangler による実行に対応しています。
          </li>
          <li>Node、Bun、Vercel: 専用アダプターは今後の対応候補です。</li>
        </ul>
        <p>
          最初のアプリケーションは <a href="/guide/getting-started">はじめる</a> の Cloudflare
          Workers 向けサンプルで作成できます。
        </p>
      </>
    ),
  },
  {
    slug: "/platforms/cloudflare",
    title: "Cloudflare Workers のホスト設定",
    description:
      "Workers の env と execution context を安全に読む方法、および Vite と Wrangler の役割を説明します。",
    section: "Platforms",
    headings: [
      { id: "alchemy", title: "Alchemy native Worker（実験版）" },
      { id: "setup", title: "公開版の standalone セットアップ" },
      { id: "vite", title: "Vite 設定" },
      { id: "local", title: "ローカル実行と検証" },
      { id: "context", title: "リクエストコンテキスト" },
      { id: "secrets", title: "環境値と秘密値" },
    ],
    content: () => (
      <>
        <h2 id="alchemy">Alchemy native Worker（実験版）</h2>
        <p>
          現在の examples と本サイトは <code>alchemy.run.ts</code> でインフラを定義し、
          <code>entry.workers.ts</code> から Alchemy の native Worker を公開します。
          <code>makeApplicationHttpEffect</code> へ遅延 import を渡すため、構築時に RSC
          アプリを読み込みません。 KV の Binding は Worker の構築 Effect
          で登録し、そのクライアントをアプリのサービスとして提供します。 リクエスト用 Layer
          とストリームの Scope はリクエストごとに管理されます。
        </p>
        {code(
          `import { makeApplicationHttpEffect } from "@effront/alchemy/cloudflare";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

export default Cloudflare.Worker("App", {
  main: import.meta.url,
  compatibility: { date: "2026-09-01", flags: ["nodejs_compat"] },
  vite: { viteEnvironments: { entry: "rsc", children: ["ssr"] } },
}, Effect.gen(function* () {
  const fetch = yield* makeApplicationHttpEffect(
    () => import("./entry.effront").then(module => module.default),
  );
  return { fetch: fetch.pipe(Effect.orDie) };
}));`,
          "ts",
        )}
        <p>
          Vite には <code>effront()</code> と <code>effrontAlchemy()</code> を別々に登録します。
          React・RSC・SSR・browser のコンパイルとアプリのエントリ解決は <code>effront</code>{" "}
          が担い、 Alchemy アダプターは native Worker bridge と runtime
          のコンパイル設定を追加します。
          <code>application</code> は <code>effront</code> だけに指定し、
          <code>effrontAlchemy</code> のオプションは <code>worker</code> のみです。 Alchemy CLI が
          runtime plugin と binding を用意するため、アプリ側の手動 host
          登録や環境変数による条件分岐は不要です。手書きの <code>wrangler.toml</code>
          も使用しません。各アプリのディレクトリで <code>vp run dev</code>
          を実行すると、公式の <code>alchemy dev</code> が起動します。 beta.77
          ではローカル資源を使う場合も Cloudflare profile の初期設定が必要です。
        </p>
        {code(
          `import { effrontAlchemy } from "@effront/alchemy/cloudflare/vite";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontAlchemy()],
});`,
          "ts",
        )}
        <p>
          開発時は、Alchemy のデプロイ・ローカルホスト専用コードを除外する暫定互換処理を使用します。
          利用できる機能を列挙する方式ではなく、それ以外の公開 export は保持します。
          <code>optimizeDeps</code> の独自設定や、バージョン番号による起動拒否は行いません。
          <code>effront()</code>、<code>effrontAlchemy()</code> の順に登録してください。
        </p>
        <p>
          動的 import は Vite の RSC アプリ定義を構築時に読み込まないための境界です。
          値の受け渡し自体は Effect Context のサービス参照で行い、シリアライズや RPC
          を必要としません。サンプルの <code>CacheClient</code> は Alchemy のクライアント型を
          使用するため、Alchemy 非依存の契約とは区別してください。
        </p>
        <p>
          完全な構成、KV の利用例、依存バージョンの制約はリポジトリの
          <code>packages/alchemy/docs/INTEGRATION.md</code> と <code>examples/alchemy</code>{" "}
          にあります。 以下は引き続き利用できる公開済み standalone adapter の設定です。
        </p>
        <h2 id="setup">公開版の standalone セットアップ</h2>
        <p>
          アプリケーションにホストアダプターとWranglerを追加します。 Cloudflare Vite
          pluginはアダプターの依存関係に含まれます。
        </p>
        {code(`vp add -D @effront/cloudflare wrangler`, "bash")}
        <p>
          Wranglerの詳細は{" "}
          <a href="https://developers.cloudflare.com/workers/wrangler/configuration/">
            公式設定リファレンス
          </a>{" "}
          を参照してください。
        </p>
        {code(
          `src/
  entry.workers.ts
  entry.effront.tsx
vite.config.ts
wrangler.jsonc`,
          "text",
        )}
        <p>
          <code>src/entry.workers.ts</code> から Fetch ハンドラーを公開します。
        </p>
        {code(
          `import { createFetchHandler } from "@effront/core/workers";
import application from "./entry.effront";

export default { fetch: createFetchHandler(application) };`,
          "ts",
        )}
        <p>
          <code>wrangler.jsonc</code> の最小設定です。
        </p>
        {code(
          `{
  "name": "my-effront-app",
  "main": "src/entry.workers.ts",
  "compatibility_date": "2026-09-12",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "binding": "ASSETS" }
}`,
          "json",
        )}
        <h2 id="vite">Vite 設定</h2>
        <p>
          Vite 統合と Cloudflare adapter は分けて登録します。<code>effront()</code> が React、Vite
          RSC、 compiler を担当し、<code>effrontCloudflare()</code> は <code>rsc</code> Worker
          environment、子
          <code>ssr</code> environment、Workers 向け SSR 出力配置だけを担当します。
        </p>
        {code(
          `import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});`,
          "ts",
        )}
        <p>
          Cloudflare の option が必要な場合は{" "}
          <code>effrontCloudflare(&#123; ...options &#125;)</code> と 直接渡します。通常の設定では
          option は不要です。<code>cloudflare</code> で入れ子にせず、React plugin と Vite RSC plugin
          はアダプターと共通プラグインが登録します。デフォルトでは RSC entry は
          <code>src/entry.workers.ts</code>、アプリケーションの alias は{" "}
          <code>src/entry.effront.tsx</code> です。
        </p>
        <h2 id="local">ローカル実行と検証</h2>
        {code(
          `vp dev

# ビルド済み成果物を Vite と独立に実行する
vp build
vp exec wrangler dev --local --no-bundle --config dist/rsc/wrangler.json`,
          "bash",
        )}
        <p>
          開発時は Cloudflare Vite plugin が RSC と SSR を workerd で実行します。 ビルド後は
          Wrangler が <code>dist/rsc/wrangler.json</code> を読み込みます。 未処理の RSC ソースを
          Wrangler に直接コンパイルさせません。 ローカル検証に Cloudflare
          の認証やデプロイは不要です。
        </p>
        <h2 id="context">リクエストコンテキスト</h2>
        <p>
          Fetch export は <code>(request, env, executionContext)</code> を受けます。サーバー側
          Effect の中で型付きの host 値を取得できます。
        </p>
        {code(
          `import { Effect } from "effect";
import { createWorkersContextAccessors } from "@effront/cloudflare/workers";

type Env = { APP_LABEL: string; SERVER_TOKEN?: string };
export const { getWorkersEnv, getWorkersRequestContext } =
  createWorkersContextAccessors<Env>();

const requestInfo = Effect.gen(function* () {
  const env = yield* getWorkersEnv();
  const context = yield* getWorkersRequestContext();
  return { label: env.APP_LABEL, path: new URL(context.request.url).pathname };
});`,
          "ts",
        )}
        <p>
          factory にアプリケーションの Env を一度指定すると、生成した取得関数がその型を返します。
          ExecutionContext は <code>waitUntil(promise: Promise&lt;unknown&gt;): void</code>
          を持つ型に設定済みです。個別の呼び出しで型を指定する場合は、同じモジュールが公開する
          <code>getWorkersEnv&lt;Env&gt;()</code> と{" "}
          <code>getWorkersRequestContext&lt;Env&gt;()</code>
          も使えます。リクエスト処理中の Effect から取得してください。
        </p>
        <p>
          どの factory も同じリクエスト用 Context を読みます。型指定はアプリケーション側の契約で、
          binding の実行時検証は必要に応じて Layer で行います。
          <code>@effront/cloudflare/workers</code> はランタイム用の入口で、Vite
          プラグインとは分離されています。
        </p>
        <h2 id="secrets">環境値と秘密値</h2>
        <p>
          bindings と local secrets の設定は{" "}
          <a href="https://developers.cloudflare.com/workers/configuration/environment-variables/">
            Cloudflare environment variables documentation
          </a>
          を参照してください。Effront は env を HTML や Flight に自動直列化しませんが、JSX や Client
          props に 明示的に渡した値は公開されます。
        </p>
      </>
    ),
  },
];
