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
      "アプリケーション定義からリクエスト処理、Flight、HTML、hydrationまでを追い、各段階を担当する実装を見つけます。",
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
          Pageがブラウザーのドキュメントになる仕組みを理解したいときは、coreの全モジュールを読むよりも、一度のページ表示を追うところから始めます。
          この章では <code>packages/core/src</code>{" "}
          をたどり、再利用するアプリケーション定義が、リクエストに属するサービスとストリーム応答へつながる道筋を示します。
          詳細な章へ進む前に、この見取り図でルーティング、描画、ブラウザーの動作を担当するコードを見つけてください。
        </p>
        <h2 id="entries">定義・リクエスト・ブラウザーの入口を見つける</h2>
        <p>
          一度のページ表示には、役割の異なる3つの入口が関わります。
          どの入口を読んでいるかを確かめると、アプリケーションの組み立てを、リクエストの実行やブラウザーの起動と取り違えずに済みます。
        </p>
        <ol>
          <li>
            <strong>アプリケーション定義。</strong> 既定の <code>src/entry.effront.tsx</code>{" "}
            はアプリケーションをexportします。 Viteはこれを{" "}
            <code>@effront/core/application-entry</code> から参照できるようにします。
            <code>application/definition.tsx</code> の <code>makeApplication</code>{" "}
            はRoutesをコンパイルし、サービスのLayerを保持しますが、そのサービスを獲得するわけではありません。
          </li>
          <li>
            <strong>リクエスト処理。</strong> ホストのエントリは、この定義をHTTPへ接続します。
            ネイティブの入口は <code>@effront/core/http</code> で、<code>workers.ts</code>{" "}
            はそれをWorkers互換のFetchハンドラーへ変換します。
            ホスト共通のVite統合ではRSCエントリの既定値が <code>src/entry.workers.ts</code>{" "}
            ですが、ホストの統合は別のエントリを選択できます。
          </li>
          <li>
            <strong>ブラウザーの起動。</strong> coreの <code>client/entry.ts</code> は{" "}
            <code>BrowserRuntime.runMain</code> を通じて <code>browserMain</code> を実行します。
            ここで行うのは描画済みドキュメントに対するブラウザー側の処理の開始であり、アプリケーション定義を読み込んでサーバーのサービスをブラウザーで動かすことではありません。
          </li>
        </ol>
        <h2 id="request-flow">リクエストからドキュメントの表示まで追う</h2>
        <p>
          小さく具体的な出発点として、Fetchアダプターを読みます。 次の{" "}
          <code>createFetchHandler</code>{" "}
          の抜粋では、再利用するWebハンドラーに、呼び出しごとに新しい{" "}
          <code>WorkersRequestContext</code> を渡しています。 このContextに入るのは、その呼び出しの{" "}
          <code>env</code>、<code>executionContext</code>、<code>request</code> です。
        </p>
        <SourceExcerpt source={coreModelSources.fetchBoundary} />
        <p>
          ハンドラーを再利用しても、アプリケーションのサービスをリクエスト間で共有することにはなりません。
          <code>http.ts</code> の <code>toHttpEffect</code> は評価ごとに新しいLayerのmemo
          mapを作り、現在のリクエストContextで <code>ServerApplication.httpLayer(application)</code>{" "}
          を構築します。
          そのため、アプリケーションのLayerはサービスの獲得中にホストの値を参照できます。
          Effrontがそれらのホストの値を暗黙にFlightやHTMLへ追加することはありません。
        </p>
        <ol>
          <li>
            <strong>描画先を照合する。</strong> <code>server/application.ts</code>{" "}
            はコンパイル済みのルートパターンをEffect
            HTTPへ登録し、アプリケーションのサービスとルートのmiddlewareに結び付けます。
          </li>
          <li>
            <strong>Pageを準備する。</strong>{" "}
            パラメーターのSchemaがあるGETでは、ハンドラーが照合結果のパラメーターをデコードしてから描画します。
            デコードに失敗すると404を返します。 POSTはこのGETの経路ではなく、Server
            Functionの準備と実行を行う別の経路を通ります。
          </li>
          <li>
            <strong>Flightを描画する。</strong> <code>renderRouteTree</code> がルートツリーを作り、
            <code>FlightRenderer</code> がそれをReactのFlightとして描画します。
          </li>
          <li>
            <strong>応答を選ぶ。</strong> <code>Accept</code> ヘッダーが{" "}
            <code>FlightMediaType</code> と完全に一致すれば、Flightストリームを返します。
            それ以外では、<code>HtmlRenderer</code>{" "}
            がSSRエントリを読み込み、そのFlightストリームをHTMLへ変換します。
          </li>
          <li>
            <strong>ドキュメント上の処理を開始する。</strong> <code>client/application.ts</code>{" "}
            では、ブラウザーが初期Flightペイロードを読み込み、ドキュメントをhydrateし、refreshとServer
            Functionの処理を導入します。 クライアントルーターを導入するのは、
            <code>navigationMode</code> が <code>"Client"</code> の場合だけです。
          </li>
        </ol>
        <p>
          応答ヘッダーを返しても、描画が終わったとは限りません。
          ホストは、ストリーム本文が終端・エラー・キャンセルに達するまで、リクエストのScopeを保持する必要があります。
          Effect
          HTTPのWebハンドラーがこの寿命の引き継ぎを管理し、coreはHEADの本文を取り除くことで、読まれないストリームがScopeを保持し続けないようにします。
          <code>makeHttpEffect</code>{" "}
          で外部サービスの参照を捕捉する場合は、その所有者も、サービスを使う応答本文の処理が終わるまでサービスを生存させる必要があります。
          参照の捕捉はサービスの寿命を延ばすものではなく、アプリケーションのLayerをリクエストごとに構築する仕組みも変えません。
          この境界の詳細は <a href="/ja/architecture/implementation/request">リクエスト処理</a>{" "}
          を参照してください。
        </p>
        <h2 id="responsibilities">各段階を担当するコードを見つける</h2>
        <p>
          ページ表示の道筋が見えたら、理解したい段階に合わせてソースのディレクトリを選びます。
          以下のパスは、パッケージを明記したものを除き、<code>packages/core/src</code>{" "}
          からの相対パスです。
        </p>
        <ul>
          <li>
            <strong>このアプリケーションは何を提供できるか。</strong>{" "}
            定義のidentity、サービスの契約、Routesから描画先へのコンパイルは{" "}
            <code>application/</code> を読みます。
          </li>
          <li>
            <strong>このリクエストで何が動くか。</strong>{" "}
            Layerの構築、HTTPの振り分け、middleware、応答の選択は <code>http.ts</code> と{" "}
            <code>server/application.ts</code> を読みます。
          </li>
          <li>
            <strong>何が描画用のデータになるか。</strong> ルートツリーとFlightの契約は{" "}
            <code>rsc/</code> を読み、FlightとHTMLの生成は <code>server/</code>{" "}
            のレンダラーへ進みます。
          </li>
          <li>
            <strong>ドキュメントが届いた後は何が起こるか。</strong>{" "}
            hydration、ナビゲーション、refresh、Server Functionの呼び出しは <code>client/</code>{" "}
            を読みます。
          </li>
        </ul>
        <p>
          これらのモジュールがどこで実行されるかを知りたい場合は、統合パッケージへ進みます。
          <code>packages/vite/src/index.ts</code>{" "}
          はReact/RSCプラグイン、アプリケーションのalias、ブラウザー・RSC・SSRのエントリを設定します。
          CloudflareアダプターはRSCとその子SSR環境をworkerdへ接続し、<code>@effront/server</code>{" "}
          はRSCとSSRのグラフを分離したNode.jsとBunのネイティブホスティングを提供します。
          これらの統合が担当するのはモジュールの実行環境とホストへの接続であり、ここまで追ってきたPageの描画処理の定義ではありません。
        </p>
        <h2 id="reading-order">次に追う処理を選ぶ</h2>
        <p>
          実装を入力側から追うなら、
          <a href="/ja/architecture/implementation/application">アプリケーション定義</a> と{" "}
          <a href="/ja/architecture/implementation/routing">ルートの組み立て</a> へ進みます。
          この2章では、リクエスト処理が受け取る再利用可能な定義を説明します。 続いて{" "}
          <a href="/ja/architecture/implementation/request">リクエスト処理</a> と{" "}
          <a href="/ja/architecture/implementation/rendering">描画</a>{" "}
          を読み、サービスの獲得から応答の生成までを追います。
        </p>
        <p>
          初回のドキュメント表示には問題がなく、その後の操作を調べているなら、
          <a href="/ja/architecture/implementation/navigation">ナビゲーション</a> または{" "}
          <a href="/ja/architecture/implementation/server-functions">Server Functions</a>{" "}
          から始めます。
          どの章でも、再利用する定義、リクエストが所有するサービス、ブラウザーへ送るデータの3つを区別してください。
          そうすれば、描画の境界を越えたからといって寿命やサーバーの依存関係まで引き継がれると考えずに、値の行方を追えます。
        </p>
      </>
    ),
  },
  {
    slug: "/architecture/implementation/application",
    title: "02. アプリケーション定義",
    description:
      "Pageのサービス契約からリクエスト時の実行までを追い、Layer、スコープ付きmiddleware、identityがそれらをどう結び付けるかを読み解きます。",
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
          Pageには、リクエストが届くより前に、アプリケーションのサービスを使うEffectを宣言できます。
          そのEffectが実行されるまでを理解するには、依存関係の定義と、実際の値の獲得を分けて考える必要があります。
          この章ではcoreの実装を読み、Pageの型が要求するサービスが、リクエスト時にどこから提供されるのかを追います。
        </p>
        <h2 id="service-contract">サービスを獲得する前に契約を定義する</h2>
        <p>
          出発点は <code>application/effront.ts</code> の{" "}
          <code>Application.effront&lt;Services&gt;()</code> です。
          この関数はサービスやHTTPサーバーを起動せず、Page、Layout、Routesなどの定義を作るfactory群を返します。
          サービスの型は各定義が要求できるものを表し、実際の提供元は後で <code>EFFRONT.make</code>{" "}
          にLayerとして渡します。
        </p>
        <p>
          返り値の <code>EFFRONT&lt;ApplicationServices, AvailableServices&gt;</code>{" "}
          がサービスの型を2つに分けているのは、すべてのPageが同じ依存関係を必要とするわけではないためです。
          初期状態では両者は同じですが、middlewareを使うと、アプリケーションの基礎の契約を変えずに一つの枝で使えるサービスを増やせます。
        </p>
        <ul>
          <li>
            <code>ApplicationServices</code>{" "}
            は、アプリケーションのLayerが提供する基礎のサービスを表します。
          </li>
          <li>
            <code>AvailableServices</code> は、そのfactoryから作る定義が使えるサービスを表します。
            <code>PageFactory</code>{" "}
            では、描画のEffectと、パラメーターSchemaのデコードに必要なサービスの両方がこの範囲に含まれます。
          </li>
        </ul>
        <p>
          <code>application/definition.tsx</code> の <code>ApplicationLayerOptions</code>{" "}
          は、Servicesが <code>never</code> でなければLayerを必須にします。
          <code>never</code> ならLayerは省略でき、省略時には <code>Layer.empty</code> が使われます。
          ここで行うのは、宣言したサービスの契約に提供元を結び付けることであり、サービスの獲得ではありません。
        </p>
        <p>
          提供元自身が別のサービスに依存することもあります。
          <code>ApplicationDefinition&lt;Services, ApplicationError, Requirements&gt;</code>{" "}
          は、その入力をRequirementsとして、Layerの構築時のエラー型をApplicationErrorとして保持します。
          Requirementsが、そのままPageで使えるサービスに加わるわけではありません。
          外部のServiceをPageに公開するには、たとえば <code>Layer.effect(Service, Service)</code>{" "}
          で既存のインスタンスを渡すように、アプリケーションのLayerから明示的に提供する必要があります。
        </p>
        <p>
          <code>EFFRONT.make</code> は、このLayerとrootのRoutesをまとめます。
          rootの契約は、Layoutがあること、Pageへのパスが少なくとも一つあること、予約済みのパスを使わないことを要求します。
          <code>makeApplication</code> はrootのidentityを確認し、<code>compileRouteGraph</code>{" "}
          を呼び、コンパイル済みのroutesをLayerとともに保存します。
          こうして、何を配信し、そのサービスをどう獲得するかを表す定義が、リクエスト処理に渡せる形でそろいます。
        </p>
        <h2 id="middleware-context">middlewareで一つの枝を拡張する</h2>
        <p>
          認証用middlewareが提供するサービスを、認証が必要な部分だけで使う場合を考えます。
          そのサービスを加える先は、基礎のApplicationServicesではなく、その枝のAvailableServicesです。
          <code>withMiddleware</code>{" "}
          は、その枝のfactory群を作り、追加のサービス型と、それを提供する必要があるmiddlewareを記録します。
        </p>
        <SourceExcerpt source={coreModelSources.middlewareScope} />
        <p>
          型のシグネチャーは、登録順に沿った依存関係の検査として読めます。
          <code>ApplicableMiddleware</code>{" "}
          は、次に追加するmiddlewareの要求が、すでにAvailableServicesで満たされている場合だけ登録を許します。
          返されるfactoryは、その利用可能な範囲に <code>MiddlewareProvidedServices</code>{" "}
          を加えます。
          実行時には、種別、identity、同じスコープ内に重複がないことを確認してから、新しいmiddleware配列とfactory群を返します。
          元のEFFRONT値は変わらないので、middlewareを持つ枝と持たない枝を共存させられます。
        </p>
        <p>
          登録は実行ではなく、<code>withMiddleware</code> も <code>provides</code>{" "}
          の型宣言も、Contextへサービスを注入しません。
          <code>application/middleware.ts</code>{" "}
          を通じて定義するhandlerが、包み込むHTTP応答のEffectに対して実際にサービスを提供する必要があります。
          拡張したfactoryから作られる定義は、リクエスト時に使うmiddlewareの鎖を保持します。
        </p>
        <p>
          この鎖には2つの実行経路があるため、middlewareの状態は <code>httpMiddleware</code> と{" "}
          <code>handler</code> の両方を保持します。 PageのGET／HEADではEffect
          HTTPのネイティブなmiddlewareを組み合わせ、HEADフォールバックなどのルーティング動作を保ちます。
          Server FunctionのPOSTでは、Reactが呼び出す参照をデコードして初めてスコープが分かるため、
          <code>applyMiddleware</code> が <code>reduceRight</code> でEffectをhandlerに包みます。
          先に登録したmiddlewareが外側になり、後のmiddlewareが必要とするサービスを提供できる順序です。
        </p>
        <h2 id="identity">関連する定義を同じアプリケーションに保つ</h2>
        <p>
          AvailableServicesを拡張しても、新しいアプリケーションが生まれるわけではありません。
          拡張した枝も元の枝も、同じRoutesにまとめ、同じアプリケーションの描画の仕組みを通じて実行できる必要があります。
          このつながりを保つため、一度の <code>Application.effront</code>{" "}
          呼び出しから派生するfactoryは、すべて同じidentityオブジェクトを共有します。
        </p>
        <SourceExcerpt source={coreModelSources.applicationIdentity} />
        <p>
          抜粋では、<code>make</code> がidentityをクロージャーに保持し、<code>makeEFFRONT</code>{" "}
          が各factoryへ渡しています。
          <code>allocateRouteScopeId</code>{" "}
          のカウンターも共有され、新しいRoutesのスコープごとに、アプリケーション内の番号を割り当てます。
          先ほどの <code>withMiddleware</code>{" "}
          の抜粋と比べると、新しいアプリケーションを作るのではなく、既存のidentity、番号を割り当てる関数、make関数を新しいfactory群へ渡していることが分かります。
        </p>
        <p>
          サービスの型が一致するだけでは、この関係は成立しません。
          <code>Application.effront</code>{" "}
          を別々に呼ぶと、Servicesの型が同じでもidentityは別々になります。
          <code>Routes.page</code>、<code>Routes.mount</code>、<code>makeApplication</code>{" "}
          などは、異なるidentityの混在をTypeErrorとして拒否します。
          これはリクエストの入力ではなく、定義同士の不正な接続を検出する検査です。
        </p>
        <p>
          <code>application/effront-identity.ts</code> では、<code>EFFRONTMember</code>{" "}
          がidentityと種別のsymbolキーを持ち、定義の所属を表します。
          identityには、Servicesを不変に扱う型の印と、そのアプリケーションの{" "}
          <code>renderRuntime</code> があります。
          このruntimeが、ここまでで組み立てた定義と、次に見るリクエスト時の実行を結び付けます。
        </p>
        <h2 id="runtime-boundary">リクエストの中で定義を実行する</h2>
        <p>
          リクエストを処理するとき、<code>server/application.ts</code>{" "}
          はアプリケーションのLayerとrendererのLayerを一緒に構築します。
          <code>RequestContextMiddleware</code>{" "}
          が、獲得したサービスをHTTPリクエストのContextへ合流させます。
          保存していた提供元から実際のサービスの値が得られ、さらにスコープ付きmiddlewareが、選ばれた定義に必要なサービスを追加できます。
        </p>
        <p>
          PageとLayoutはReactから呼ばれるため、このEffectの実行Contextへ接続する仕組みが必要です。
          <code>application/render-runtime.ts</code> では、<code>bind</code>{" "}
          がEffectの実行関数と有効なmiddlewareをAsyncLocalStorageに結び付けます。 定義側から呼ぶ{" "}
          <code>run</code> は、その情報を取り出して実行関数へEffectを渡します。
          runtimeが束縛されていない場合や、定義が要求するmiddlewareのどれかが有効でない場合は、TypeErrorを投げます。
          サービスの型が正しいことは契約の一部であり、描画にはアプリケーションのリクエスト用runtimeと必要なmiddlewareのスコープも欠かせません。
        </p>
        <p>
          ここまでで、factoryがサービスの要求を表し、Layerとmiddlewareが値を提供し、identityが定義を結び付け、render
          runtimeがReactの呼び出しをEffectの実行へ接続する、という全体のつながりを追えました。 続く{" "}
          <a href="/ja/architecture/implementation/routing">03. ルートの組み立て</a>{" "}
          では、HTTP側が使うmiddlewareと描画先をRoutesがどうまとめるかを見ます。
          <a href="/ja/architecture/implementation/request">リクエスト処理</a>{" "}
          ではサービスの寿命を、<a href="/ja/architecture/implementation/rendering">描画</a>{" "}
          ではReactとの境界の続きを追います。
        </p>
      </>
    ),
  },
  {
    slug: "/architecture/implementation/routing",
    title: "03. ルート定義からリクエストへ",
    description:
      "Routesがサーバーの描画先になる過程を追い、不正な定義を拒否する段階とPageのパラメーター検証が404を返す条件を読み解きます。",
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
          <code>/items/42</code>{" "}
          へのリクエストを処理するには、一致するPageだけでなく、そのPageを囲むLayoutやmiddlewareも必要です。
          Effrontは、リクエストを受け付ける前に、これらを1つの描画先にまとめます。
          この章では、その描画先からルート定義をさかのぼり、続いてリクエスト時のパラメーター検証までを追います。
          アプリケーション定義の誤りと、404を返すべきリクエストを区別できるようになることが目的です。
        </p>
        <h2 id="compilation">サーバーが受け取る描画先から読む</h2>
        <p>
          <code>Routes</code>{" "}
          はPageとマウントした子Routesの木を表す宣言であり、HTTPリクエストを照合する仕組みそのものではありません。
          <code>EFFRONT.make</code> の実行時に、<code>application/route-graph.ts</code> の{" "}
          <code>compileRouteGraph</code> がこの木を次の描画先の配列に変換します。
          各描画先は、完全なパスパターン、Pageの内部状態、ルートのmiddlewareの鎖、UIを組み立てるためのLayout／Loadingのスコープを保持します。
        </p>
        <SourceExcerpt source={coreModelSources.compiledDestination} />
        <p>
          たとえば、<code>/:id</code> にPageを宣言した子Routesを <code>/items</code>{" "}
          の下にマウントすると、パターンは <code>/items/:id</code> になります。
          走査では親のスコープを子へ引き継ぎ、子RoutesにLayoutかLoadingがある場合にだけスコープを追加します。
          パスをまとめるためだけのRoutesは、描画の境界を増やしません。 追加するスコープのIDは宣言の{" "}
          <code>scopeId</code>{" "}
          とマウント先の接頭辞を組み合わせるため、同じ宣言を別のパスにマウントした場合も区別できます。
        </p>
        <SourceExcerpt source={coreModelSources.routeTraversal} />
        <p>
          このループは照合の優先順位ではなく、走査の順序として読んでください。
          現在のRoutesのPageを登録順に追加してから、マウント先を登録順にたどります。
          Pageとマウントは別々の配列に入るため、<code>page</code> と <code>mount</code>{" "}
          の呼び出しを交互に書いても、その全体の呼び出し順がグラフに残るわけではありません。
          ここで静的パスと動的パスを並べ替える処理もなく、HTTPの照合はEffect HTTPが担います。
        </p>
        <p>
          走査ではルートのmiddlewareも解決します。
          <code>resolveRouteMiddleware</code>{" "}
          は継承した鎖を保持し、現在の宣言との共通接頭辞を除いた残りを追加します。
          解決後の鎖に同じmiddlewareが重複していれば <code>TypeError</code> です。
          また、rootにはLayoutが必要で、完成したグラフには少なくとも1つのPageが必要です。
          検査を通過すると、コンパイラーは空でない描画先の配列をfreezeして返します。
          サーバーは、リクエストごとにRoutesの木をたどり直さずに、この配列を利用できます。
        </p>
        <h2 id="route-contract">URLから取り出した値をPageの入力につなぐ</h2>
        <p>
          グラフにどのような定義を渡せるかは、<code>application/routes.ts</code> で確認できます。
          <code>page</code> と <code>mount</code>{" "}
          は、呼び出すたびに新しいRoutes定義を返し、元の定義を書き換えません。
          <code>RoutesDefinition</code>{" "}
          はLayoutの有無、登録済みのパス、照合上の形を型として保持します。
          後続の呼び出しは、それまでに組み立てた定義と照らし合わせて追加内容を検査できます。
        </p>
        <p>
          <code>/items/:id</code> では、<code>MatchingPageParams</code> が、Schemaのエンコード側に{" "}
          <code>id</code> キーを持つパラメーター付きPageを要求します。
          パスの名前が対応するのはSchemaの <code>Encoded</code>{" "}
          側のキーであり、Pageの描画が受け取るのはデコード後の <code>Type</code> 側です。
          そのため、Schemaで取得した値を変換したり出力のキー名を変えたりしても、URLのパラメーター名は変わりません。
          静的パスには、パラメーターSchemaを持たないPageが必要です。
        </p>
        <p>
          型の検査と実行時の検査は、同じ処理を繰り返すのではなく、互いを補います。
          実行時の登録処理は、パスの文法、Pageが同じEFFRONTインスタンスに属すること、ルートパラメーターとSchemaの有無が対応することを確認します。
          パラメーター名とSchemaのエンコード側のキーをすべて比較する型レベルの検査までは、繰り返しません。
        </p>
        <p>
          パスの文法は、<code>application/route-path.ts</code> の <code>ValidRoutePath</code> と{" "}
          <code>analyzeRoutePath</code> で型と実行時を対にして定めています。 宣言は <code>/</code>{" "}
          で始まり、名前付きセグメントに <code>:id</code> を使い、末尾には <code>*path</code>{" "}
          のような名前付きcatch-allを置けます。 rootの <code>/</code>{" "}
          を除き、空セグメントや末尾のスラッシュは使えません。
          ドットセグメント、パラメーター名の重複、クエリー文字列、末尾のcatch-all以外のワイルドカードも無効です。
          マウントの接頭辞は静的である必要があり、子Routesは空でなく、同じEFFRONTインスタンスに属していなければなりません。
        </p>
        <h2 id="collisions">アプリケーションの組み立て時の失敗を見分ける</h2>
        <p>
          文法が正しいパスでも、登録済みのパスと衝突することがあります。
          Effrontは、静的セグメントを小文字にし、パラメーター名を取り除いた「照合上の形」を比較します。
          次の例のように形が重複するものを拒否しますが、パターンの一致範囲が重なる組み合わせをすべて禁止するわけではありません。
        </p>
        <ul>
          <li>
            <code>/items/:id</code> と <code>/items/:slug</code>{" "}
            は、パラメーター名を変えても形が変わらないため衝突します。
          </li>
          <li>
            <code>/About</code> と <code>/about</code>{" "}
            は、形の比較で大文字小文字を区別しないため衝突します。
          </li>
          <li>
            <code>/manual/*path</code> は、catch-allが空文字列を取得できる <code>/manual</code>{" "}
            も予約します。
          </li>
          <li>
            <code>/items/new</code> と <code>/items/:id</code>{" "}
            は形が異なるため、この検査では共存できます。
          </li>
        </ul>
        <p>
          マウント時には、子のパスと接頭辞を結合してから検査します。
          そのため、マウント先のPageと親に直接登録したPageの衝突も検出できます。
          <code>joinRoutePaths</code> は <code>/</code>{" "}
          を特別扱いし、余分なスラッシュを追加しません。 型レベルの形の検査には、
          <code>TypeError</code> を投げる実行時の検査も対応しています。
        </p>
        <p>
          続いてコンパイラーは、結合後の最終的なパスを <code>validateUnreservedPath</code>{" "}
          で検査し、<code>/_effront</code> を保護します。 大文字小文字を問わず先頭セグメントが{" "}
          <code>_effront</code>{" "}
          のパスに加え、その名前空間を取得できる動的な先頭セグメントも拒否します。 したがって、
          <code>/:slug</code> はアプリケーションの最終的なパスにはできませんが、
          <code>/items/:slug</code> はこの予約領域の検査を通過します。
          これらはアプリケーションを組み立てるときのエラーであり、リクエストURLへのHTTP応答ではありません。
        </p>
        <h2 id="schema-and-http">ルートの照合とパラメーターの検証を分ける</h2>
        <p>
          組み立てが成功すると、<code>server/application.ts</code> の <code>makeRouteLayer</code>{" "}
          が、描画先ごとにGETとPOSTのハンドラーを <code>HttpRouter.add</code> で登録します。
          URLの照合と取得した値のデコードはEffect HTTPが担います。
          catch-allに対してEffrontが行うのは、ルーターの <code>*</code>{" "}
          の値を宣言したパラメーター名へ移し、値がない場合は空文字列を補うことだけです。
          描画処理は、PageのSchemaを適用する前に <code>HttpRouter.params</code>{" "}
          からこれらの値を読みます。
        </p>
        <SourceExcerpt source={coreModelSources.parameterValidation} />
        <p>
          パラメーター付きPageへの非POSTリクエストでは、Schemaのデコードの型付き失敗を本文なしの404に変換し、キャッシュ制御に{" "}
          <code>private, no-store</code> を付けます。 デコードが成功した場合は <code>Decoded</code>{" "}
          タグを渡すため、Pageコンポーネントは再デコードせずに値を描画関数へ渡せます。 たとえば{" "}
          <code>/items/not-a-number</code> は <code>/items/:id</code>{" "}
          に一致しても、PageのSchemaが数値にデコードできるIDを要求していれば、この404になります。
        </p>
        <p>
          この結果は、ルートに一致しない場合やURLの値を読み取る段階での失敗とは区別してください。
          それらは、このSchema失敗の処理の外で起きます。 POSTにも同じ事前検証は適用しません。
          POSTが描画に進む場合は <code>Encoded</code>{" "}
          のパラメーターを渡し、Pageコンポーネントが必要なデコードを行います。 Server
          Functionの入力や再描画のエラーは、GETのSchema失敗を404にする規則とは分けて追う必要があります。
        </p>
        <p>
          ここまでで、ルーティングの問題を宣言、グラフの組み立て、HTTPの照合、Pageのパラメーター検証のどの段階で調べるかを整理できました。
          リクエストのContextと寿命は{" "}
          <a href="/ja/architecture/implementation/request">リクエスト処理</a>
          、描画先のスコープがUIになる過程は{" "}
          <a href="/ja/architecture/implementation/rendering">描画</a> で追えます。
          <a href="/ja/architecture/implementation/server-functions">Server Functions</a>{" "}
          の章では、POST固有の処理を読み進めます。
        </p>
      </>
    ),
  },
];
