import type { ReactNode } from "react";

import { renderArticleList } from "./core-article-list.tsx";
import { coreRuntimeSources } from "./core-runtime-sources.ts";
import { SourceExcerpt } from "./core-source.tsx";
import type { DocPage } from "./types.ts";

const renderIntroduction = (): ReactNode => (
  <>
    <p>
      Reactのcommit、ブラウザー履歴のcommit、Flightの完了は別の出来事です。
      遅延データのストリーミング中にもルートを表示できるため、遷移は表示中のツリーと未完了のリソースを両方追跡します。
    </p>
    <p>
      hydrationは <a href="/ja/architecture/implementation/rendering">HTMLに埋め込んだFlight</a>{" "}
      から始まります。 後続の応答も同じ{" "}
      <a href="/ja/architecture/implementation/routing">サーバー生成のルートツリーモデル</a>{" "}
      を運びますが、ドキュメントを新しく作らず既存のReactルートを更新します。
    </p>
  </>
);

const renderBrowserStart = (): ReactNode => (
  <>
    <h2 id="browser-start">初期ツリーを確立し、クライアント遷移を選ぶ</h2>
    <p>
      <code>client/application.ts</code> の <code>activateBrowser</code>{" "}
      は初期Flightペイロードを読み、<code>ReactDOMRenderer.hydrate</code> を呼びます。
      hydrationはReactへ <code>formState</code> を渡し、layout effectがツリーとstate更新関数で{" "}
      <code>BrowserRenderer</code> を初期化するまで待ちます。 その後でrefresh、Server
      Functionのcallback、対応していればクライアントルーターを登録します。
    </p>
    <p>
      <code>client/browser-capabilities.ts</code> は、<code>window.navigation</code> と{" "}
      <code>window.NavigationPrecommitController</code>{" "}
      の両方がある場合だけクライアントルーティングを選びます。
      それ以外では、hydrate済みのページもドキュメント遷移を使います。
      両APIがあっても、一部のイベントはブラウザーに任せます。
    </p>
    <SourceExcerpt source={coreRuntimeSources.navigationEligibility} />
    <p>
      hashのみの変更、download、フォーム、reload、二つのマーカー付き遷移はinterceptしません。
      ドキュメント用のマーカーは、Effrontのフォールバック読み込みの再interceptを防ぎます。
    </p>
    <p>
      <code>browserMain</code> は <code>Effect.scoped</code> と <code>Effect.never</code>{" "}
      でサービスと購読を維持します。
      初期Flightやhydration開始時の失敗は、ブラウザーの失敗画面を表示します。
      React描画中のエラーはレンダラーのError Boundaryが扱います。
    </p>
  </>
);

const renderFlightLoadList = (): ReactNode =>
  renderArticleList("ul", [
    {
      content: (
        <>
          <strong>ドキュメントへのフォールバック：</strong>非2xxまたはFlight以外の応答は{" "}
          <code>Document</code> になります。
          ルーターは応答を解放し、要求した移動先をドキュメントとして読み込みます。
        </>
      ),
      id: "document-fallback",
    },
    {
      content: (
        <>
          <strong>読み込みエラー：</strong>通信失敗、解決済みURLの欠落や不正、デコード失敗は{" "}
          <code>FlightLoadError</code> になり、理由はそれぞれ <code>RequestFailed</code>、
          <code>UnexpectedResponse</code>、<code>DecodeFailed</code> です。
        </>
      ),
      id: "load-error",
    },
    {
      content: (
        <>
          <strong>Flight：</strong>結果にはペイロード、<code>completed</code>、<code>release</code>
          、<code>resolvedUrl</code> が含まれます。
          ルートツリーのデコード完了は、ストリームの完了を意味しません。
        </>
      ),
      id: "flight",
    },
  ]);

const renderFlightLoad = (): ReactNode => (
  <>
    <h2 id="flight-load">ルートを取得するか、ブラウザーに処理を戻す</h2>
    <p>
      <code>client/route-loader.ts</code>{" "}
      は履歴遷移で、移動先entryのIDを使ってキャッシュ済みツリーを再利用します。
      それ以外の遷移とキャッシュミスでは、<code>FlightClient.load</code> が{" "}
      <code>Accept: text/x-component</code> を付けてGETします。
      応答ごとのScopeは、初期ペイロードのデコード後も存続できます。
    </p>
    {renderFlightLoadList()}
    <p>
      公開前に <code>client/navigation-preparation.ts</code> が解決済みの移動先を検査します。
      originが異なればドキュメント遷移が必要です。
      同じoriginでもURLが変わる場合、履歴遷移かprecommit
      controllerがない状況ではドキュメントを置き換えます。
      それ以外では、Reactのcommit後にcontrollerでredirectできます。
      要求したhashを保つのは、解決済みURLにhashがなく、origin・path・queryが一致するときだけです。
    </p>
  </>
);

const renderTransitionCommitList = (): ReactNode =>
  renderArticleList("ul", [
    {
      content: (
        <>
          <code>committed</code> は、<code>client/browser-root.tsx</code> のlayout effectが{" "}
          <code>renderer.commit(render)</code> を呼ぶと解決します。
        </>
      ),
      id: "committed",
    },
    {
      content: (
        <>
          <code>retired</code> は、置き換えのcommitでツリーを保持する必要がなくなると解決します。
        </>
      ),
      id: "retired",
    },
    {
      content: (
        <>
          <code>discard</code> は、保留中の描画に対して現在のツリーの復元を依頼し、退役を待ちます。
        </>
      ),
      id: "discard",
    },
  ]);

