import { expect } from "@playwright/test";
import type { JSHandle, Page } from "@playwright/test";

export interface AnimationSample {
  keyframes: ComputedKeyframe[];
  name: string;
  pageStyle: string | null;
  playState: AnimationPlayState;
  progress: number | null;
  pseudoElement: string | null;
}

const initialProgress = 0;
const completeProgress = 1;
const observationFrames = 45;
const layoutSelector = '[aria-label="Persistent transition layout"]';

interface AnimationObservation {
  frames: number;
  layout: Element | null;
  running: boolean;
  samples: AnimationSample[];
}

export type TransitionObservation = JSHandle<AnimationObservation>;

export const observeAnimations = async (page: Page): Promise<TransitionObservation> =>
  page.evaluateHandle((selector): AnimationObservation => {
    const samples: AnimationSample[] = [];
    const observation = {
      frames: 0,
      layout: document.querySelector(selector),
      running: true,
      samples,
    };
    // oxlint-disable-next-line unicorn/no-null -- Preserve null for missing browser measurements in JSON evidence.
    const missingMeasurement = null;
    const recordSample = (animation: Animation): void => {
      const { effect } = animation;
      if (!(effect instanceof KeyframeEffect)) {
        return;
      }
      const name = animation instanceof CSSAnimation ? animation.animationName : animation.id;
      if (effect.pseudoElement?.includes("view-transition") !== true && !name.startsWith("demo-")) {
        return;
      }
      const pageCard = document.querySelector(".transition-card");
      samples.push({
        keyframes: effect.getKeyframes(),
        name,
        pageStyle: pageCard?.getAttribute("style") ?? missingMeasurement,
        playState: animation.playState,
        progress: effect.getComputedTiming().progress ?? missingMeasurement,
        pseudoElement: effect.pseudoElement,
      });
    };
    // Sample native animations without replacing the browser transition API.
    const observe = (): void => {
      if (!observation.running) {
        return;
      }
      observation.frames += 1;
      document.getAnimations().forEach((animation) => {
        recordSample(animation);
      });
      requestAnimationFrame(observe);
    };
    requestAnimationFrame(observe);
    return observation;
  }, layoutSelector);

export const finishObservation = async (
  page: Page,
  observation: TransitionObservation,
): Promise<AnimationSample[]> => {
  const start = await observation.evaluate(({ frames }) => frames);
  // Allow React to create the pseudo-element animation tree after the DOM commit.
  await page.waitForFunction(({ evidence, finish }) => evidence.frames >= finish, {
    evidence: observation,
    finish: start + observationFrames,
  });
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running"),
  );
  return observation.evaluate((evidence) => {
    evidence.running = false;
    return evidence.samples;
  });
};

export const assertLayoutRetained = async (
  page: Page,
  observation: TransitionObservation,
): Promise<void> => {
  await expect(page.getByRole("button", { exact: true, name: "Count: 1" })).toBeVisible();
  expect(
    await observation.evaluate(
      ({ layout }, selector) => layout === document.querySelector(selector),
      layoutSelector,
    ),
  ).toBe(true);
};

export const isPlaying = ({ playState, progress }: AnimationSample): boolean => {
  const currentProgress = progress ?? initialProgress;
  return (
    playState === "running" &&
    currentProgress > initialProgress &&
    currentProgress < completeProgress
  );
};

export const allowMotionPreferenceUpdate = async (page: Page): Promise<void> => {
  // Let the media-query subscription and its React update commit.
  await page.evaluate(async () => {
    const { promise, resolve } = Promise.withResolvers<number>();
    requestAnimationFrame(() => {
      requestAnimationFrame((timestamp) => {
        resolve(timestamp);
      });
    });
    await promise;
  });
};
