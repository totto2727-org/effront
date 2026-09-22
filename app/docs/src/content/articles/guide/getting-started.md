最小サンプルで `Hello, world` を表示し、ページを構成するファイルの役割を確認します。

## サンプルを起動する {#setup}

Node.js 24.11 以降と [Vite+](https://viteplus.dev/) がインストールされている状態で、[Hello world サンプル](https://github.com/totto2727-org/effront/tree/main/examples/hello-world)を取得します。

```bash
git clone https://github.com/totto2727-org/effront.git
cd effront
vp install
```

続いてサンプルを起動します。

```bash
cd examples/hello-world
vp dev
```

[http://127.0.0.1:1340](http://127.0.0.1:1340) を開くと、`Hello, world` が表示されます。
次回以降は `examples/hello-world` で `vp dev` を実行します。

## サンプルの構成を見る {#application}

サンプルにはページが一つあり、Node.js でローカル起動します。
五つのファイルは、それぞれ次の役割を持ちます。

| ファイル                | 役割                                                          |
| ----------------------- | ------------------------------------------------------------- |
| `src/entry.effront.tsx` | ページの表示内容、HTML レイアウト、`/` のルートを定義します。 |
| `src/entry.rsc.ts`      | アプリケーションを開発・本番サーバーに接続します。            |
| `src/entry.server.ts`   | 本番用にビルドした Node.js サーバーを起動します。             |
| `vite.config.ts`        | Effront の開発とビルドを設定します。                          |
| `package.json`          | 依存パッケージと、サンプルを実行するコマンドを定義します。    |

ページの実装は [`src/entry.effront.tsx`](https://github.com/totto2727-org/effront/blob/main/examples/hello-world/src/entry.effront.tsx) にあります。
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
