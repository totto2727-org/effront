import type { Locator } from "@playwright/test";

type Color = Readonly<{ blue: number; green: number; red: number }>;
type AlertPalette = Readonly<{
  background: Color;
  body: Color;
  border: string;
  title: Color;
  titleColor: string;
}>;

const pixelSample = { blackChannel: 0, height: 1, width: 1, x: 0, y: 0 };

const readAlertPalette = async (alert: Locator): Promise<AlertPalette> =>
  alert.evaluate((element, { blackChannel, height, width, x, y }): AlertPalette => {
    const title = element.querySelector(".docs-alert-title");
    const body = element.querySelector(".docs-alert-body");
    if (!title || !body) {
      // oxlint-disable-next-line rules/require-tagged-error -- Playwright serializes this browser callback without application modules.
      throw new TypeError("Alert fixture structure is missing");
    }
    const context = document.createElement("canvas").getContext("2d");
    if (!context) {
      // oxlint-disable-next-line rules/require-tagged-error -- Canvas failures cross the Playwright browser boundary as native errors.
      throw new TypeError("Canvas color conversion is unavailable");
    }
    const channels = (color: string): Color => {
      context.fillStyle = color;
      context.fillRect(x, y, width, height);
      const [red = blackChannel, green = blackChannel, blue = blackChannel] = context.getImageData(
        x,
        y,
        width,
        height,
      ).data;
      return { blue, green, red };
    };
    const titleColor = getComputedStyle(title).color;
    return {
      background: channels(
        getComputedStyle(document.documentElement).getPropertyValue("--background"),
      ),
      body: channels(getComputedStyle(body).color),
      border: getComputedStyle(element).borderInlineStartColor,
      title: channels(titleColor),
      titleColor,
    };
  }, pixelSample);

const fullChannel = 255;
const linearThreshold = 0.04045;
const linearScale = 12.92;
const nonlinearOffset = 0.055;
const nonlinearScale = 1.055;
const nonlinearPower = 2.4;
const contrastOffset = 0.05;
const redWeight = 0.2126;
const greenWeight = 0.7152;
const blueWeight = 0.0722;

const linearChannel = (value: number): number => {
  const channel = value / fullChannel;
  return channel <= linearThreshold
    ? channel / linearScale
    : ((channel + nonlinearOffset) / nonlinearScale) ** nonlinearPower;
};

const luminance = ({ blue, green, red }: Color): number =>
  linearChannel(red) * redWeight +
  linearChannel(green) * greenWeight +
  linearChannel(blue) * blueWeight;

const contrast = (color: Color, background: number): number => {
  const foreground = luminance(color);
  return (
    (Math.max(foreground, background) + contrastOffset) /
    (Math.min(foreground, background) + contrastOffset)
  );
};

type AlertContrast = Readonly<{
  bodyContrast: number;
  border: string;
  title: string;
  titleContrast: number;
}>;

export const readAlertContrast = async (alert: Locator): Promise<AlertContrast> => {
  const palette = await readAlertPalette(alert);
  const background = luminance(palette.background);
  return {
    bodyContrast: contrast(palette.body, background),
    border: palette.border,
    title: palette.titleColor,
    titleContrast: contrast(palette.title, background),
  };
};