const renderTransitionCommit = (): ReactNode => (
  <>
    <h2 id="transition-commit">描画の予約とcommitを区別する</h2>
    <p>
      非同期のTransition Actionが <code>BrowserEffectRunner</code> を通してルートを読み込みます。
      その後、内側のTransitionがツリーを公開しますが、公開はcommitではありません。
    </p>
    <SourceExcerpt source={coreRuntimeSources.navigationPublication} />
    <p>
      <code>renderer.navigate</code> はstate更新を予約し、三つのライフサイクル操作を返します。
    </p>
    {renderTransitionCommitList()}
    <p>
      キャンセル可能なイベントでは、<code>event.intercept</code> が <code>precommitHandler</code>{" "}
      を使います。 Reactのcommitを待ち、可能なredirectを適用し、履歴のcommitを記録するcallbackを{" "}
      <code>addHandler</code> に登録します。
      キャンセル不能な履歴遷移は通常のhandlerを使うため、同じように履歴を遅らせられません。
      この経路で準備が失敗するとドキュメントをreloadします。
    </p>
    <p>
      Transition typeは遷移の種類と、判別できる場合には方向を表します。
      リンクによるpushとreplaceは、重複と予約済みtypeを除いた{" "}
      <code>data-effront-transition-types</code> の値を加えられます。
      このラベルはcommitや寿命の規則を変えません。 アプリケーションでの利用方法は{" "}
      <a href="/ja/advanced/client-navigation">クライアントナビゲーションとページ遷移</a>{" "}
      を参照してください。
    </p>
  </>
);

const renderNavigationLifetimeList = (): ReactNode =>
  renderArticleList("ul", [
    {
      content: (
        <>
          <strong>履歴が先：</strong>Flightを待ち、キャッシュして解放します。
        </>
      ),
      id: "history-first",
    },
    {
      content: (
        <>
          <strong>Flightが先：</strong>
          応答を解放し、履歴entryが分かるまでキャッシュ用callbackを保持します。
        </>
      ),
      id: "flight-first",
    },
    {
      content: (
        <>
          <strong>ストリームの失敗：</strong>キャッシュせずに解放します。
        </>
      ),
      id: "stream-failure",
    },
  ]);

const renderNavigationLifetime = (): ReactNode => (
  <>
    <h2 id="navigation-lifetime">完了したルートを保存し、不要になった描画を退役させる</h2>
    <p>
      処理中の候補は、表示中の遷移とは別に <code>Loading → Publishing → Rendering</code>{" "}
      を進みます。
      generationのsymbolとAbortControllerにより、新しい遷移は表示中のツリーをすぐ解放せずに、保留中の処理をキャンセルできます。
    </p>
    <p>
      古い読み込みは公開せず解放します。 予約済みの描画はdiscardし、退役後に解放します。
      <code>BrowserRenderer</code>{" "}
      は、表示中のツリーと、復元要求を含む保留中の公開が参照するツリーを保持します。
      そのため、遷移のabortは描画の退役と同じではありません。
      未公開または退役済みのcommitや不正なライフサイクル遷移は <code>TypeError</code> になります。
    </p>
    <p>
      新たに読み込んで表示したルートのキャッシュには、履歴のcommitとFlightの正常完了の両方が必要です。
      <code>NavigationEntryState</code> と <code>NavigationFlightState</code> が独立に追跡します。
    </p>
    {renderNavigationLifetimeList()}
    <p>
      新しいgenerationが始まっていても、描画の退役はそのリソースを解放します。
      キャッシュが保持するのはツリーであり、開いた応答ストリームではありません。
      <code>RouteLoader</code>{" "}
      は破棄された履歴entryを削除し、refresh時にキャッシュのMapを置き換えて、遅れたcallbackによる新キャッシュへの書き込みを防ぎます。
      <a href="/ja/architecture/implementation/server-functions">Server Functionの応答</a>{" "}
      も、同じレンダラーのライフサイクルで現在のページを更新します。
    </p>
  </>
);

const renderNavigation = (): ReactNode => (
  <>
    {renderIntroduction()}
    {renderBrowserStart()}
    {renderFlightLoad()}
    {renderTransitionCommit()}
    {renderNavigationLifetime()}
  </>
);

export const navigationPage = {
  content: renderNavigation,
  description:
    "遷移先の読み込みから画面とブラウザー履歴の更新まで、ページ遷移の実装を読み解きます。",
  group: "実装解説",
  headings: [
    { id: "browser-start", title: "初期ツリーを確立し、クライアント遷移を選ぶ" },
    { id: "flight-load", title: "ルートを取得するか、ブラウザーに処理を戻す" },
    { id: "transition-commit", title: "描画の予約とcommitを区別する" },
    { id: "navigation-lifetime", title: "完了したルートを保存し、不要になった描画を退役させる" },
  ],
  section: "アーキテクチャ",
  slug: "/architecture/implementation/navigation",
  title: "06. ブラウザーの遷移",
} satisfies DocPage;
