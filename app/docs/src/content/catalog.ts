import type { DocPage } from "./types";

// Stable routes and heading IDs are independent of Markdown file naming.
export const articleCatalog = [
  {
    slug: "/",
    title: "Effront",
    description:
      "サーバー側のデータとユーザー操作を扱う React ページを作り、次の作業に合うガイドを選びます。",
    section: "Getting started",
    headings: [
      { id: "boundaries", title: "ページを表示する" },
      { id: "overview", title: "データとユーザー操作を扱う" },
      { id: "next", title: "次のガイドを選ぶ" },
    ],
    source: "/index",
  },
  {
    slug: "/guide/getting-started",
    title: "はじめる",
    description: "トップページを作り、選んだ実行環境でローカル起動します。",
    section: "Getting started",
    headings: [
      { id: "setup", title: "プロジェクトを準備する" },
      { id: "application", title: "トップページを定義する" },
      { id: "files", title: "アプリケーションを実行環境に接続する" },
      { id: "run", title: "表示を確認して書き換える" },
    ],
    source: "/guide/getting-started",
  },
  {
    slug: "/platforms",
    title: "デプロイ先",
    description:
      "ホスティング方法を選んでローカル開発を始め、Wrangler または Node.js・Bun の本番向け確認手順を探します。",
    section: "Platforms",
    headings: [
      { id: "support", title: "ホスティング方法を選ぶ" },
      { id: "architecture", title: "ローカル開発を設定する" },
      { id: "build-startup", title: "本番の起動とアセットを準備する" },
    ],
    source: "/platforms",
  },
  {
    slug: "/platforms/cloudflare",
    title: "Cloudflare Workers",
    description:
      "既存のアプリケーションを Cloudflare Workers に接続し、アセットと環境値を設定してローカルで確認します。",
    section: "Platforms",
    headings: [
      { id: "setup", title: "アプリケーションを Worker に接続する" },
      { id: "vite", title: "Worker とビルドを設定する" },
      { id: "local", title: "アプリケーションを起動して確認する" },
      { id: "context", title: "アプリケーションの設定値を追加する" },
      { id: "secrets", title: "認証情報をサーバー側に留める" },
      { id: "alchemy", title: "Alchemy を使う構成を選ぶ" },
    ],
    source: "/platforms/cloudflare",
  },
  {
    slug: "/platforms/node-bun",
    title: "Node.js と Bun",
    description:
      "Vite で開発し、ページとブラウザー用アセットを配信する Node.js または Bun サーバーをビルドして起動します。",
    section: "Platforms",
    headings: [
      { id: "setup", title: "サーバー統合をインストールする" },
      { id: "entries", title: "Vite でアプリケーションを確認する" },
      { id: "assets", title: "本番用アセットの配置を準備する" },
      { id: "node", title: "Node.js サーバーをビルドして起動する" },
      { id: "bun", title: "本番用サーバーに Bun を使う" },
    ],
    source: "/platforms/node-bun",
  },
  {
    slug: "/platforms/alchemy",
    title: "Alchemy と Cloudflare",
    description:
      "既存の Effront アプリケーションを Alchemy からローカルで動かし、必要に応じて KV によるデータ保存を追加します。",
    section: "Platforms",
    headings: [
      { id: "setup", title: "既存の Effront アプリケーションを準備する" },
      { id: "worker", title: "Alchemy で動かすアプリケーションを定義する" },
      { id: "stack", title: "開発環境を起動してページを開く" },
      { id: "capabilities", title: "バインディングを追加する" },
    ],
    source: "/platforms/alchemy",
  },
  {
    slug: "/guide/routes",
    title: "ページ、レイアウト、ルート",
    description:
      "URL をページに結び付け、ルートパラメーターを検証し、共通のレイアウトと読み込み中の UI を持つページをまとめます。",
    section: "Guides",
    headings: [
      { id: "pages", title: "Page を登録する" },
      { id: "matching", title: "URL パラメーターを受け取る" },
      { id: "mount", title: "セクションの Layout と読み込み表示を追加する" },
    ],
    source: "/guide/routes",
  },
  {
    slug: "/guide/components",
    title: "Server Component と Client Component",
    description:
      "データへのアクセスをサーバー側に保ちながら、再利用できる UI と操作用の部品を追加します。",
    section: "Guides",
    headings: [
      { id: "boundary", title: "処理に合うコンポーネントを選ぶ" },
      { id: "server", title: "サーバー側の表示を再利用する" },
      { id: "client-boundary", title: "操作できる UI を加える" },
    ],
    source: "/guide/components",
  },
  {
    slug: "/guide/server-functions",
    title: "Server Function",
    description:
      "検証したフォームデータを Server Function に送信し、useActionState で結果を表示します。",
    section: "Guides",
    headings: [
      { id: "identity", title: "アプリケーション定義を共有する" },
      { id: "state", title: "フォームの状態を返す" },
      { id: "application", title: "フォームを表示して送信する" },
      { id: "forms", title: "状態を返さずに送信する" },
      { id: "input", title: "オブジェクトを引数に取る" },
      { id: "refresh", title: "更新と失敗を扱う" },
    ],
    source: "/guide/server-functions",
  },
  {
    slug: "/guide/effect",
    title: "アプリケーションサービス",
    description:
      "Page に型付きサービスを提供し、その実装を選んでリクエスト単位のリソースを管理します。",
    section: "Guides",
    headings: [
      { id: "service", title: "Page でサービスを使う" },
      { id: "lifetime", title: "サービスのスコープを選ぶ" },
      { id: "missing-services", title: "サービス不足の型エラーを直す" },
    ],
    source: "/guide/effect",
  },
  {
    slug: "/guide/middleware",
    title: "Middleware",
    description:
      "対象のページと Server Function に対し、リクエストのデータを用意して必要なチェックを行います。",
    section: "Guides",
    headings: [
      { id: "reach", title: "適用するリクエストを選ぶ" },
      { id: "view", title: "リクエストのサービスを提供する" },
      { id: "routes", title: "Page にサービスを適用する" },
      { id: "order", title: "後続の処理を止めて応答する" },
      { id: "actions", title: "Server Function にチェックを適用する" },
    ],
    source: "/guide/middleware",
  },
  {
    slug: "/guide/http",
    title: "HTTP エンドポイント",
    description:
      "Page とサービスを共有する JSON エンドポイントを追加し、Page と API の応答に共通のヘッダーを適用します。",
    section: "Guides",
    headings: [
      { id: "router", title: "JSON エンドポイントを定義する" },
      { id: "services", title: "ルートとサービスを登録する" },
      { id: "boundary", title: "リソースをリクエスト内で使う" },
      { id: "global", title: "共通のレスポンスヘッダーを追加する" },
    ],
    source: "/guide/http",
  },
  {
    slug: "/guide/markdown",
    title: "Markdown でページを書く",
    description:
      "指定した URL で Markdown 記事を公開し、関連する記事やアセットをつなぎ、必要に応じて解析をカスタマイズします。",
    section: "Guides",
    headings: [
      { id: "setup", title: "記事を追加する" },
      { id: "collection", title: "コレクションを読み込む" },
      { id: "render", title: "記事を URL で表示する" },
      { id: "authoring", title: "解析や表示を変更する" },
    ],
    source: "/guide/markdown",
  },
  {
    slug: "/guide/styling",
    title: "Tailwind によるスタイリング",
    description:
      "Tailwind のユーティリティから始め、デザインに応じて共通のテーマ値やプラグインを追加します。",
    section: "Guides",
    headings: [
      { id: "setup", title: "Tailwind のユーティリティを使う" },
      { id: "stylesheet", title: "スタイルシートでテーマを定義する" },
      { id: "scope", title: "必要に応じて Tailwind プラグインを追加する" },
    ],
    source: "/guide/styling",
  },
  {
    slug: "/advanced",
    title: "実行時の動作",
    description:
      "非同期処理を踏まえて、ユーザーへの結果表示、画面遷移、リソースの解放を設計します。",
    section: "Guides",
    headings: [{ id: "chapters", title: "実行時の契約" }],
    source: "/advanced",
    group: "実行時の契約",
  },
  {
    slug: "/advanced/request-runtime-and-lifetimes",
    title: "リクエストとリソースの生存期間",
    description:
      "描画やストリーミング中にリクエストのリソースを利用できる状態に保ち、応答の完了や中断に合わせて解放します。",
    section: "Guides",
    headings: [
      { id: "response-lifetime", title: "Response の処理はハンドラーの後も続く" },
      { id: "request-layer", title: "アプリケーションのサービスはリクエストごとに構築される" },
      { id: "render-scope", title: "遅れて始まるレンダーも同じサービスを使う" },
      { id: "resource-design", title: "リクエスト所有とホスト所有のリソース" },
    ],
    source: "/advanced/request-runtime-and-lifetimes",
    group: "実行時の契約",
  },
  {
    slug: "/advanced/client-navigation",
    title: "クライアントナビゲーション",
    description:
      "クライアントナビゲーションに対応した環境で共通 UI の状態を保ち、ページのアニメーション、読み込み、履歴操作を設計します。",
    section: "Guides",
    headings: [
      { id: "native-navigation", title: "ページ間で保持される状態" },
      { id: "transition-scope", title: "Page のアニメーションと共有 Layout" },
      { id: "commit-and-stream", title: "画面表示、URL、ストリームの完了" },
      { id: "history-cache", title: "履歴の再利用とドキュメントの読み込み" },
    ],
    source: "/advanced/client-navigation",
    group: "実行時の契約",
  },
  {
    slug: "/advanced/server-function-execution-and-refresh",
    title: "Server Function の結果と画面更新",
    description:
      "保存結果を表示するタイミングを決め、サーバーの書き込みを保護し、重なった送信やページ更新を扱います。",
    section: "Guides",
    headings: [
      { id: "execution", title: "一度の呼び出しで結果と更新後のページを返す" },
      { id: "input-boundary", title: "入力の検証と認可は別の役割" },
      { id: "result-and-refresh", title: "画面より先に関数の結果が届く" },
      { id: "concurrency", title: "画面更新の順序と書き込み順序は別" },
    ],
    source: "/advanced/server-function-execution-and-refresh",
    group: "実行時の契約",
  },
  {
    slug: "/best-practices/testing",
    title: "アプリケーションのテスト",
    description:
      "一連のユーザー操作とその業務ルールをテストし、公開用ビルドでも同じ確認を繰り返します。",
    section: "Best practices",
    headings: [
      { id: "pages", title: "保存した変更をブラウザーで確かめる" },
      { id: "services", title: "Server Function が呼び出す業務ルールをテストする" },
      { id: "production", title: "公開用の成果物を検証する" },
      { id: "tools", title: "データを分離し、起動を自動化する" },
    ],
    source: "/best-practices/testing",
  },
  {
    slug: "/api-reference",
    title: "API リファレンス",
    description:
      "公開 import パス、アプリケーションファクトリーの API、互換性のある依存バージョンを調べます。",
    section: "API reference",
    headings: [
      { id: "exports", title: "公開 API の一覧" },
      { id: "index", title: "アプリケーションファクトリーの索引" },
      { id: "versions", title: "依存バージョン一覧" },
    ],
    source: "/api-reference",
  },
  {
    slug: "/api-reference/application",
    title: "Application",
    description:
      "ページ、ルート、サービスを組み合わせてアプリケーションを作り、対象の定義を Middleware で拡張する方法を確認します。",
    section: "API reference",
    headings: [
      { id: "example", title: "アプリケーション定義の例" },
      { id: "identity", title: "Application.effront" },
      { id: "make", title: "EFFRONT.make" },
      { id: "middleware", title: "EFFRONT.withMiddleware" },
    ],
    source: "/api-reference/application",
  },
  {
    slug: "/api-reference/components",
    title: "Component・Page・Layout・Loading",
    description:
      "描画ファクトリーを選び、レイアウトと読み込み中の UI を追加し、URL パラメーターやページ遷移のオプションを確認します。",
    section: "API reference",
    headings: [
      { id: "render", title: "描画ファクトリー" },
      { id: "loading", title: "Layout と Loading" },
      { id: "params", title: "Page params" },
      { id: "view-transition", title: "PageViewTransition" },
    ],
    source: "/api-reference/components",
  },
  {
    slug: "/api-reference/routing",
    title: "Routes と Middleware",
    description:
      "ルートをまとめて組み合わせ、URL パラメーターを対応付け、そのセクションのリクエストに Middleware を適用します。",
    section: "API reference",
    headings: [
      { id: "routes", title: "Routes" },
      { id: "paths", title: "ルートパス" },
      { id: "middleware", title: "Middleware" },
    ],
    source: "/api-reference/routing",
  },
  {
    slug: "/api-reference/server-functions",
    title: "ServerFn",
    description:
      "サーバーの処理を React から呼び出せるようにする際の、入力、ハンドラーの型、認可の要件を確認します。",
    section: "API reference",
    headings: [
      { id: "make", title: "ServerFn.make" },
      { id: "arguments", title: "引数の形式" },
      { id: "execution", title: "実行上の制約" },
    ],
    source: "/api-reference/server-functions",
  },
  {
    slug: "/api-reference/workers",
    title: "Fetch ハンドラーと Workers コンテキスト",
    description:
      "Fetch エントリーを作り、アプリケーションの Effect から現在のリクエスト、環境の binding、実行コンテキストを読み取ります。",
    section: "API reference",
    headings: [
      { id: "fetch", title: "createFetchHandler" },
      { id: "readers", title: "コアの Context 読み取り関数" },
      { id: "cloudflare", title: "Cloudflare の Context 読み取り関数" },
      { id: "context", title: "WorkersRequestContext" },
    ],
    source: "/api-reference/workers",
  },
  {
    slug: "/api-reference/vite",
    title: "Vite と Cloudflare のプラグイン",
    description:
      "Vite に Effront を登録し、エントリーファイルのオプションや Cloudflare Workers の設定を調べます。",
    section: "API reference",
    headings: [
      { id: "effront", title: "effront" },
      { id: "configuration", title: "EffrontViteOptions" },
      { id: "cloudflare", title: "effrontCloudflare" },
    ],
    source: "/api-reference/vite",
  },
  {
    slug: "/api-reference/http",
    title: "Effect HTTP ハンドラー",
    description:
      "アプリケーションを Effect HTTP ホストに接続し、リクエスト処理と応答のストリーミングに必要なサービスを提供します。",
    section: "API reference",
    headings: [
      { id: "fetch", title: "HTTP の接続 API" },
      { id: "handler", title: "toHttpEffect" },
      { id: "capture", title: "makeHttpEffect" },
    ],
    source: "/api-reference/http",
  },
  {
    slug: "/api-reference/server",
    title: "Node.js と Bun のサーバー API",
    description:
      "ビルドのエントリーを設定し、本番用リスナーを起動して、Node.js または Bun で静的ファイルを配信します。",
    section: "API reference",
    headings: [
      { id: "vite", title: "effrontServer" },
      { id: "serve", title: "serve" },
      { id: "assets", title: "withAssets" },
    ],
    source: "/api-reference/server",
  },
  {
    slug: "/api-reference/markdown",
    title: "Markdown API",
    description: "文書を取得し、Markdown の解析を設定して、記事やアセットへのリンクを解決します。",
    section: "API reference",
    headings: [
      { id: "collection", title: "createMarkdownCollection" },
      { id: "parse", title: "parseMarkdown" },
      { id: "references", title: "リンク、アセット、MarkdownError" },
    ],
    source: "/api-reference/markdown",
  },
  {
    slug: "/api-reference/alchemy",
    title: "Alchemy API",
    description:
      "Alchemy Worker のハンドラーを作り、アプリケーションサービスを提供して Vite ビルドを設定します。",
    section: "API reference",
    headings: [
      { id: "http", title: "HTTP ハンドラー" },
      { id: "vite", title: "effrontAlchemy" },
    ],
    source: "/api-reference/alchemy",
  },
  {
    slug: "/api-reference/tailwind",
    title: "Tailwind API",
    description:
      "Tailwind 標準のユーティリティを有効にし、独自のテーマやプラグインには stylesheet オプションを使います。",
    section: "API reference",
    headings: [
      { id: "plugin", title: "effrontTailwind" },
      { id: "stylesheet", title: "stylesheet" },
    ],
    source: "/api-reference/tailwind",
  },
] as const satisfies readonly (Omit<DocPage, "content"> & { readonly source: string })[];
