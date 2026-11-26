import type { ReactNode } from "react";

import { renderArticleList } from "./core-article-list.tsx";
import { coreModelSources } from "./core-model-sources.ts";
import { SourceExcerpt } from "./core-source.tsx";
import type { DocPage } from "./types.ts";

const renderIntroduction = (): ReactNode => (
  <p>
    描画先はPage、完全なパス、middleware、周囲のLayout／Loadingスコープをまとめたものです。
    Effrontはリクエストを受け付ける前に描画先を組み立て、不正な宣言と、ルートには一致してもPageのパラメーター検証に失敗するURLを区別します。
  </p>
);

const renderCompilation = (): ReactNode => (
  <>
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
  </>
);

const renderRouteContractList = (): ReactNode =>
  renderArticleList("ul", [
    {
      content: (
        <>
          パスは <code>/</code> で始め、<code>:id</code>{" "}
          のような名前付きセグメントを使います。末尾には <code>*path</code>{" "}
          のような名前付きcatch-allを置けます。
        </>
      ),
      id: "segments",
    },
    {
      content: (
        <>
          rootの <code>/</code>{" "}
          を除き、空セグメントと末尾のスラッシュは無効です。ドットセグメント、パラメーター名の重複、クエリー文字列、その他のワイルドカード形式も無効です。
        </>
      ),
      id: "invalid-paths",
    },
    {
      content: (
        <>
          マウントの接頭辞は静的である必要があります。子Routesは空でなく、アプリケーションidentityを共有する必要があります。
        </>
      ),
      id: "mounts",
    },
  ]);

const renderRouteContract = (): ReactNode => (
  <>
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
    {renderRouteContractList()}
  </>
);

const renderCollisionsList = (): ReactNode =>
  renderArticleList("ul", [
    {
      content: (
        <>
          <code>/items/:id</code> と <code>/items/:slug</code> は衝突します。
        </>
      ),
      id: "parameters",
    },
    {
      content: (
        <>
          <code>/About</code> と <code>/about</code> は衝突します。
        </>
      ),
      id: "letter-case",
    },
    {
      content: (
        <>
          <code>/manual/*path</code> は、取得値が空になる <code>/manual</code> も予約します。
        </>
      ),
      id: "catch-all",
    },
    {
      content: (
        <>
          <code>/items/new</code> と <code>/items/:id</code> は形が異なるため共存できます。
        </>
      ),
      id: "static-and-dynamic",
    },
  ]);

const renderCollisions = (): ReactNode => (
  <>
    <h2 id="collisions">アプリケーションの組み立て時の失敗を見分ける</h2>
    <p>
      衝突検査は静的セグメントを小文字にし、パラメーター名を除いて照合上の形を比較します。
      拒否するのは同じ形であり、一致範囲が重なるすべての組み合わせではありません。
    </p>
    {renderCollisionsList()}
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
  </>
);

const renderSchemaAndHttp = (): ReactNode => (
  <>
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
      パラメーターを渡し、Pageでの二重デコードを防ぎます。 たとえば <code>/items/not-a-number</code>{" "}
      は <code>/items/:id</code> に一致しても、IDを数値にデコードするSchemaには失敗します。
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
);

const renderRouting = (): ReactNode => (
  <>
    {renderIntroduction()}
    {renderCompilation()}
    {renderRouteContract()}
    {renderCollisions()}
    {renderSchemaAndHttp()}
  </>
);

export const routingPage = {
  content: renderRouting,
  description:
    "ルート定義からリクエストの振り分け、ページのパラメーター検証までの実装を読み解きます。",
  group: "実装解説",
  headings: [
    { id: "compilation", title: "サーバーが受け取る描画先から読む" },
    { id: "route-contract", title: "URLから取り出した値をPageの入力につなぐ" },
    { id: "collisions", title: "アプリケーションの組み立て時の失敗を見分ける" },
    { id: "schema-and-http", title: "ルートの照合とパラメーターの検証を分ける" },
  ],
  section: "アーキテクチャ",
  slug: "/architecture/implementation/routing",
  title: "03. ルート定義からリクエストへ",
} satisfies DocPage;
