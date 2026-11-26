import { afterEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";

import { navigationMode } from "./browser-capabilities.ts";

describe("browser navigation capabilities", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.effect("uses document navigation without the Navigation API", () =>
    Effect.gen(function* () {
      vi.stubGlobal("window", {});
      expect(yield* navigationMode).toBe("Document");
    }),
  );

  it.effect("uses document navigation without navigation precommit", () =>
    Effect.gen(function* () {
      vi.stubGlobal("window", { navigation: new EventTarget() });
      expect(yield* navigationMode).toBe("Document");
    }),
  );

  it.effect("uses client navigation when both APIs are available", () =>
    Effect.gen(function* () {
      vi.stubGlobal("window", {
        NavigationPrecommitController: EventTarget,
        navigation: new EventTarget(),
      });
      expect(yield* navigationMode).toBe("Client");
    }),
  );
});
