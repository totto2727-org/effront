import type { ReactNode } from "react";

import { renderArticleList } from "./core-article-list.tsx";
import { coreModelSources } from "./core-model-sources.ts";
import { SourceExcerpt } from "./core-source.tsx";
import type { DocPage } from "./types.ts";

const renderIntroduction = (): ReactNode => (
  <p>
    アプリケーション定義は、Pageが使えるサービスを取得せずに記述します。
    Layerとmiddlewareがリクエスト時にサービスを供給し、共通のアプリケーションidentityが定義と描画runtimeを結び付けます。
  </p>
);

const renderServiceContractList = (): ReactNode =>
  renderArticleList("ul", [
    {
      content: (
        <>
          <code>ApplicationServices</code> はアプリケーションのLayerが供給するサービスです。
        </>
      ),
      id: "application-services",
    },
    {
      content: (
        <>
          <code>AvailableServices</code>{" "}
          は、そのfactoryから作った定義が使えるサービスです。Pageの描画とパラメーターSchemaのデコードも対象です。
          初期状態ではApplicationServicesと同じですが、middlewareで一つの枝だけを拡張できます。
        </>
      ),
      id: "available-services",
    },
  ]);

const renderServiceContract = (): ReactNode => (
  <>
    <h2 id="service-contract">サービスを獲得する前に契約を定義する</h2>
    <p>
      <code>application/effront.ts</code> の <code>Application.effront&lt;Services&gt;()</code>{" "}
      は、Page、Layout、Routesなどのfactoryを返します。 サービスやHTTPサーバーは起動しません。
      返り値の <code>EFFRONT&lt;ApplicationServices, AvailableServices&gt;</code>{" "}
      は、二つの契約を分けています。
    </p>
    {renderServiceContractList()}
    <p>
      <code>application/definition.tsx</code> の <code>ApplicationLayerOptions</code> は、Servicesが{" "}
      <code>never</code> でなければLayerを必須にします。 省略可能なLayerを渡さなければ{" "}
      <code>Layer.empty</code> を使います。
      <code>EFFRONT.make</code> は、この提供元とコンパイル済みRoutesを保持します。
      rootはアプリケーションのidentityを共有し、Layoutと少なくとも一つのPageを持ち、予約済みのパスを避ける必要があります。
    </p>
    <p>
      提供元自身の依存関係は、
      <code>ApplicationDefinition&lt;Services, ApplicationError, Requirements&gt;</code> の{" "}
      <code>Requirements</code> に残り、構築時の失敗はApplicationErrorに残ります。
      RequirementsをPageが自動で使えるわけではありません。 外部のServiceを公開するには、たとえば{" "}
      <code>Layer.effect(Service, Service)</code>{" "}
      で既存のインスタンスを渡すなど、アプリケーションのLayerから提供する必要があります。
    </p>
  </>
);

const renderMiddlewareContextList = (): ReactNode =>
  renderArticleList("ul", [
    {
      content: (
        <>
          <strong>PageのGET／HEAD：</strong>Effect HTTPのネイティブなmiddleware
          descriptorを使い、HEADフォールバックなどのルーティング動作を保ちます。
        </>
      ),
      id: "page-requests",
    },
    {
      content: (
        <>
          <strong>Server FunctionのPOST：</strong>Reactのデコードで関数のスコープを特定してから、
          <code>applyMiddleware</code> がEffectをhandlerで包みます。
          <code>reduceRight</code>{" "}
          により先の登録が外側になり、後のmiddlewareへサービスを供給できます。
        </>
      ),
      id: "server-function-requests",
    },
  ]);

const renderMiddlewareContext = (): ReactNode => (
  <>
    <h2 id="middleware-context">middlewareで一つの枝を拡張する</h2>
    <p>
      認証済みの枝だけが使うサービスは、その枝のAvailableServicesに加えます。
      <code>withMiddleware</code>{" "}
      は、追加するサービス型と提供を担当するmiddlewareを記録した新しいfactoryを作ります。
    </p>
    <SourceExcerpt source={coreModelSources.middlewareScope} />
    <p>
      <code>ApplicableMiddleware</code>{" "}
      は、次のmiddlewareが要求するサービスをすでに利用できることを確認します。
      返されるfactoryは、その集合に <code>MiddlewareProvidedServices</code> を加えます。
      実行時には、不正なmemberの種別、別のアプリケーションidentity、同じスコープ内の重複を拒否します。
      元のfactoryは変わらないため、スコープ付きの枝とそうでない枝を共存させられます。
    </p>
    <p>
      登録も <code>provides</code> の型宣言も、サービスを注入しません。
      <code>application/middleware.ts</code>{" "}
      のhandlerが、包むHTTP応答のEffectへサービスを提供する必要があります。
      拡張したfactoryの定義は、リクエスト時に実行するmiddlewareの鎖を保持します。
    </p>
    {renderMiddlewareContextList()}
  </>
);

