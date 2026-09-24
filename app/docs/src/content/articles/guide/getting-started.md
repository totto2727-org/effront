最小サンプルで `Hello, world` を表示し、ページを構成するファイルの役割を確認します。

## サンプルを起動する {#setup}

Node.js 24.11 以降、[pnpm](https://pnpm.io/installation)、[Vite+](https://viteplus.dev/) を用意し、Node.js 用の最小構成を作成します。

```bash
pnpm create effront my-app --platform node
cd my-app
pnpm install
pnpm dev
```

開発サーバーが表示するローカル URL を開くと、`Hello, world` が表示されます。
Bun を使う場合は `--platform bun`、Alchemy 管理の Cloudflare Worker を使う場合は `--platform cloudflare` を指定してください。Cloudflare ではローカル開発にも Alchemy の Cloudflare プロファイルの設定が必要です。三つの最小構成は同じページコードを使用し、ホストの設定だけが異なります。

Effront リポジトリ内で試す場合は、ルートで `vp install` を実行してから、対応する [Node](https://github.com/totto2727-org/effront/tree/main/examples/hello-world)、[Bun](https://github.com/totto2727-org/effront/tree/main/examples/hello-world-bun)、[Cloudflare](https://github.com/totto2727-org/effront/tree/main/examples/hello-world-cloudflare) のサンプルを起動してください。

## サンプルの構成を見る {#application}

Node.js 用の最小構成にはページが一つあり、主なファイルは五つです。

| ファイル                | 役割                                                          |
| ----------------------- | ------------------------------------------------------------- |
| `src/entry.effront.tsx` | ページの表示内容、HTML レイアウト、`/` のルートを定義します。 |
| `src/entry.rsc.ts`      | アプリケーションを開発・本番サーバーに接続します。            |
| `src/entry.server.ts`   | 本番用にビルドした Node.js サーバーを起動します。             |
| `vite.config.ts`        | Effront の開発とビルドを設定します。                          |
| `package.json`          | 依存パッケージと、サンプルを実行するコマンドを定義します。    |

ページの実装は、生成したプロジェクトの `src/entry.effront.tsx` にあります（[Node サンプルのソース](https://github.com/totto2727-org/effront/blob/main/examples/hello-world/src/entry.effront.tsx)でも確認できます）。
`HomePage` が見出しの表示内容、`RootLayout` が外側の HTML、`Routes` が `/` とページの対応を定義しています。

## 表示内容を変える {#run}

`src/entry.effront.tsx` の見出しを次のように変更します。

```tsx
const HomePage = EFFRONT.Page.make({
  // 見出しの文字列を変更します。
  render: () => Effect.succeed(<h1>Hello, Effront</h1>),
});
```

保存すると、ブラウザーの表示が `Hello, Effront` に変わります。
ページを追加するには、[ページ、レイアウト、ルート](./routes.md)へ進んでください。
