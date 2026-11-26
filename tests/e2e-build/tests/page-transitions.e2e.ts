// oxlint-disable-next-line rules/no-node-imports -- Playwright writes native animation samples to its local artifact directory on Node.
import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import {
  allowMotionPreferenceUpdate,
  assertLayoutRetained,
  finishObservation,
  isPlaying,
  observeAnimations,
} from "./page-transition.browser.fixture";
import type { AnimationSample, TransitionObservation } from "./page-transition.browser.fixture";

type AnimatedMode = "default" | "custom" | "typed";
type ExampleMode = AnimatedMode | "disabled";
type ExamplePage = "A" | "B";

const minimumAnimations = 0;
const evidenceIndent = 2;
// oxlint-disable-next-line unicorn/no-null -- Null selects JSON.stringify's default replacer.
const defaultJsonReplacer = null;

const expectExampleHeading = async (
  page: Page,
  mode: ExampleMode,
  destination: ExamplePage,
): Promise<void> => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${mode} page ${destination}`);
};

const visitExample = async (page: Page, mode: ExampleMode): Promise<TransitionObservation> => {
  await page.goto(`/transitions/${mode}-a`);
  await page.waitForLoadState("networkidle");
  await expectExampleHeading(page, mode, "A");
  await expect(page.locator(".transition-card")).toHaveCSS(
    "background-color",
    "rgb(219, 234, 254)",
  );
  await page.getByRole("button", { exact: true, name: "Count: 0" }).click();
  await expect(page.getByRole("button", { exact: true, name: "Count: 1" })).toBeVisible();
  return observeAnimations(page);
};

const expectExampleAddress = async (page: Page, mode: ExampleMode): Promise<void> => {
  await expect(page).toHaveURL(new RegExp(`/transitions/${mode}-b$`, "u"));
};

const clickNext = async (
  page: Page,
  mode: ExampleMode,
  destination: ExamplePage,
): Promise<void> => {
  await page.getByRole("link", { name: "Next example page" }).click();
  await expectExampleHeading(page, mode, destination);
};

const writeAnimationEvidence = async (
  samples: AnimationSample[],
  testInfo: TestInfo,
): Promise<void> => {
  const evidencePath = testInfo.outputPath("native-transition-animations.json");
  await writeFile(evidencePath, JSON.stringify(samples, defaultJsonReplacer, evidenceIndent));
  await testInfo.attach("native-transition-animations", {
    contentType: "application/json",
    path: evidencePath,
  });
};

const expectForwardAnimations = (playing: AnimationSample[], mode: AnimatedMode): void => {
  expect(playing.length).toBeGreaterThan(minimumAnimations);
  expect(playing.some((sample) => sample.pseudoElement?.includes("effront-page") === true)).toBe(
    true,
  );
  if (mode === "default") {
    expect(playing.some((sample) => sample.name.startsWith("demo-slide"))).toBe(false);
    expect(
      playing.some((sample) => sample.keyframes.some((keyframe) => keyframe["opacity"] === "0")),
    ).toBe(true);
    return;
  }
  const animation = mode === "typed" ? "demo-lift" : "demo-slide";
  expect(playing.some((sample) => sample.name === `${animation}-in`)).toBe(true);
  expect(playing.some((sample) => sample.name === `${animation}-out`)).toBe(true);
  expect(
    playing.some((sample) => sample.keyframes.some((keyframe) => Boolean(keyframe["transform"]))),
  ).toBe(true);
};

const expectBackwardAnimations = (samples: AnimationSample[], mode: AnimatedMode): void => {
  if (mode === "typed") {
    const backwardSamples = samples.filter((sample) => isPlaying(sample));
    expect(backwardSamples.some((sample) => sample.name === "demo-slide-in")).toBe(true);
    expect(backwardSamples.some((sample) => sample.name.startsWith("demo-lift"))).toBe(false);
  }
};

const verifyHistoryTraversal = async (page: Page, mode: AnimatedMode): Promise<void> => {
  const observation = await observeAnimations(page);
  await page.goBack();
  await expectExampleHeading(page, mode, "A");
  const samples = await finishObservation(page, observation);
  expectBackwardAnimations(samples, mode);
  await assertLayoutRetained(page, observation);
  await page.goForward();
  await expectExampleHeading(page, mode, "B");
  await assertLayoutRetained(page, observation);
};

const animatedModes: AnimatedMode[] = ["default", "custom", "typed"];
animatedModes.forEach((mode) => {
  test(`${mode} Page transition produces real animations and preserves the layout`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const observation = await visitExample(page, mode);
    await clickNext(page, mode, "B");
    await expectExampleAddress(page, mode);
    const samples = await finishObservation(page, observation);
    await writeAnimationEvidence(samples, testInfo);
    expectForwardAnimations(
      samples.filter((sample) => isPlaying(sample)),
      mode,
    );
    await assertLayoutRetained(page, observation);
    await verifyHistoryTraversal(page, mode);
  });
});

const verifyNavigationWithoutAnimations = async (
  page: Page,
  observation: TransitionObservation,
  mode: ExampleMode,
): Promise<void> => {
  await clickNext(page, mode, "B");
  await expectExampleAddress(page, mode);
  const samples = await finishObservation(page, observation);
  expect(samples.filter((sample) => isPlaying(sample))).toEqual([]);
  await assertLayoutRetained(page, observation);
};

test("Page opt-out navigates without page animations and retains layout state", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const observation = await visitExample(page, "disabled");
  await verifyNavigationWithoutAnimations(page, observation, "disabled");
});

const reducedMotionModes: AnimatedMode[] = ["default", "custom"];
reducedMotionModes.forEach((mode) => {
  test(`reduced motion suppresses ${mode} page animations without breaking navigation`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const observation = await visitExample(page, mode);
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
      true,
    );
    await verifyNavigationWithoutAnimations(page, observation, mode);
  });
});

const changeMotionPreference = async (
  page: Page,
  reducedMotion: "no-preference" | "reduce",
  retainedNote: string,
): Promise<void> => {
  const note = page.getByRole("textbox", { name: "Page note" });
  await note.fill(retainedNote);
  await page.emulateMedia({ reducedMotion });
  await allowMotionPreferenceUpdate(page);
  await expect(note).toHaveValue(retainedNote);
  await expect(note).toBeFocused();
};

test("responds to reduced-motion preference changes after hydration", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const reducedMotion = await visitExample(page, "default");
  await changeMotionPreference(page, "reduce", "Keep this page-local state");
  await verifyNavigationWithoutAnimations(page, reducedMotion, "default");
  await changeMotionPreference(page, "no-preference", "Keep state when motion returns");
  const resumedMotion = await observeAnimations(page);
  await clickNext(page, "default", "A");
  const samples = await finishObservation(page, resumedMotion);
  expect(samples.filter((sample) => isPlaying(sample)).length).toBeGreaterThan(minimumAnimations);
  await assertLayoutRetained(page, resumedMotion);
});

test("navigates and retains layout state when native View Transitions are unavailable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Remove the browser capability while preserving real Flight and React navigation.
  await page.addInitScript(() => {
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: undefined,
    });
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const observation = await visitExample(page, "default");
  expect(await page.evaluate(() => typeof document.startViewTransition)).toBe("undefined");
  await verifyNavigationWithoutAnimations(page, observation, "default");
  expect(errors).toEqual([]);
});

test("loads the shared example stylesheet on direct About entry", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("About");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(248, 250, 252)");
  await page.getByRole("link", { name: "Back home" }).click();
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.getByRole("button", { exact: true, name: "Count: 0" })).toBeVisible();
});
