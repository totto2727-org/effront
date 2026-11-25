import type { ReactNode } from "react";

import { renderArticleList } from "./core-article-list.tsx";
import { coreModelSources } from "./core-model-sources.ts";
import { SourceExcerpt } from "./core-source.tsx";
import type { DocPage } from "./types.ts";

const renderIntroduction = (): ReactNode => (
  <p>
    ページ表示には、再利用するアプリケーション定義、リクエストが所有するサービス、ブラウザーへ送るデータが関わります。
    それぞれの寿命は異なります。Routesのコンパイルはサービスを取得せず、Flightの描画はサーバーのContextをクライアントへ引き渡しません。
  </p>
);

const renderEntriesList = (): ReactNode =>
  renderArticleList("ol", [
    {
      content: (
        <>
          <strong>定義：</strong>既定の <code>src/entry.effront.tsx</code>{" "}
          がアプリケーションをdefault exportします。 Viteはこれを{" "}
          <code>@effront/core/application-entry</code> として公開します。
          <code>application/definition.tsx</code> の <code>makeApplication</code>{" "}
          はRoutesをコンパイルし、サービスのLayerを構築せずに保持します。
        </>
      ),
      id: "definition",
    },
    {
      content: (
        <>
          <strong>リクエスト：</strong>ホストが定義を <code>@effront/core/http</code> へ接続します。
          <code>workers.ts</code> は、このネイティブなEffect HTTPの境界をFetchに適合させます。
          ホスト共通のVite統合では、ホスト側が別の入口を選ばなければ、RSCエントリに{" "}
          <code>src/entry.workers.ts</code> を使います。
        </>
      ),
      id: "request",
    },
    {
      content: (
        <>
          <strong>ブラウザー：</strong>
          <code>client/entry.ts</code> が <code>BrowserRuntime.runMain</code> を通じて{" "}
          <code>browserMain</code> を実行します。
          アプリケーションのサーバーサービスをimportするのではなく、Flightからドキュメントをhydrateします。
        </>
      ),
      id: "browser",
    },
  ]);

const renderEntries = (): ReactNode => (
  <>
    <h2 id="entries">定義・リクエスト・ブラウザーの入口を見つける</h2>
    {renderEntriesList()}
  </>
);

const requestFlowStages = [
  {
    content: (
      <>
        <strong>照合：</strong>
        <code>server/application.ts</code> がコンパイル済みの描画先をEffect
        HTTPへ登録し、サービスとmiddlewareを結び付けます。
      </>
    ),
    id: "matching",
  },
  {
    content: (
      <>
        <strong>検証：</strong>
        パラメーター付きPageへのGETでは、照合したパラメーターを描画前にデコードします。
        Schemaのデコード失敗は404になります。 POSTでは代わりにServer Functionを準備して実行します。
      </>
    ),
    id: "validation",
  },
  {
    content: (
      <>
        <strong>描画：</strong>
        <code>renderRouteTree</code> がルートツリーを作り、<code>FlightRenderer</code>{" "}
        がReactのFlightストリームを生成します。
      </>
    ),
    id: "rendering",
  },
  {
    content: (
      <>
        <strong>応答：</strong>
        <code>Accept</code> ヘッダーが <code>FlightMediaType</code>{" "}
        と完全に一致すればFlightを選びます。 それ以外では <code>HtmlRenderer</code>{" "}
        がSSRエントリを読み込み、同じストリームをHTMLへ変換します。
      </>
    ),
    id: "response",
  },
  {
    content: (
      <>
        <strong>hydration：</strong>
        <code>client/application.ts</code>{" "}
        が初期Flightペイロードを読み込み、ドキュメントをhydrateし、refreshとServer
        Functionの処理を登録します。 クライアントルーターを登録するのは、
        <code>navigationMode</code> が <code>&quot;Client&quot;</code> の場合だけです。
      </>
    ),
    id: "hydration",
  },
];

const renderRequestFlow = (): ReactNode => (
  <>
    <h2 id="request-flow">リクエストからドキュメントの表示まで追う</h2>
    <p>
      <code>createFetchHandler</code> はWebハンドラーを再利用し、呼び出しごとに新しい{" "}
      <code>WorkersRequestContext</code> を渡します。
    </p>
    <SourceExcerpt source={coreModelSources.fetchBoundary} />
    <p>
      <code>http.ts</code> の <code>toHttpEffect</code> は評価ごとに新しいLayerのmemo
      mapを作り、現在のリクエストContextで <code>ServerApplication.httpLayer(application)</code>{" "}
      を構築します。 アプリケーションのLayerは、取得中にそのリクエストのホスト値を参照できます。
      ハンドラーを再利用しても、アプリケーションサービスのインスタンスをリクエスト間で共有することにはなりません。
    </p>
    {renderArticleList("ol", requestFlowStages)}
    <p>
      描画が終わる前に応答ヘッダーが届くことがあります。 Effect
      HTTPのWebハンドラーは、ストリーム本文の完了・失敗・キャンセルまでリクエストのScopeを維持します。
      HEADでは本文を消費しないため、ハンドラーとネイティブホストがヘッダーを維持したままストリームを破棄し、Scopeを解放します。
      <code>makeHttpEffect</code>{" "}
      で借りたサービスはホストの所有物のままであり、ホストはそれを使うすべての応答本文が終わるまで維持する必要があります。
      この所有権の境界は <a href="/ja/architecture/implementation/request">リクエスト処理</a>{" "}
      で説明します。
    </p>
  </>
);

