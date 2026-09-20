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
      {
        id: "boundaries",
        title: "ページを表示する",
      },
      {
        id: "overview",
        title: "データとユーザー操作を扱う",
      },
      {
        id: "next",
        title: "次のガイドを選ぶ",
      },
    ],
    source: "/index",
  },
  {
    slug: "/guide/getting-started",
    title: "はじめる",
    description: "トップページを作り、Cloudflare Workers でローカル起動します。",
    section: "Getting started",
    headings: [
      {
        id: "setup",
        title: "プロジェクトを準備する",
      },
      {
        id: "application",
        title: "トップページを定義する",
      },
      {
        id: "files",
        title: "アプリケーションを Workers に接続する",
      },
      {
        id: "run",
        title: "表示を確認して書き換える",
      },
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
      {
        id: "support",
        title: "ホスティング方法を選ぶ",
      },
      {
        id: "architecture",
        title: "ローカル開発を設定する",
      },
      {
        id: "build-startup",
        title: "本番の起動とアセットを準備する",
      },
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
      {
        id: "setup",
        title: "アプリケーションを Worker に接続する",
      },
      {
        id: "vite",
        title: "Worker とビルドを設定する",
      },
      {
        id: "local",
        title: "アプリケーションを起動して確認する",
      },
      {
        id: "context",
        title: "アプリケーションの設定値を追加する",
      },
      {
        id: "secrets",
        title: "認証情報をサーバー側に留める",
      },
      {
        id: "alchemy",
        title: "Alchemy を使う構成を選ぶ",
      },
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
      {
        id: "setup",
        title: "サーバー統合をインストールする",
      },
      {
        id: "entries",
        title: "Vite でアプリケーションを確認する",
      },
      {
        id: "assets",
        title: "本番用アセットの配置を準備する",
      },
      {
        id: "node",
        title: "Node.js サーバーをビルドして起動する",
      },
      {
        id: "bun",
        title: "本番用サーバーに Bun を使う",
      },
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
      {
        id: "setup",
        title: "既存の Effront アプリケーションを準備する",
      },
      {
        id: "worker",
        title: "Alchemy で動かすアプリケーションを定義する",
      },
      {
        id: "stack",
        title: "開発環境を起動してページを開く",
      },
      {
        id: "capabilities",
        title: "バインディングを追加する",
      },
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
      {
        id: "pages",
        title: "URL からページを開けるようにする",
      },
      {
        id: "matching",
        title: "URL のパターンと受け付ける値を決める",
      },
      {
        id: "mount",
        title: "共通の UI を持つページをまとめる",
      },
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
      {
        id: "boundary",
        title: "処理をどこに置くか決める",
      },
      {
        id: "server",
        title: "再利用するサーバー側の表示を切り出す",
      },
      {
        id: "client-boundary",
        title: "Page を移さずに操作できる UI を加える",
      },
    ],
    source: "/guide/components",
  },
  {
    slug: "/guide/server-functions",
    title: "Server Function",
    description: "入力を検証し、サーバーのサービスを呼び出して結果を表示するフォームを作ります。",
    section: "Guides",
    headings: [
      {
        id: "identity",
        title: "action で使うサービスを用意する",
      },
      {
        id: "state",
        title: "挨拶文をフォームに返す",
      },
      {
        id: "application",
        title: "送信から結果表示まで動かす",
      },
      {
        id: "forms",
        title: "戻り値が不要なら action に直接渡す",
      },
      {
        id: "input",
        title: "FormData の代わりにオブジェクトを受け取る",
      },
      {
        id: "refresh",
        title: "更新と失敗の表示を決める",
      },
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
      {
        id: "service",
        title: "Page が使うサービスを接続する",
      },
      {
        id: "lifetime",
        title: "リクエストのスコープを保って利用範囲を広げる",
      },
      {
        id: "missing-services",
        title: "サービスの接続に関する型エラーを解消する",
      },
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
      {
        id: "reach",
        title: "対象のリクエストを選ぶ",
      },
      {
        id: "view",
        title: "後続の処理に渡すサービスを用意する",
      },
      {
        id: "routes",
        title: "サービスの値をページに表示する",
      },
      {
        id: "order",
        title: "ハンドラーの実行前にリクエストを止める",
      },
      {
        id: "actions",
        title: "フォーム送信にも処理を適用する",
      },
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
      {
        id: "router",
        title: "JSON エンドポイントを定義する",
      },
      {
        id: "services",
        title: "エンドポイントを登録してリクエストを送る",
      },
      {
        id: "boundary",
        title: "サービスのリソースをリクエスト内で使う",
      },
      {
        id: "global",
        title: "Page と API の応答にヘッダーを追加する",
      },
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
      {
        id: "setup",
        title: "最初の記事を用意する",
      },
      {
        id: "collection",
        title: "Page から記事を取得できるようにする",
      },
      {
        id: "render",
        title: "記事を表示し、関連ページをつなぐ",
      },
      {
        id: "authoring",
        title: "標準設定を使い、必要に応じて解析を変える",
      },
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
      {
        id: "setup",
        title: "Tailwind のクラスを使う",
      },
      {
        id: "stylesheet",
        title: "テーマに共通の値を定義する",
      },
      {
        id: "scope",
        title: "プラグインでスタイルを追加する",
      },
    ],
    source: "/guide/styling",
  },
  {
    slug: "/advanced",
    title: "実行時の動作",
    description:
      "非同期処理を踏まえて、ユーザーへの結果表示、画面遷移、リソースの解放を設計します。",
    section: "Guides",
    headings: [
      {
        id: "chapters",
        title: "非同期処理を踏まえて設計する",
      },
    ],
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
      {
        id: "response-lifetime",
        title: "レスポンス本文の終了に合わせて解放する",
      },
      {
        id: "request-layer",
        title: "アプリケーションの Layer に取得と解放を登録する",
      },
      {
        id: "render-scope",
        title: "Page や Server Function でリクエストのサービスを使う",
      },
      {
        id: "resource-design",
        title: "リソースを早く閉じずにレスポンス処理をカスタマイズする",
      },
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
      {
        id: "native-navigation",
        title: "共通の操作部品を Page の外に置く",
      },
      {
        id: "transition-scope",
        title: "切り替わる内容のアニメーションを選ぶ",
      },
      {
        id: "commit-and-stream",
        title: "遷移後に届く内容の表示に備える",
      },
      {
        id: "history-cache",
        title: "戻る・進むとページ全体の読み込みを考慮する",
      },
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
      {
        id: "execution",
        title: "保存から画面更新までの流れを組み立てる",
      },
      {
        id: "input-boundary",
        title: "フォームを公開する前に書き込みを保護する",
      },
      {
        id: "result-and-refresh",
        title: "ページ全体の更新を待たずに結果を伝える",
      },
      {
        id: "concurrency",
        title: "繰り返しの保存を安全に扱う",
      },
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
      {
        id: "pages",
        title: "一連のユーザー操作を起点にする",
      },
      {
        id: "services",
        title: "業務ルールをブラウザーから切り離して検証する",
      },
      {
        id: "production",
        title: "公開用ビルドを対象の実行環境で確かめる",
      },
      {
        id: "tools",
        title: "繰り返し実行できるテストにする",
      },
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
      {
        id: "exports",
        title: "公開 API の一覧",
      },
      {
        id: "index",
        title: "アプリケーションファクトリーの索引",
      },
      {
        id: "versions",
        title: "依存バージョン一覧",
      },
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
      {
        id: "example",
        title: "ルートが一つのアプリケーション",
      },
      {
        id: "identity",
        title: "Application.effront: 共通のファクトリーを作る",
      },
      {
        id: "make",
        title: "EFFRONT.make: ルートとサービスを渡す",
      },
      {
        id: "middleware",
        title: "EFFRONT.withMiddleware: 対象の定義にミドルウェアを追加する",
      },
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
      {
        id: "render",
        title: "描画ファクトリーを選ぶ",
      },
      {
        id: "loading",
        title: "共有 Layout と読み込み中の UI を追加する",
      },
      {
        id: "params",
        title: "Page で使う URL パラメーターをデコードする",
      },
      {
        id: "view-transition",
        title: "ページ遷移を設定する",
      },
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
      {
        id: "routes",
        title: "ルートの登録と合成",
      },
      {
        id: "paths",
        title: "パスと Page パラメーターの対応",
      },
      {
        id: "middleware",
        title: "ルートの集合に Middleware を適用する",
      },
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
      {
        id: "make",
        title: "呼び出し可能な処理を定義する",
      },
      {
        id: "arguments",
        title: "呼び出し側に合わせて引数を定義する",
      },
      {
        id: "execution",
        title: "操作を保護し、処理を再利用する",
      },
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
      {
        id: "fetch",
        title: "createFetchHandler でアプリケーションを接続する",
      },
      {
        id: "readers",
        title: "必要な値に応じてコアの reader を選ぶ",
      },
      {
        id: "cloudflare",
        title: "Env の型を指定して Cloudflare の reader を使う",
      },
      {
        id: "context",
        title: "共有する WorkersRequestContext を確認する",
      },
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
      {
        id: "effront",
        title: "Vite に Effront を登録する",
      },
      {
        id: "configuration",
        title: "エントリーファイルを指定する",
      },
      {
        id: "cloudflare",
        title: "Cloudflare Workers を設定する",
      },
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
      {
        id: "fetch",
        title: "ホストとの接続方法を選ぶ",
      },
      {
        id: "handler",
        title: "toHttpEffect でリクエストを処理する",
      },
      {
        id: "capture",
        title: "makeHttpEffect でホストのサービスを捕捉する",
      },
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
      {
        id: "vite",
        title: "Vite のエントリー: effrontServer",
      },
      {
        id: "serve",
        title: "本番用リスナー: serve",
      },
      {
        id: "assets",
        title: "静的ファイル: withAssets",
      },
    ],
    source: "/api-reference/server",
  },
  {
    slug: "/api-reference/markdown",
    title: "Markdown API",
    description: "文書を取得し、Markdown の解析を設定して、記事やアセットへのリンクを解決します。",
    section: "API reference",
    headings: [
      {
        id: "collection",
        title: "createMarkdownCollection: 文書の取得",
      },
      {
        id: "parse",
        title: "parseMarkdown: 解析と描画",
      },
      {
        id: "references",
        title: "リンクとアセットの解決",
      },
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
      {
        id: "http",
        title: "リクエストハンドラーを作る",
      },
      {
        id: "vite",
        title: "Worker のビルドを設定する",
      },
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
      {
        id: "plugin",
        title: "effrontTailwind で Tailwind を有効にする",
      },
      {
        id: "stylesheet",
        title: "stylesheet でカスタマイズする",
      },
    ],
    source: "/api-reference/tailwind",
  },
] as const satisfies readonly (Omit<DocPage, "content"> & { readonly source: string })[];
