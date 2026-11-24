import { describe, expect, test } from "@effect/vitest";

import { Application } from "./effront.ts";

const EFFRONT = Application.effront();

describe("eFFRONT.Loading.make", () => {
  test("runs the synchronous fallback renderer", () => {
    const render = () => <p>Loading...</p>;
    const RootLoading = EFFRONT.Loading.make({ render });

    expect(RootLoading()).toStrictEqual(<p>Loading...</p>);
  });
});