const renderIdentity = (): ReactNode => (
  <>
    <h2 id="identity">関連する定義を同じアプリケーションに保つ</h2>
    <p>
      一度の <code>Application.effront</code>{" "}
      呼び出しから派生したfactoryは、identity、ルートスコープのID割り当て関数、<code>make</code>{" "}
      関数を共有します。
      <code>withMiddleware</code> は別のアプリケーションを作らず、これらを引き継ぎます。
    </p>
    <SourceExcerpt source={coreModelSources.applicationIdentity} />
    <p>
      呼び出しが別なら、Servicesの型が同じでもidentityは別です。
      <code>Routes.page</code>、<code>Routes.mount</code>、<code>makeApplication</code>{" "}
      はidentityの混在を <code>TypeError</code> で拒否します。
      これは定義の接続ミスであり、リクエスト入力の不正ではありません。
    </p>
    <p>
      <code>application/effront-identity.ts</code> は、identityとmember種別を表す{" "}
      <code>EFFRONTMember</code> のsymbolで所属を記録します。
      identityはServicesを不変に扱う型の印と専用の <code>renderRuntime</code>{" "}
      を持ち、定義時の契約をリクエスト時の実行へ結び付けます。
    </p>
  </>
);

const renderRuntimeBoundary = (): ReactNode => (
  <>
    <h2 id="runtime-boundary">リクエストの中で定義を実行する</h2>
    <p>
      <code>server/application.ts</code>{" "}
      は、リクエスト用にアプリケーションとレンダラーのLayerを構築します。
      <code>provideRequestContext</code> が返すmiddlewareは、取得済みサービスをHTTP
      Contextへ合流させ、スコープ付きmiddlewareが選択された定義の要求するサービスを追加できます。
    </p>
    <p>
      ReactはEffectの呼び出しスタックの外からPageやLayoutを呼びます。
      <code>application/render-runtime.ts</code> は、<code>bind</code>{" "}
      でEffectの実行関数と有効なmiddlewareをAsyncLocalStorageに保持し、<code>run</code>{" "}
      で描画Effectをその実行関数へ渡します。 runtimeの束縛がない場合や必要なmiddlewareが無効な場合は{" "}
      <code>TypeError</code> になります。
      正しいサービス型だけでは、これらの実行時スコープ検査を代替できません。
    </p>
    <p>
      <a href="/ja/architecture/implementation/routing">ルートの組み立て</a>{" "}
      は定義を描画先へ接続します。
      <a href="/ja/architecture/implementation/request">リクエスト処理</a>{" "}
      はサービスの所有権を説明し、<a href="/ja/architecture/implementation/rendering">描画</a>{" "}
      はReactとの境界を追います。
    </p>
  </>
);

const renderApplication = (): ReactNode => (
  <>
    {renderIntroduction()}
    {renderServiceContract()}
    {renderMiddlewareContext()}
    {renderIdentity()}
    {renderRuntimeBoundary()}
  </>
);

export const applicationPage = {
  content: renderApplication,
  description:
    "アプリケーション定義がページとサービスをリクエスト時の実行につなぐ仕組みを、実装から読み解きます。",
  group: "実装解説",
  headings: [
    { id: "service-contract", title: "サービスを獲得する前に契約を定義する" },
    { id: "middleware-context", title: "middlewareで一つの枝を拡張する" },
    { id: "identity", title: "関連する定義を同じアプリケーションに保つ" },
    { id: "runtime-boundary", title: "リクエストの中で定義を実行する" },
  ],
  section: "アーキテクチャ",
  slug: "/architecture/implementation/application",
  title: "02. アプリケーション定義",
} satisfies DocPage;
