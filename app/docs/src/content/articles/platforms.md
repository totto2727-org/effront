## ホスト統合の役割 {#architecture}

共通の `@effront/vite` と、実行環境に合うホストアダプターを組み合わせます。
ページ定義とサービスは共通にし、起動方法とホスト固有の設定を選びます。
`src/entry.effront.tsx` はホスト起動とは独立したアプリケーション定義です。
リスナーや静的アセットの配信は、ホストごとの手順に従って設定します。
`react-server` 条件をプロセス全体へ指定しないでください。

## 対応状況 {#support}

| 実行環境                                        | 統合                  | 選ぶ場面                                                |
| ----------------------------------------------- | --------------------- | ------------------------------------------------------- |
| [Cloudflare Workers](./platforms/cloudflare.md) | `@effront/cloudflare` | Vite と Wrangler で standalone Worker を開発する        |
| [Alchemy + Cloudflare](./platforms/alchemy.md)  | `@effront/alchemy`    | Worker と binding を Alchemy の構築 Effect で管理する   |
| [Node.js / Bun](./platforms/node-bun.md)        | `@effront/server`     | native Effect HTTP でリスナーと静的アセットをホストする |

サーバー側のコードは選んだホストで動くため、その環境で利用できる API を使ってください。
Bun 構成でも Vite の dev / preview は Node 互換のミドルウェアです。
Vercel と AWS の専用アダプターは提供していません。

最初は [はじめる](./guide/getting-started.md) の共通アプリケーション定義と standalone Workers の手順を読み、必要に応じて Node.js / Bun の手順を選んでください。
Alchemy CLI はローカル利用でも profile の準備が必要です。
このサイト自身は Alchemy を使っていますが、すべてのアプリケーションに Alchemy が必要なわけではありません。

## ビルドと起動の契約 {#build-startup}

`vp build` はホストが実行できるコードとアセットを生成します。
ビルド成功はリスナーの起動やリモートへの公開を意味しません。
SSR モジュールとブラウザーアセットを含む成果物全体を配置してください。

ビルド後のローカル起動は、[standalone Workers](./platforms/cloudflare.md#local) では生成された Wrangler 設定を使い、[Node.js / Bun](./platforms/node-bun.md#node) ではビルド済みの server entry を実行します。
これらのローカル起動にはクラウドへのデプロイは不要です。
[Alchemy CLI の profile と状態管理](./platforms/alchemy.md#stack) は別の前提なので、standalone Workers の起動コマンドを Alchemy アプリへそのまま流用しないでください。

アプリケーションサービスの取得と解放は[リクエスト runtime と寿命](./advanced/request-runtime-and-lifetimes.md) を参照してください。
起動後は[ビルド済みアプリケーションの受け入れ確認](./guide/testing.md#production) を行います。
