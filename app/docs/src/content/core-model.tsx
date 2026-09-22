import { type CoreSource, SourceExcerpt } from "./core-source";
import type { DocPage } from "./types";

export const coreModelSources = {
  fetchBoundary: {
    path: "packages/core/src/workers.ts",
    code: `  const handler = HttpEffect.toWebHandler(toHttpEffect(application));
  return (request, env, executionContext) =>
    handler(request, Context.make(WorkersRequestContext, { env, executionContext, request }));`,
    language: "ts",
  },
  applicationIdentity: {
    path: "packages/core/src/application/effront.ts",
    code: `const effront = <Services = never>(): EFFRONT<Services> => {
  const identity = makeEFFRONTIdentity<Services>();
  const make: EFFRONTMake<Services> = (options) => makeApplication(identity, options);
  let nextRouteScopeId = 0;
  const allocateRouteScopeId = () => {
    const scopeId = nextRouteScopeId;
    nextRouteScopeId += 1;
    return scopeId;
  };

  return makeEFFRONT(identity, Object.freeze([]), allocateRouteScopeId, make);
};`,
    language: "ts",
  },
  middlewareScope: {
    path: "packages/core/src/application/effront.ts",
    code: `  const withMiddleware = <Value extends AnyMiddleware<ApplicationServices>>(
    value: Value & ApplicableMiddleware<AvailableServices, Value>,
  ): EFFRONT<ApplicationServices, AvailableServices | MiddlewareProvidedServices<Value>> => {
    getMiddlewareState(value);
    if (getEFFRONTIdentity(value) !== identity) {
      throw new TypeError("Middleware was created by a different EFFRONT module.");
    }
    if (middleware.includes(value)) {
      throw new TypeError("Middleware cannot appear twice in the same scope.");
    }

    return makeEFFRONT(identity, Object.freeze([...middleware, value]), allocateRouteScopeId, make);
  };`,
    language: "ts",
  },
  compiledDestination: {
    path: "packages/core/src/application/route-graph.ts",
    code: `export type RouteScope<Services> = {
  readonly id: string;
  readonly layout: LayoutComponent<Services> | null;
  readonly loading: LoadingComponent<Services> | null;
};

export type CompiledDestination<Services> = {
  readonly middleware: ReadonlyArray<AnyMiddleware<Services>>;
  readonly page: PageImplementationState<Services>;
  readonly pattern: AbsolutePath;
  readonly scopes: ReadonlyArray<RouteScope<Services>>;
};

export type CompiledRouteGraph<Services> = readonly [
  CompiledDestination<Services>,
  ...Array<CompiledDestination<Services>>,
];`,
    language: "ts",
  },
  routeTraversal: {
    path: "packages/core/src/application/route-graph.ts",
    code: `    for (const route of currentState.pages) {
      const pattern = joinRoutePaths(prefix, route.path);
      validateUnreservedPath(pattern);
      destinations.push(
        Object.freeze({ middleware, page: getPageState(route.page), pattern, scopes }),
      );
    }

    for (const mount of currentState.mounts) {
      visit(mount.routes, joinRoutePaths(prefix, mount.path), scopes, middleware);
    }
  };`,
    language: "ts",
  },
  parameterValidation: {
    path: "packages/core/src/server/application.ts",
    code: `    if (request.method !== "POST" && destination.page.paramsSchema !== null) {
      return yield* Schema.decodeEffect(destination.page.paramsSchema)(encodedParams).pipe(
        Effect.matchEffect({
          onFailure: () =>
            Effect.succeed(
              HttpServerResponse.empty({ status: 404, headers: DynamicResponseHeaders }),
            ),
          onSuccess: (value) => renderResponse({ _tag: "Decoded", value }),
        }),
      );
    }
    return yield* renderResponse({ _tag: "Encoded", value: encodedParams });
  });`,
    language: "ts",
  },
} satisfies Record<string, CoreSource>;