const renderResponsibilitiesList = (): ReactNode =>
  renderArticleList("ul", [
    {
      content: (
        <>
          <code>application/</code>：定義のidentity、サービスの契約、ルートのコンパイル。
        </>
      ),
      id: "application",
    },
    {
      content: (
        <>
          <code>http.ts</code> と <code>server/application.ts</code>
          ：リクエストごとの取得、HTTPの振り分け、middleware、応答の選択。
        </>
      ),
      id: "server",
    },
    {
      content: (
        <>
          <code>rsc/</code> と <code>server/</code>{" "}
          のレンダラー：ルートツリーの契約、Flightの生成、HTMLの描画。
        </>
      ),
      id: "rendering",
    },
    {
      content: (
        <>
          <code>client/</code>：hydration、遷移、refresh、Server Functionの呼び出し。
        </>
      ),
      id: "browser",
    },
  ]);

const renderResponsibilities = (): ReactNode => (
  <>
    <h2 id="responsibilities">各段階を担当するコードを見つける</h2>
    <p>
      以下は <code>packages/core/src</code> からの相対パスです。
    </p>
    {renderResponsibilitiesList()}
    <p>
      実行環境は統合パッケージが担当します。
      <code>packages/vite/src/plugin.ts</code>{" "}
      はReact/RSCプラグイン、アプリケーションのalias、ブラウザー・RSC・SSRのエントリを設定します。
      CloudflareアダプターはRSCとその子SSR環境をworkerdで実行します。
      <code>@effront/server</code> は、分離したRSCとSSRのグラフをNode.jsまたはBunでホストします。
    </p>
  </>
);

const renderReadingOrderList = (): ReactNode =>
  renderArticleList("ul", [
    {
      content: (
        <>
          <strong>リクエストの前：</strong>
          <a href="/ja/architecture/implementation/application">アプリケーション定義</a> と{" "}
          <a href="/ja/architecture/implementation/routing">ルートの組み立て</a>{" "}
          は、再利用する定義が保持する内容を説明します。
        </>
      ),
      id: "before-request",
    },
    {
      content: (
        <>
          <strong>リクエストの処理中：</strong>
          <a href="/ja/architecture/implementation/request">リクエスト処理</a> と{" "}
          <a href="/ja/architecture/implementation/rendering">描画</a>{" "}
          は、サービスの取得から応答本文までを結び付けます。
        </>
      ),
      id: "during-request",
    },
    {
      content: (
        <>
          <strong>hydrationの後：</strong>
          <a href="/ja/architecture/implementation/navigation">ナビゲーション</a> と{" "}
          <a href="/ja/architecture/implementation/server-functions">Server Functions</a>{" "}
          は、新しいFlightデータと表示中のUIを調整します。
        </>
      ),
      id: "after-hydration",
    },
  ]);

const renderReadingOrder = (): ReactNode => (
  <>
    <h2 id="reading-order">次に追う処理を選ぶ</h2>
    {renderReadingOrderList()}
  </>
);

const renderOverview = (): ReactNode => (
  <>
    {renderIntroduction()}
    {renderEntries()}
    {renderRequestFlow()}
    {renderResponsibilities()}
    {renderReadingOrder()}
  </>
);

export const overviewPage = {
  content: renderOverview,
  description:
    "アプリケーションの定義からブラウザーでの表示まで、Effront の実装全体を読むための案内。",
  group: "実装解説",
  headings: [
    { id: "entries", title: "定義・リクエスト・ブラウザーの入口を見つける" },
    { id: "request-flow", title: "リクエストからドキュメントの表示まで追う" },
    { id: "responsibilities", title: "各段階を担当するコードを見つける" },
    { id: "reading-order", title: "次に追う処理を選ぶ" },
  ],
  section: "アーキテクチャ",
  slug: "/architecture/implementation/overview",
  title: "01. ページ表示をcoreの実装から追う",
} satisfies DocPage;
