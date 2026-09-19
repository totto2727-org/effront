## Effectful な Server Component {#server}

共有のサーバー UI には `EFFRONT.Component.make` を使えます。`render` は props を受け、`Effect<ReactNode>` を返します。

```tsx
import { Effect } from "effect";

const Welcome = EFFRONT.Component.make({
  render: ({ name }: { readonly name: string }) => Effect.succeed(<p>こんにちは、{name} さん。</p>),
});

const HomePage = EFFRONT.Page.make({
  render: () => Effect.succeed(<Welcome name="Ada" />),
});
```

## Client boundary と CSS {#client-boundary}

`"use client"` の詳細は [React の公式リファレンス](https://react.dev/reference/rsc/use-client) を参照してください。
グローバル CSS を手動で読み込む場合は、Layout が実際に render する export 済み Client Component から import します。
アプリケーション定義オブジェクトだけから import すると、スタイルがページに反映されない場合があります。

フォームからサーバー処理を呼び出す方法は、[Server Function](/guide/server-functions) で説明します。 Server Component は表示を組み立て、Server Function は入力を検証して更新処理を実行します。

## 境界を守る {#boundary}

Client Component に渡す props は Flight を通るため、シリアライズ可能で公開してよい値だけにしてください。 環境変数、Request、Effect service を直接渡してはいけません。
