import bash from "shiki/langs/bash.mjs";
import css from "shiki/langs/css.mjs";
import diff from "shiki/langs/diff.mjs";
import javascript from "shiki/langs/javascript.mjs";
import json from "shiki/langs/json.mjs";
import jsonc from "shiki/langs/jsonc.mjs";
import jsx from "shiki/langs/jsx.mjs";
import tsx from "shiki/langs/tsx.mjs";
import typescript from "shiki/langs/typescript.mjs";

// Static grammar registrations keep the RSC renderer free of network and WASM assets.
// https://shiki.style/guide/bundles#fine-grained-bundle
// https://shiki.style/guide/regex-engines#javascript-regexp-engine
export const codeBlockGrammars = [bash, css, diff, javascript, json, jsonc, jsx, tsx, typescript];
