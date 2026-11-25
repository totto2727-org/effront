import { describe, expect, test } from "@effect/vitest";
import type { JSX } from "react";

import { Application } from "./effront.ts";

const EFFRONT = Application.effront();
const render = (): JSX.Element => <p>Loading...</p>;

describe("eFFRONT.Loading.make", () => {
  test("runs the synchronous fallback renderer", () => {
    const RootLoading = EFFRONT.Loading.make({ render });

    expect(RootLoading()).toStrictEqual(<p>Loading...</p>);
  });
});
