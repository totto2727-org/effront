最小サンプルで `Hello, world` を表示し、ページを構成するファイルの役割を確認します。

## サンプルを起動する {#setup}

Node.js 24.11 以降と [Vite+](https://viteplus.dev/) を用意し、Node.js 用の最小構成を作成します。

```bash
vp create effront -- my-app --platform node
cd my-app
vp install
vp dev
```

開発サーバーが表示するローカル URL を開くと、`Hello, world` が表示されます。
他の構成は[プラットフォーム](../platforms.md)を参照してください。
生成ツールの `--platform` には `node`、`bun`、`cloudflare`、`alchemy-cloudflare` を指定できます。ディレクトリとプラットフォームは Vite+ に転送するため `--` の後に渡します。
対話端末では省略した値を尋ねますが、スクリプトでは両方を指定してください。オプションは `vp create effront -- --help` で確認できます。
新しいディレクトリまたは空の既存ディレクトリに、ワークスペースから独立したレジストリで解決可能なプロジェクトを生成します。既存ファイルは上書きせず、デプロイも行いません。

## サンプルの構成を見る {#application}

Node.js 用の最小構成にはページが一つあり、主なファイルは五つです。

| ファイル                | 役割                                                          |
| ----------------------- | ------------------------------------------------------------- |
| `src/entry.effront.tsx` | ページの表示内容、HTML レイアウト、`/` のルートを定義します。 |
| `src/entry.rsc.ts`      | アプリケーションを開発・本番サーバーに接続します。            |
| `src/entry.server.ts`   | 本番用にビルドした Node.js サーバーを起動します。             |
| `vite.config.ts`        | Effront の開発とビルドを設定します。                          |
| `package.json`          | 依存パッケージと、サンプルを実行するコマンドを定義します。    |

ページの実装は、生成したプロジェクトの `src/entry.effront.tsx` にあります（[Node サンプルのソース](https://github.com/totto2727-org/effront/blob/main/examples/node/src/entry.effront.tsx)でも確認できます）。
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
