import type { ArticleMetadata } from "#docs/content/article-metadata.ts";

export const onboardingArticles = [
  {
    description:
      "サーバーでのページ描画、型付きサービス、Server Functions を備えた、Effect ベースの React メタフレームワーク。",
    headings: [
      { id: "boundaries", title: "ページを表示する" },
      { id: "overview", title: "データとユーザー操作を扱う" },
      { id: "next", title: "次のガイドを選ぶ" },
    ],
    section: "Getting started",
    slug: "/",
    source: "/index",
    title: "Effront",
  },
  {
    description: "Hello, world を表示する、はじめての Effront アプリケーション。",
    headings: [
      { id: "setup", title: "サンプルを起動する" },
      { id: "application", title: "サンプルの構成を見る" },
      { id: "run", title: "表示内容を変える" },
    ],
    section: "Getting started",
    slug: "/guide/getting-started",
    source: "/guide/getting-started",
    title: "はじめる",
  },
  {
    description: "デプロイ先に合わせて、開発環境と本番環境をセットアップします。",
    headings: [{ id: "support", title: "ホスティング方式を選ぶ" }],
    section: "Platforms",
    slug: "/platforms",
    source: "/platforms",
    title: "デプロイ先",
  },
  {
    description: "Cloudflare Workers 向けの開発環境・本番環境セットアップガイド。",
    headings: [
      { id: "setup", title: "サンプルを起動する" },
      { id: "vite", title: "Worker の設定を確認する" },
      { id: "local", title: "ビルド済みの Worker を Wrangler で実行する" },
      { id: "context", title: "Worker のバインディングとリクエスト情報を読む" },
      { id: "alchemy", title: "Alchemy でリソースを管理する" },
    ],
    section: "Platforms",
    slug: "/platforms/cloudflare",
    source: "/platforms/cloudflare",
    title: "Cloudflare Workers",
  },
  {
    description: "Node.js サンプルを開発モードで動かし、ビルドして本番サーバーの起動を確認します。",
    headings: [
      { id: "setup", title: "サンプルを起動する" },
      { id: "entries", title: "アプリケーションとサーバーのファイルを確認する" },
      { id: "assets", title: "本番ビルドをローカルで確認する" },
      { id: "node", title: "Node.js サーバーを起動する" },
    ],
    section: "Platforms",
    slug: "/platforms/node",
    source: "/platforms/node",
    title: "Node.js",
  },
  {
    description: "Bun サンプルを開発モードで動かし、ビルドして本番サーバーの起動を確認します。",
    headings: [
      { id: "setup", title: "サンプルを起動する" },
      { id: "entries", title: "アプリケーションとサーバーのファイルを確認する" },
      { id: "assets", title: "本番ビルドをローカルで確認する" },
      { id: "bun", title: "Bun サーバーを起動する" },
    ],
    section: "Platforms",
    slug: "/platforms/bun",
    source: "/platforms/bun",
    title: "Bun",
  },
  {
    description: "Alchemy を使った Cloudflare Workers 向けの開発環境セットアップガイド。",
    headings: [
      { id: "setup", title: "サンプルを準備する" },
      { id: "worker", title: "アプリケーションとリソースの定義を確認する" },
      { id: "stack", title: "開発サーバーを起動する" },
      { id: "capabilities", title: "必要に応じてリソースを追加する" },
    ],
    section: "Platforms",
    slug: "/platforms/alchemy",
    source: "/platforms/alchemy",
    title: "Alchemy と Cloudflare",
  },
] as const satisfies Readonly<ArticleMetadata[]>;
