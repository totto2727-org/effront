EffrontはWeb標準とEffectベースで実装されたReactのメタフレームワークです。

native Effect HTTP と互換用の Web Fetch・ストリームを境界にすることで、 対応するホストアダプターを通じて、実行環境や既存フレームワークへ組み込める設計です。

## Effrontについて {#overview}

React Server Components による UI と、Effect による依存関係・リソース管理を結び付けます。 アプリケーションを Routes、Layout、Page、Component、Middleware、Server Function から組み立て、 必要なサービスをアプリケーションの Layer から注入します。

## Web標準を境界にする {#boundaries}

リクエストから Flight と HTML を生成し、ブラウザーでは hydration とナビゲーションを行います。 アプリケーションの定義と、ビルド統合・実行環境の接続を分けているため、 ページやサービスのコードにプラットフォームの起動処理を混ぜる必要はありません。

実行環境ごとの対応状況と必要な設定は、[Platforms](/platforms) にまとめています。

## 次に読むもの {#next}

[はじめる](/guide/getting-started) でアプリケーションの構成を確認し、[ルーティング](/guide/routes) と [サービスの注入](/guide/effect) を読んでください。内部の処理を理解したい場合は [アーキテクチャの実装解説](/architecture/implementation/overview)を順に読み進めてください。

- **Getting started**: [はじめる](./guide/getting-started.md) と [ホストの選択](./platforms.md)。
- **Guides**: [ルーティング](./guide/routes.md)、[サービス](./guide/effect.md)、[Markdown 記事](./guide/markdown.md)、[スタイリング](./guide/styling.md)。
- **実行時の契約**: [寿命と画面更新](./advanced.md) を設計時に確認します。
- **API reference**: [公開パッケージとバージョン](./api-reference.md) から必要な契約を探します。
- **アーキテクチャ**: [基準ソースに沿った実装解説](/architecture/implementation/overview) で内部を追います。
