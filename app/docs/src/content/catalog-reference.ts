import type { ArticleMetadata } from "#docs/content/article-metadata.ts";

export const referenceArticles = [
  {
    description:
      "公開 import パス、アプリケーションファクトリーの API、依存関係の互換性要件を調べます。",
    headings: [
      { id: "exports", title: "公開 API の一覧" },
      { id: "index", title: "アプリケーションファクトリーの索引" },
      { id: "versions", title: "依存関係の互換性" },
    ],
    section: "API reference",
    slug: "/api-reference",
    source: "/api-reference",
    title: "API リファレンス",
  },
  {
    description: "Effront アプリケーションとサービスの定義に使う API のリファレンス。",
    headings: [
      { id: "example", title: "アプリケーション定義の例" },
      { id: "identity", title: "Application.effront" },
      { id: "make", title: "EFFRONT.make" },
      { id: "middleware", title: "EFFRONT.withMiddleware" },
    ],
    section: "API reference",
    slug: "/api-reference/application",
    source: "/api-reference/application",
    title: "Application",
  },
  {
    description:
      "ページ、コンポーネント、レイアウト、読み込み中の表示を定義する API のリファレンス。",
    headings: [
      { id: "render", title: "描画ファクトリー" },
      { id: "loading", title: "Layout と Loading" },
      { id: "params", title: "Page params" },
      { id: "view-transition", title: "PageViewTransition" },
    ],
    section: "API reference",
    slug: "/api-reference/components",
    source: "/api-reference/components",
    title: "Component・Page・Layout・Loading",
  },
  {
    description: "ルートの定義とリクエストのミドルウェアに関する API リファレンス。",
    headings: [
      { id: "routes", title: "Routes" },
      { id: "paths", title: "ルートパス" },
      { id: "middleware", title: "Middleware" },
    ],
    section: "API reference",
    slug: "/api-reference/routing",
    source: "/api-reference/routing",
    title: "Routes と Middleware",
  },
  {
    description: "React から呼び出せるサーバー側の関数を定義する API のリファレンス。",
    headings: [
      { id: "make", title: "ServerFn.make" },
      { id: "arguments", title: "引数の形式" },
      { id: "execution", title: "実行上の制約" },
      { id: "request-protocol", title: "リクエストプロトコル" },
    ],
    section: "API reference",
    slug: "/api-reference/server-functions",
    source: "/api-reference/server-functions",
    title: "ServerFn",
  },
  {
    description: "Fetch ハンドラーと Workers のリクエストコンテキストを扱う API のリファレンス。",
    headings: [
      { id: "fetch", title: "createFetchHandler" },
      { id: "readers", title: "コアの Context 読み取り関数" },
      { id: "cloudflare", title: "Cloudflare の Context 読み取り関数" },
      { id: "context", title: "WorkersRequestContext" },
    ],
    section: "API reference",
    slug: "/api-reference/workers",
    source: "/api-reference/workers",
    title: "Fetch ハンドラーと Workers コンテキスト",
  },
  {
    description: "Effront の Vite 連携と Cloudflare Workers 連携に関する設定リファレンス。",
    headings: [
      { id: "effront", title: "effront" },
      { id: "configuration", title: "EffrontViteOptions" },
      { id: "cloudflare", title: "effrontCloudflare" },
    ],
    section: "API reference",
    slug: "/api-reference/vite",
    source: "/api-reference/vite",
    title: "Vite と Cloudflare のプラグイン",
  },
  {
    description: "Effront アプリケーションを Effect HTTP サーバーに接続する API のリファレンス。",
    headings: [
      { id: "fetch", title: "HTTP の接続 API" },
      { id: "handler", title: "toHttpEffect" },
      { id: "capture", title: "makeHttpEffect" },
    ],
    section: "API reference",
    slug: "/api-reference/http",
    source: "/api-reference/http",
    title: "Effect HTTP ハンドラー",
  },
  {
    description: "Node.js と Bun で Effront アプリケーションを実行する API のリファレンス。",
    headings: [
      { id: "vite", title: "effrontServer" },
      { id: "serve", title: "serve" },
      { id: "assets", title: "withAssets" },
    ],
    section: "API reference",
    slug: "/api-reference/server",
    source: "/api-reference/server",
    title: "Node.js と Bun のサーバー API",
  },
  {
    description: "Markdown コレクションとパーサーの API リファレンス。",
    headings: [
      { id: "collection", title: "createMarkdownCollection" },
      { id: "parse", title: "parseMarkdown" },
      { id: "rendering", title: "Markdown のレンダリング" },
      { id: "references", title: "リンク、アセット、MarkdownError" },
    ],
    section: "API reference",
    slug: "/api-reference/markdown",
    source: "/api-reference/markdown",
    title: "Markdown API",
  },
  {
    description: "Effront アプリケーションを Alchemy の Worker に接続する API のリファレンス。",
    headings: [
      { id: "http", title: "HTTP ハンドラー" },
      { id: "vite", title: "effrontAlchemy" },
    ],
    section: "API reference",
    slug: "/api-reference/alchemy",
    source: "/api-reference/alchemy",
    title: "Alchemy API",
  },
  {
    description: "Effront の Tailwind CSS 連携に関する設定リファレンス。",
    headings: [
      { id: "plugin", title: "effrontTailwind" },
      { id: "stylesheet", title: "stylesheet" },
    ],
    section: "API reference",
    slug: "/api-reference/tailwind",
    source: "/api-reference/tailwind",
    title: "Tailwind API",
  },
] as const satisfies Readonly<ArticleMetadata[]>;