export const coreModelPages: readonly DocPage[] = [
  {
    slug: "/architecture/implementation/overview",
    title: "01. ページ表示をcoreの実装から追う",
    description:
      "アプリケーションの定義からブラウザーでの表示まで、Effront の実装全体を読むための案内。",
    section: "アーキテクチャ",
    group: "実装解説",
    headings: [
      { id: "entries", title: "定義・リクエスト・ブラウザーの入口を見つける" },
      { id: "request-flow", title: "リクエストからドキュメントの表示まで追う" },
      { id: "responsibilities", title: "各段階を担当するコードを見つける" },
      { id: "reading-order", title: "次に追う処理を選ぶ" },
    ],
    content: () => (
      <>
        <p>
          ページ表示には、再利用するアプリケーション定義、リクエストが所有するサービス、ブラウザーへ送るデータが関わります。
          それぞれの寿命は異なります。Routesのコンパイルはサービスを取得せず、Flightの描画はサーバーのContextをクライアントへ引き渡しません。
        </p>
        <h2 id="entries">定義・リクエスト・ブラウザーの入口を見つける</h2>
        <ol>
          <li>
            <strong>定義：</strong>既定の <code>src/entry.effront.tsx</code>{" "}
            がアプリケーションをdefault exportします。 Viteはこれを{" "}
            <code>@effront/core/application-entry</code> として公開します。
            <code>application/definition.tsx</code> の <code>makeApplication</code>{" "}
            はRoutesをコンパイルし、サービスのLayerを構築せずに保持します。
          </li>
          <li>
            <strong>リクエスト：</strong>ホストが定義を <code>@effront/core/http</code>{" "}
            へ接続します。
            <code>workers.ts</code> は、このネイティブなEffect HTTPの境界をFetchに適合させます。
            ホスト共通のVite統合では、ホスト側が別の入口を選ばなければ、RSCエントリに{" "}
            <code>src/entry.workers.ts</code> を使います。
          </li>
          <li>
            <strong>ブラウザー：</strong>
            <code>client/entry.ts</code> が <code>BrowserRuntime.runMain</code> を通じて{" "}
            <code>browserMain</code> を実行します。
            アプリケーションのサーバーサービスをimportするのではなく、Flightからドキュメントをhydrateします。
          </li>
        </ol>
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
        <ol>
          <li>
            <strong>照合：</strong>
            <code>server/application.ts</code> がコンパイル済みの描画先をEffect
            HTTPへ登録し、サービスとmiddlewareを結び付けます。
          </li>
          <li>
            <strong>検証：</strong>
            パラメーター付きPageへのGETでは、照合したパラメーターを描画前にデコードします。
            Schemaのデコード失敗は404になります。 POSTでは代わりにServer
            Functionを準備して実行します。
          </li>
          <li>
            <strong>描画：</strong>
            <code>renderRouteTree</code> がルートツリーを作り、<code>FlightRenderer</code>{" "}
            がReactのFlightストリームを生成します。
          </li>
          <li>
            <strong>応答：</strong>
            <code>Accept</code> ヘッダーが <code>FlightMediaType</code>{" "}
            と完全に一致すればFlightを選びます。 それ以外では <code>HtmlRenderer</code>{" "}
            がSSRエントリを読み込み、同じストリームをHTMLへ変換します。
          </li>
          <li>
            <strong>hydration：</strong>
            <code>client/application.ts</code>{" "}
            が初期Flightペイロードを読み込み、ドキュメントをhydrateし、refreshとServer
            Functionの処理を登録します。 クライアントルーターを登録するのは、
            <code>navigationMode</code> が <code>"Client"</code> の場合だけです。
          </li>
        </ol>
        <p>
          描画が終わる前に応答ヘッダーが届くことがあります。 Effect
          HTTPのWebハンドラーは、ストリーム本文の完了・失敗・キャンセルまでリクエストのScopeを維持します。
          coreはその移譲前にHEADの本文を取り除き、読まれないストリームがScopeを保持し続けることを防ぎます。
          <code>makeHttpEffect</code>{" "}
          で借りたサービスはホストの所有物のままであり、ホストはそれを使うすべての応答本文が終わるまで維持する必要があります。
          この所有権の境界は <a href="/ja/architecture/implementation/request">リクエスト処理</a>{" "}
          で説明します。
        </p>
        <h2 id="responsibilities">各段階を担当するコードを見つける</h2>
        <p>
          以下は <code>packages/core/src</code> からの相対パスです。
        </p>
        <ul>
          <li>
            <code>application/</code>：定義のidentity、サービスの契約、ルートのコンパイル。
          </li>
          <li>
            <code>http.ts</code> と <code>server/application.ts</code>
            ：リクエストごとの取得、HTTPの振り分け、middleware、応答の選択。
          </li>
          <li>
            <code>rsc/</code> と <code>server/</code>{" "}
            のレンダラー：ルートツリーの契約、Flightの生成、HTMLの描画。
          </li>
          <li>
            <code>client/</code>：hydration、遷移、refresh、Server Functionの呼び出し。
          </li>
        </ul>
        <p>
          実行環境は統合パッケージが担当します。
          <code>packages/vite/src/index.ts</code>{" "}
          はReact/RSCプラグイン、アプリケーションのalias、ブラウザー・RSC・SSRのエントリを設定します。
          CloudflareアダプターはRSCとその子SSR環境をworkerdで実行します。
          <code>@effront/server</code>{" "}
          は、分離したRSCとSSRのグラフをNode.jsまたはBunでホストします。
        </p>
        <h2 id="reading-order">次に追う処理を選ぶ</h2>
        <ul>
          <li>
            <strong>リクエストの前：</strong>
            <a href="/ja/architecture/implementation/application">アプリケーション定義</a> と{" "}
            <a href="/ja/architecture/implementation/routing">ルートの組み立て</a>{" "}
            は、再利用する定義が保持する内容を説明します。
          </li>
          <li>
            <strong>リクエストの処理中：</strong>
            <a href="/ja/architecture/implementation/request">リクエスト処理</a> と{" "}
            <a href="/ja/architecture/implementation/rendering">描画</a>{" "}
            は、サービスの取得から応答本文までを結び付けます。
          </li>
          <li>
            <strong>hydrationの後：</strong>
            <a href="/ja/architecture/implementation/navigation">ナビゲーション</a> と{" "}
            <a href="/ja/architecture/implementation/server-functions">Server Functions</a>{" "}
            は、新しいFlightデータと表示中のUIを調整します。
          </li>
        </ul>
      </>
    ),
  },
  {
    slug: "/architecture/implementation/application",
    title: "02. アプリケーション定義",
    description:
      "アプリケーション定義がページとサービスをリクエスト時の実行につなぐ仕組みを、実装から読み解きます。",
    section: "アーキテクチャ",
    group: "実装解説",
    headings: [
      { id: "service-contract", title: "サービスを獲得する前に契約を定義する" },
      { id: "middleware-context", title: "middlewareで一つの枝を拡張する" },
      { id: "identity", title: "関連する定義を同じアプリケーションに保つ" },
      { id: "runtime-boundary", title: "リクエストの中で定義を実行する" },
    ],
    content: () => (
      <>
        <p>
          アプリケーション定義は、Pageが使えるサービスを取得せずに記述します。
          Layerとmiddlewareがリクエスト時にサービスを供給し、共通のアプリケーションidentityが定義と描画runtimeを結び付けます。
        </p>
        <h2 id="service-contract">サービスを獲得する前に契約を定義する</h2>
        <p>
          <code>application/effront.ts</code> の <code>Application.effront&lt;Services&gt;()</code>{" "}
          は、Page、Layout、Routesなどのfactoryを返します。 サービスやHTTPサーバーは起動しません。
          返り値の <code>EFFRONT&lt;ApplicationServices, AvailableServices&gt;</code>{" "}
          は、二つの契約を分けています。
        </p>
        <ul>
          <li>
            <code>ApplicationServices</code> はアプリケーションのLayerが供給するサービスです。
          </li>
          <li>
            <code>AvailableServices</code>{" "}
            は、そのfactoryから作った定義が使えるサービスです。Pageの描画とパラメーターSchemaのデコードも対象です。
            初期状態ではApplicationServicesと同じですが、middlewareで一つの枝だけを拡張できます。
          </li>
        </ul>
        <p>
          <code>application/definition.tsx</code> の <code>ApplicationLayerOptions</code>{" "}
          は、Servicesが <code>never</code> でなければLayerを必須にします。
          省略可能なLayerを渡さなければ <code>Layer.empty</code> を使います。
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
        <ul>
          <li>
            <strong>PageのGET／HEAD：</strong>Effect HTTPのネイティブなmiddleware
            descriptorを使い、HEADフォールバックなどのルーティング動作を保ちます。
          </li>
          <li>
            <strong>Server FunctionのPOST：</strong>Reactのデコードで関数のスコープを特定してから、
            <code>applyMiddleware</code> がEffectをhandlerで包みます。
            <code>reduceRight</code>{" "}
            により先の登録が外側になり、後のmiddlewareへサービスを供給できます。
          </li>
        </ul>
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
        <h2 id="runtime-boundary">リクエストの中で定義を実行する</h2>
        <p>
          <code>server/application.ts</code>{" "}
          は、リクエスト用にアプリケーションとレンダラーのLayerを構築します。
          <code>RequestContextMiddleware</code> が取得済みサービスをHTTP
          Contextへ合流させ、スコープ付きmiddlewareが選択された定義の要求するサービスを追加できます。
        </p>
        <p>
          ReactはEffectの呼び出しスタックの外からPageやLayoutを呼びます。
          <code>application/render-runtime.ts</code> は、<code>bind</code>{" "}
          でEffectの実行関数と有効なmiddlewareをAsyncLocalStorageに保持し、<code>run</code>{" "}
          で描画Effectをその実行関数へ渡します。
          runtimeの束縛がない場合や必要なmiddlewareが無効な場合は <code>TypeError</code>{" "}
          になります。 正しいサービス型だけでは、これらの実行時スコープ検査を代替できません。
        </p>
        <p>
          <a href="/ja/architecture/implementation/routing">ルートの組み立て</a>{" "}
          は定義を描画先へ接続します。
          <a href="/ja/architecture/implementation/request">リクエスト処理</a>{" "}
          はサービスの所有権を説明し、<a href="/ja/architecture/implementation/rendering">描画</a>{" "}
          はReactとの境界を追います。
        </p>
      </>
    ),
  },
  {
    slug: "/architecture/implementation/routing",
    title: "03. ルート定義からリクエストへ",
    description:
      "ルート定義からリクエストの振り分け、ページのパラメーター検証までの実装を読み解きます。",
    section: "アーキテクチャ",
    group: "実装解説",
    headings: [
      { id: "compilation", title: "サーバーが受け取る描画先から読む" },
      { id: "route-contract", title: "URLから取り出した値をPageの入力につなぐ" },
      { id: "collisions", title: "アプリケーションの組み立て時の失敗を見分ける" },
      { id: "schema-and-http", title: "ルートの照合とパラメーターの検証を分ける" },
    ],
    content: () => (
      <>
        <p>
          描画先はPage、完全なパス、middleware、周囲のLayout／Loadingスコープをまとめたものです。
          Effrontはリクエストを受け付ける前に描画先を組み立て、不正な宣言と、ルートには一致してもPageのパラメーター検証に失敗するURLを区別します。
        </p>
        <h2 id="compilation">サーバーが受け取る描画先から読む</h2>
        <p>
          <code>Routes</code> はPageとマウントした子Routesの木であり、動作中のHTTP
          matcherではありません。
          <code>EFFRONT.make</code> の実行時に、<code>application/route-graph.ts</code> の{" "}
          <code>compileRouteGraph</code> がこれを描画先の配列に変換します。
        </p>
        <SourceExcerpt source={coreModelSources.compiledDestination} />
        <p>
          <code>/:id</code> にある子Pageを <code>/items</code> の下にマウントすると、
          <code>/items/:id</code> になります。
          走査では親のスコープを引き継ぎ、子RoutesにLayoutかLoadingがある場合だけ新しいスコープを加えます。
          パスをまとめるだけでは描画の境界は増えません。 スコープIDは宣言の <code>scopeId</code>{" "}
          とマウント先の接頭辞を組み合わせ、同じ宣言の複数回のマウントを区別します。
        </p>
        <SourceExcerpt source={coreModelSources.routeTraversal} />
        <p>
          ループは現在のノードのPage、次にマウント先を、それぞれの登録順でたどります。
          <code>page</code> と <code>mount</code> を交互に呼んでも、全体の呼び出し順は残りません。
          これは照合の優先順位ではなく走査順です。照合はEffect
          HTTPが担当し、このコンパイラーは静的パスと動的パスを並べ替えません。
        </p>
        <p>
          <code>resolveRouteMiddleware</code>{" "}
          は継承した鎖を残し、共通接頭辞を除いた現在の宣言の残りを加えます。 重複が残れば{" "}
          <code>TypeError</code> になります。
          コンパイラーはrootのLayoutと少なくとも一つのPageも要求し、空でない描画先の配列をfreezeして返します。
          リクエストはRoutesを再走査せず、この配列を使います。
        </p>
        <h2 id="route-contract">URLから取り出した値をPageの入力につなぐ</h2>
        <p>
          <code>application/routes.ts</code> の <code>page</code> と <code>mount</code>{" "}
          は、既存の定義を変更せずに新しい定義を返します。
          <code>RoutesDefinition</code>{" "}
          はLayoutの有無、登録済みパス、照合上の形を保持し、後の追加を先の定義と照らし合わせて検査します。
        </p>
        <p>
          <code>MatchingPageParams</code> はURLのパラメーター名とPage Schemaの <code>Encoded</code>{" "}
          側のキーを比較します。
          <code>/items/:id</code> ではエンコード側のキーが <code>id</code>{" "}
          と過不足なく一致する必要があり、描画にはデコード後の <code>Type</code> を渡します。
          変換で値や出力キーを変えても、URLのパラメーター名は変わりません。
          静的パスにはパラメーターSchemaのないPageを使います。
        </p>
        <p>
          実行時の登録処理は、文法、アプリケーションidentity、パラメーターとSchemaの有無の対応を検査します。
          エンコード側の全キーを比べる型レベルの検査までは繰り返しません。
        </p>
        <p>
          <code>application/route-path.ts</code> の <code>ValidRoutePath</code> と{" "}
          <code>analyzeRoutePath</code> が、型と実行時の文法検査を対にします。
        </p>
        <ul>
          <li>
            パスは <code>/</code> で始め、<code>:id</code>{" "}
            のような名前付きセグメントを使います。末尾には <code>*path</code>{" "}
            のような名前付きcatch-allを置けます。
          </li>
          <li>
            rootの <code>/</code>{" "}
            を除き、空セグメントと末尾のスラッシュは無効です。ドットセグメント、パラメーター名の重複、クエリー文字列、その他のワイルドカード形式も無効です。
          </li>
          <li>
            マウントの接頭辞は静的である必要があります。子Routesは空でなく、アプリケーションidentityを共有する必要があります。
          </li>
        </ul>
        <h2 id="collisions">アプリケーションの組み立て時の失敗を見分ける</h2>
        <p>
          衝突検査は静的セグメントを小文字にし、パラメーター名を除いて照合上の形を比較します。
          拒否するのは同じ形であり、一致範囲が重なるすべての組み合わせではありません。
        </p>
        <ul>
          <li>
            <code>/items/:id</code> と <code>/items/:slug</code> は衝突します。
          </li>
          <li>
            <code>/About</code> と <code>/about</code> は衝突します。
          </li>
          <li>
            <code>/manual/*path</code> は、取得値が空になる <code>/manual</code> も予約します。
          </li>
          <li>
            <code>/items/new</code> と <code>/items/:id</code> は形が異なるため共存できます。
          </li>
        </ul>
        <p>
          マウントは接頭辞を結合した子のパスを検査するため、親に直接登録したPageとの衝突も検出します。
          <code>joinRoutePaths</code> は <code>/</code> を特別扱いし、余分なスラッシュを防ぎます。
          型の検査に加え、実行時の衝突検査も <code>TypeError</code> を投げます。
        </p>
        <p>
          <code>validateUnreservedPath</code> は結合後の最終パスを検査し、<code>/_effront</code>{" "}
          を保護します。 大文字小文字を問わず先頭セグメントが <code>_effront</code>{" "}
          の場合と、その値を取得できる動的な先頭セグメントを拒否します。 したがって最終パスの{" "}
          <code>/:slug</code> は無効ですが、<code>/items/:slug</code> はこの検査を通ります。
          失敗は組み立て時に起き、リクエストURLの照合より前です。
        </p>
        <h2 id="schema-and-http">ルートの照合とパラメーターの検証を分ける</h2>
        <p>
          <code>server/application.ts</code> の <code>makeRouteLayer</code> が、
          <code>HttpRouter.add</code> でGETとPOSTのhandlerを登録します。
          URLの照合と取得値のデコードはEffect HTTPが担当します。 Effrontは <code>*</code>{" "}
          の取得値を宣言したcatch-all名へ移し、値がなければ空文字列を使います。 描画処理は{" "}
          <code>HttpRouter.params</code> を読み、PageのSchemaを適用します。
        </p>
        <SourceExcerpt source={coreModelSources.parameterValidation} />
        <p>
          非POSTリクエストでは、Schemaデコードの型付き失敗を、<code>private, no-store</code>{" "}
          が付いた本文なしの404に変換します。 成功時は <code>Decoded</code>{" "}
          パラメーターを渡し、Pageでの二重デコードを防ぎます。 たとえば{" "}
          <code>/items/not-a-number</code> は <code>/items/:id</code>{" "}
          に一致しても、IDを数値にデコードするSchemaには失敗します。
        </p>
        <p>
          ルートの不一致やURL取得値の読み取り失敗は、このSchema handlerの外で起きます。
          POSTもここを通らず、描画に <code>Encoded</code>{" "}
          パラメーターを渡し、Pageコンポーネントでデコードします。
          そのため、GETのSchema失敗を404にする規則は、Server
          Functionの入力やrefreshの失敗には当てはまりません。
        </p>
        <p>
          <a href="/ja/architecture/implementation/request">リクエスト処理</a>{" "}
          は選ばれた描画先のContextと寿命を追います。
          <a href="/ja/architecture/implementation/rendering">描画</a> はスコープをUIに変換し、
          <a href="/ja/architecture/implementation/server-functions">Server Functions</a>{" "}
          はPOST経路を追います。
        </p>
      </>
    ),
  },
];
