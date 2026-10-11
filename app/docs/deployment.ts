export const docsStack = "effront-docs";
export const docsHostname = "effront.totto2727.dev";
export const productionStage = "production";

type DocsDeployment =
  | { kind: "production" }
  | { kind: "preview"; name: string }
  | { kind: "development" };

export function docsDeployment(stage: string): DocsDeployment {
  if (stage === productionStage) {
    return { kind: "production" };
  }
  if (stage.startsWith("pr-")) {
    if (!/^pr-[1-9]\d*$/.test(stage)) {
      throw new TypeError(`Invalid documentation preview stage: ${stage}`);
    }
    return { kind: "preview", name: stage };
  }
  return { kind: "development" };
}
