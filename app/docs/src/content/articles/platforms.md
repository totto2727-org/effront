## ホスト統合の役割 {#architecture}

Effront のコアは native Effect HTTP と互換用の Web Fetch 境界を提供します。
`@effront/vite` が RSC・SSR・ブラウザーのグラフを構成し、ホストアダプターが実行環境へ接続します。
React の `react-server` 条件は RSC グラフだけに適用します。
ページ定義とサービスは共通にし、起動方法とホスト固有の能力を境界で選びます。

## 対応状況 {#support}

| 実行環境                                        | 統合                  | 選ぶ場面                                                |
| ----------------------------------------------- | --------------------- | ------------------------------------------------------- |
| [Cloudflare Workers](./platforms/cloudflare.md) | `@effront/cloudflare` | Vite と Wrangler で standalone Worker を開発する        |
| [Alchemy + Cloudflare](./platforms/alchemy.md)  | `@effront/alchemy`    | Worker と binding を Alchemy の構築 Effect で管理する   |
| [Node.js / Bun](./platforms/node-bun.md)        | `@effront/server`     | native Effect HTTP でリスナーと静的アセットをホストする |

Workers では RSC と SSR を workerd で実行します。
Node.js / Bun ではそれぞれのホストで独立した RSC・SSR グラフを実行します。
Bun 構成でも Vite の dev / preview は Node 互換のミドルウェアです。
Vercel と AWS の専用アダプターは提供していません。

最初は [はじめる](./guide/getting-started.md) の共通アプリケーション定義と standalone Workers の手順を読み、必要に応じて Node.js / Bun の手順を選んでください。
Alchemy CLI はローカル利用でも profile の準備が必要です。
このサイト自身は Alchemy を使っていますが、すべてのアプリケーションに Alchemy が必要なわけではありません。
