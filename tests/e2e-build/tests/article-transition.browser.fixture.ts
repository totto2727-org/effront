// oxlint-disable-next-line rules/no-node-imports -- Playwright writes native browser evidence to its test artifact directory on Node.
import { writeFile } from "node:fs/promises";
import { expect } from "@playwright/test";
import type { JSHandle, Page, TestInfo } from "@playwright/test";

type CaptureTarget = Readonly<{ containsSidebar: boolean; page: string | undefined; tag: string }>;
type AnimationSample = Readonly<{ progress: number; pseudoElement: string }>;
type CaptureObservation = Readonly<{ observer: MutationObserver; targets: CaptureTarget[] }>;
interface AnimationObservation {
  running: boolean;
  samples: AnimationSample[];
}

const firstProgress = 0;
const lastProgress = 1;
const minimumSampleCount = 0;
const evidenceIndent = 2;
// oxlint-disable-next-line unicorn/no-null -- JSON.stringify accepts null to use its default replacer.
const defaultJsonReplacer = null;

const observeCaptureTargets = async (page: Page): Promise<JSHandle<CaptureObservation>> =>
  page.evaluateHandle(() => {
    const targets: CaptureTarget[] = [];
    // React may remove capture styles before the pseudo-element animations finish.
    // Native mutations expose capture targets without replacing the transition API.
    const observer = new MutationObserver((records) => {
      const sidebar = document.querySelector('[data-sidebar="sidebar"]');
      records.forEach(({ oldValue, target }) => {
        const currentStyle = target instanceof HTMLElement ? target.getAttribute("style") : "";
        const styles = `${oldValue ?? ""};${currentStyle ?? ""}`;
        if (target instanceof HTMLElement && /view-transition-name:\s*effront-page/u.test(styles)) {
          targets.push({
            containsSidebar: Boolean(sidebar && target.contains(sidebar)),
            page: target.dataset["docPage"],
            tag: target.tagName,
          });
        }
      });
    });
    observer.observe(document.documentElement, {
      attributeFilter: ["style"],
      attributeOldValue: true,
      attributes: true,
      subtree: true,
    });
    return { observer, targets };
  });

const observeAnimationSamples = async (page: Page): Promise<JSHandle<AnimationObservation>> =>
  page.evaluateHandle(
    ({ first, last }) => {
      const samples: AnimationSample[] = [];
      const evidence = { running: true, samples };
      const sample = (): void => {
        if (!evidence.running) {
          return;
        }
        document.getAnimations().forEach(({ effect, playState }) => {
          if (!(effect instanceof KeyframeEffect) || playState !== "running") {
            return;
          }
          const pseudoElement = effect.pseudoElement ?? "";
          const progress = effect.getComputedTiming().progress ?? first;
          if (pseudoElement.includes("effront-page") && progress > first && progress < last) {
            samples.push({ progress, pseudoElement });
          }
        });
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      return evidence;
    },
    { first: firstProgress, last: lastProgress },
  );

type ArticleTransition = Readonly<{
  animation: JSHandle<AnimationObservation>;
  captures: JSHandle<CaptureObservation>;
}>;

export const observeArticleTransition = async (page: Page): Promise<ArticleTransition> => {
  const captures = await observeCaptureTargets(page);
  const animation = await observeAnimationSamples(page);
  return { animation, captures };
};

export const verifyArticleTransition = async (
  page: Page,
  { animation, captures }: ArticleTransition,
  { destination, testInfo }: Readonly<{ destination: string; testInfo: TestInfo }>,
): Promise<void> => {
  await expect
    .poll(async () => animation.evaluate((evidence) => evidence.samples.length))
    .toBeGreaterThan(minimumSampleCount);
  await page.waitForFunction(() =>
    document.getAnimations().every((current) => current.playState !== "running"),
  );
  const samples = await animation.evaluate((evidence) => {
    evidence.running = false;
    return evidence.samples;
  });
  const targets = await captures.evaluate((evidence) => {
    evidence.observer.disconnect();
    return evidence.targets;
  });
  expect(
    targets.length,
    "Observe real named capture elements for the native animation",
  ).toBeGreaterThan(minimumSampleCount);
  targets.forEach((target) => {
    expect(target.tag, "Only the article belongs to the effront-page capture").toBe("ARTICLE");
    expect(["/manual", destination]).toContain(target.page);
    expect(target.containsSidebar, "The article capture must exclude the sidebar").toBe(false);
  });
  const evidencePath = testInfo.outputPath("article-only-transition.json");
  await writeFile(
    evidencePath,
    JSON.stringify({ samples, targets }, defaultJsonReplacer, evidenceIndent),
  );
  await testInfo.attach("article-only-transition", {
    contentType: "application/json",
    path: evidencePath,
  });
};
