import type { DocPage } from "./types";

// Stable routes and heading IDs are independent of Markdown file naming.
export const articleCatalog = [
  {
    slug: "/",
    title: "Effront",
    description: "Web標準とEffectベースで実装されたReactのメタフレームワークです。",
    section: "Getting started",
    headings: [
      {
        id: "overview",
        title: "Effrontについて",
      },
      {
        id: "boundaries",
        title: "Web標準を境界にする",
      },
      {
        id: "next",
        title: "次に読むもの",
      },
    ],
    source: "/index",
  },
  {
    slug: "/guide/getting-started",
    title: "はじめる",
    description: "共通のアプリケーションを定義し、ホストを選んでローカル起動まで進めます。",
    section: "Getting started",
    headings: [
      {
        id: "setup",
        title: "準備",
      },
      {
        id: "files",
        title: "アプリケーションの構成",
      },
      {
        id: "application",
        title: "アプリケーションを書く",
      },
      {
        id: "run",
        title: "ビルド統合と実行",
      },
    ],
    source: "/guide/getting-started",
  },
  {
    slug: "/platforms",
    title: "プラットフォーム",
    description: "実行環境に合わせたホスト統合を選びます。",
    section: "Platforms",
    headings: [
      {
        id: "architecture",
        title: "ホスト統合の役割",
      },
      {
        id: "support",
        title: "対応状況",
      },
      {
        id: "build-startup",
        title: "ビルドと起動の契約",
      },
    ],
    source: "/platforms",
  },
  {
    slug: "/platforms/cloudflare",
    title: "Cloudflare Workers のホスト設定",
    description:
      "Workers の env と execution context を安全に読む方法、および Vite と Wrangler の役割を説明します。",
    section: "Platforms",
    headings: [
      {
        id: "alchemy",
        title: "Alchemy native Worker（実験版）",
      },
      {
        id: "setup",
        title: "公開版の standalone セットアップ",
      },
      {
        id: "vite",
        title: "Vite 設定",
      },
      {
        id: "local",
        title: "ローカル実行と検証",
      },
      {
        id: "context",
        title: "リクエストコンテキスト",
      },
      {
        id: "secrets",
        title: "環境値と秘密値",
      },
    ],
    source: "/platforms/cloudflare",
  },
  {
    slug: "/platforms/node-bun",
    title: "Node.js / Bun",
    description: "native Effect HTTP での開発・ビルド・静的アセット配信を始めます。",
    section: "Platforms",
    headings: [
      {
        id: "setup",
        title: "準備とホストの選択",
      },
      {
        id: "entries",
        title: "アプリケーションとビルド",
      },
      {
        id: "node",
        title: "Node.js で起動する",
      },
      {
        id: "bun",
        title: "Bun で起動する",
      },
      {
        id: "assets",
        title: "静的ファイルと運用境界",
      },
    ],
    source: "/platforms/node-bun",
  },
  {
    slug: "/platforms/alchemy",
    title: "Alchemy + Cloudflare",
    description: "native Worker、Vite、Stack と能力の接続を設定します。",
    section: "Platforms",
    headings: [
      {
        id: "setup",
        title: "Alchemy を選ぶ場合",
      },
      {
        id: "worker",
        title: "Native Worker と Vite",
      },
      {
        id: "stack",
        title: "Stack とローカル起動",
      },
      {
        id: "capabilities",
        title: "能力とリクエストの境界",
      },
    ],
    source: "/platforms/alchemy",
  },
  {
    slug: "/guide/routes",
    title: "ルート、Layout、パラメーター",
    description:
      "不変な Routes グラフに Page、ネストした Layout、Schema によるパスパラメーターを追加します。",
    section: "Guides",
    headings: [
      {
        id: "pages",
        title: "静的ページ、パラメーター、catch-all",
      },
      {
        id: "mount",
        title: "ネストした Routes と Loading",
      },
      {
        id: "matching",
        title: "マッチング時の注意",
      },
    ],
    source: "/guide/routes",
  },
  {
    slug: "/guide/components",
    title: "Server Component と Client Component",
    description:
      "Effectful なサーバー UI と、ブラウザーで操作する Client Component を組み合わせます。",
    section: "Guides",
    headings: [
      {
        id: "server",
        title: "Effectful な Server Component",
      },
      {
        id: "client-boundary",
        title: "Client boundary と CSS",
      },
      {
        id: "boundary",
        title: "境界を守る",
      },
    ],
    source: "/guide/components",
  },
  {
    slug: "/guide/server-functions",
    title: "Server Function",
    description:
      "Schema で入力を検証し、アプリケーションサービスを使う更新処理を React のフォームから呼び出します。",
    section: "Guides",
    headings: [
      {
        id: "identity",
        title: "アプリケーションと同じ定義を使う",
      },
      {
        id: "input",
        title: "入力の型とデコード",
      },
      {
        id: "forms",
        title: "フォームから直接呼び出す",
      },
      {
        id: "state",
        title: "useActionState で結果を表示する",
      },
      {
        id: "application",
        title: "Page とアプリケーションへ組み込む",
      },
      {
        id: "refresh",
        title: "再表示と失敗の扱い",
      },
    ],
    source: "/guide/server-functions",
  },
  {
    slug: "/guide/effect",
    title: "Effect とアプリケーションサービス",
    description:
      "Effect の Context.Service と Layer を使い、サーバーの依存関係を Page に注入します。",
    section: "Guides",
    headings: [
      {
        id: "service",
        title: "型付きサービスと Layer",
      },
      {
        id: "missing-services",
        title: "サービス不足の型エラー",
      },
      {
        id: "lifetime",
        title: "リクエストごとの生存期間",
      },
    ],
    source: "/guide/effect",
  },
  {
    slug: "/guide/middleware",
    title: "Middleware",
    description:
      "リクエストの前後処理とサービスの提供を、Routes と Server Function のスコープに結び付けます。",
    section: "Guides",
    headings: [
      {
        id: "view",
        title: "Middleware を持つ定義を派生させる",
      },
      {
        id: "routes",
        title: "Routes でスコープを有効にする",
      },
      {
        id: "actions",
        title: "Server Function でサービスを使う",
      },
      {
        id: "order",
        title: "実行順序と応答の短絡",
      },
      {
        id: "reach",
        title: "スコープと HTTP 全体の使い分け",
      },
    ],
    source: "/guide/middleware",
  },
  {
    slug: "/guide/http",
    title: "ユーザー定義 HTTP",
    description:
      "Page と同じアプリケーション Layer に Effect HTTP のルートとグローバル Middleware を登録します。",
    section: "Guides",
    headings: [
      {
        id: "router",
        title: "HttpRouter にルートを登録する",
      },
      {
        id: "services",
        title: "Page と HTTP でサービスを共有する",
      },
      {
        id: "global",
        title: "グローバル Middleware を登録する",
      },
      {
        id: "boundary",
        title: "Fetch の境界とリソースの生存期間",
      },
    ],
    source: "/guide/http",
  },
  {
    slug: "/guide/testing",
    title: "アプリケーションのテスト",
    description: "アプリケーションの処理、ページ表示、ユーザー操作を検証します。",
    section: "Guides",
    headings: [
      {
        id: "services",
        title: "アプリケーションの処理",
      },
      {
        id: "pages",
        title: "ページとユーザー操作",
      },
      {
        id: "production",
        title: "ビルド済みアプリケーションの受け入れ確認",
      },
      {
        id: "tools",
        title: "テストツール",
      },
    ],
    source: "/guide/testing",
  },
  {
    slug: "/guide/markdown",
    title: "Markdown で記事を書く",
    description: "Vite collection と標準 Comark renderer で記事と相対リンクを扱います。",
    section: "Guides",
    headings: [
      {
        id: "setup",
        title: "Markdown を選ぶ",
      },
      {
        id: "collection",
        title: "Vite の collection",
      },
      {
        id: "render",
        title: "Page の Effect で描画する",
      },
      {
        id: "authoring",
        title: "見出し・コード・スタイル",
      },
    ],
    source: "/guide/markdown",
  },
  {
    slug: "/guide/styling",
    title: "スタイリング",
    description: "Tailwind の自動 CSS 接続と記事の Typography を設定します。",
    section: "Guides",
    headings: [
      {
        id: "setup",
        title: "Tailwind の統合",
      },
      {
        id: "stylesheet",
        title: "独自 stylesheet と記事の Typography",
      },
      {
        id: "scope",
        title: "テーマとレイアウト",
      },
    ],
    source: "/guide/styling",
  },
  {
    slug: "/advanced",
    title: "Advanced",
    description:
      "リクエストの寿命、画面遷移、更新の競合、ビルド済みアプリケーションの実行を理解します。",
    section: "Guides",
    headings: [
      {
        id: "chapters",
        title: "実行時の契約を読む",
      },
    ],
    source: "/advanced",
    group: "実行時の契約",
  },
  {
    slug: "/advanced/request-runtime-and-lifetimes",
    title: "リクエスト runtime と寿命",
    description:
      "アプリケーション定義と、リクエストごとに構築されるサービスの寿命を分けて考えます。",
    section: "Guides",
    headings: [
      {
        id: "request-layer",
        title: "Layer はリクエストごとに構築する",
      },
      {
        id: "render-scope",
        title: "レンダーを所有する Scope",
      },
      {
        id: "response-lifetime",
        title: "Response を返した後も続く寿命",
      },
      {
        id: "resource-design",
        title: "アプリケーション側の設計",
      },
    ],
    source: "/advanced/request-runtime-and-lifetimes",
    group: "実行時の契約",
  },
  {
    slug: "/advanced/client-navigation",
    title: "クライアントナビゲーション",
    description: "Navigation API の commit と Flight の完了を分け、履歴と画面の寿命を理解します。",
    section: "Guides",
    headings: [
      {
        id: "native-navigation",
        title: "ブラウザーのナビゲーションを使う",
      },
      {
        id: "commit-and-stream",
        title: "最初の commit とストリーム完了",
      },
      {
        id: "history-cache",
        title: "履歴キャッシュとリダイレクト",
      },
      {
        id: "transition-scope",
        title: "ページ遷移のアニメーション",
      },
    ],
    source: "/advanced/client-navigation",
    group: "実行時の契約",
  },
  {
    slug: "/advanced/server-function-execution-and-refresh",
    title: "Server Function の実行と更新",
    description: "サーバー側の処理結果とルート更新を分離し、並行実行時の反映条件を確認します。",
    section: "Guides",
    headings: [
      {
        id: "execution",
        title: "同じリクエスト内で実行して再レンダーする",
      },
      {
        id: "result-and-refresh",
        title: "戻り値と画面更新は別に完了する",
      },
      {
        id: "concurrency",
        title: "並行呼び出しと履歴の競合",
      },
      {
        id: "input-boundary",
        title: "入力と認可の境界",
      },
    ],
    source: "/advanced/server-function-execution-and-refresh",
    group: "実行時の契約",
  },
  {
    slug: "/api-reference",
    title: "API reference",
    description:
      "Effront の公開エントリーポイントと、アプリケーション・Fetch・ビルド API の索引です。",
    section: "API reference",
    headings: [
      {
        id: "versions",
        title: "バージョンと依存関係",
      },
      {
        id: "exports",
        title: "公開エントリーポイント",
      },
      {
        id: "index",
        title: "API 索引",
      },
    ],
    source: "/api-reference",
  },
  {
    slug: "/api-reference/application",
    title: "Application",
    description: "Application.effront で作る identity と、make に渡すルート・サービスの契約です。",
    section: "API reference",
    headings: [
      {
        id: "identity",
        title: "Application.effront",
      },
      {
        id: "make",
        title: "make",
      },
      {
        id: "example",
        title: "最小定義",
      },
    ],
    source: "/api-reference/application",
  },
  {
    slug: "/api-reference/components",
    title: "Component・Page・Layout・Loading",
    description:
      "描画ファクトリーの render、Page の params Schema、Loading の同期契約を確認します。",
    section: "API reference",
    headings: [
      {
        id: "render",
        title: "描画 API",
      },
      {
        id: "params",
        title: "Page の params",
      },
      {
        id: "view-transition",
        title: "PageViewTransition",
      },
      {
        id: "loading",
        title: "Layout と Loading",
      },
    ],
    source: "/api-reference/components",
  },
  {
    slug: "/api-reference/routing",
    title: "Routes・Middleware",
    description:
      "Routes の不変ビルダー、パス制約、Middleware が追加するサービスと実行スコープです。",
    section: "API reference",
    headings: [
      {
        id: "routes",
        title: "Routes",
      },
      {
        id: "paths",
        title: "パスの契約",
      },
      {
        id: "middleware",
        title: "Middleware と withMiddleware",
      },
    ],
    source: "/api-reference/routing",
  },
  {
    slug: "/api-reference/server-functions",
    title: "ServerFn",
    description:
      "ServerFn.make の input と handler、および Encoded / Type に基づく引数の対応です。",
    section: "API reference",
    headings: [
      {
        id: "make",
        title: "ServerFn.make",
      },
      {
        id: "arguments",
        title: "引数の対応",
      },
      {
        id: "execution",
        title: "実行境界",
      },
    ],
    source: "/api-reference/server-functions",
  },
  {
    slug: "/api-reference/workers",
    title: "Fetch・Workers context",
    description:
      "createFetchHandler と、コアおよび Cloudflare のリクエストローカル reader を参照します。",
    section: "API reference",
    headings: [
      {
        id: "fetch",
        title: "createFetchHandler",
      },
      {
        id: "context",
        title: "WorkersRequestContext",
      },
      {
        id: "readers",
        title: "コアの reader",
      },
      {
        id: "cloudflare",
        title: "Cloudflare の reader",
      },
    ],
    source: "/api-reference/workers",
  },
  {
    slug: "/api-reference/vite",
    title: "Vite・Cloudflare plugins",
    description: "effront と effrontCloudflare の公開オプション、既定エントリー、環境構成です。",
    section: "API reference",
    headings: [
      {
        id: "effront",
        title: "@effront/vite",
      },
      {
        id: "cloudflare",
        title: "@effront/cloudflare",
      },
      {
        id: "configuration",
        title: "組み合わせ方",
      },
    ],
    source: "/api-reference/vite",
  },
  {
    slug: "/api-reference/http",
    title: "Native HTTP",
    description: "toHttpEffect、makeHttpEffect と request Scope の契約です。",
    section: "API reference",
    headings: [
      {
        id: "handler",
        title: "toHttpEffect",
      },
      {
        id: "capture",
        title: "makeHttpEffect",
      },
      {
        id: "fetch",
        title: "Fetch との使い分け",
      },
    ],
    source: "/api-reference/http",
  },
  {
    slug: "/api-reference/server",
    title: "Node.js / Bun server",
    description: "serve、withAssets、effrontServer の契約です。",
    section: "API reference",
    headings: [
      {
        id: "serve",
        title: "serve",
      },
      {
        id: "assets",
        title: "withAssets",
      },
      {
        id: "vite",
        title: "effrontServer",
      },
    ],
    source: "/api-reference/server",
  },
  {
    slug: "/api-reference/markdown",
    title: "Markdown API",
    description: "collection、参照解決、parse と標準 renderer の契約です。",
    section: "API reference",
    headings: [
      {
        id: "collection",
        title: "createMarkdownCollection",
      },
      {
        id: "references",
        title: "参照の解決",
      },
      {
        id: "parse",
        title: "parseMarkdown と renderer",
      },
    ],
    source: "/api-reference/markdown",
  },
  {
    slug: "/api-reference/alchemy",
    title: "Alchemy API",
    description: "native Worker と構築時の能力を接続する API です。",
    section: "API reference",
    headings: [
      {
        id: "http",
        title: "Native HTTP への接続",
      },
      {
        id: "vite",
        title: "effrontAlchemy",
      },
    ],
    source: "/api-reference/alchemy",
  },
  {
    slug: "/api-reference/tailwind",
    title: "Tailwind API",
    description: "effrontTailwind と stylesheet オプションの契約です。",
    section: "API reference",
    headings: [
      {
        id: "plugin",
        title: "effrontTailwind",
      },
      {
        id: "stylesheet",
        title: "stylesheet",
      },
    ],
    source: "/api-reference/tailwind",
  },
] as const satisfies readonly (Omit<DocPage, "content"> & { readonly source: string })[];
