# @effront/gitignore-patterns development

## Repository structure

- `src/index.ts` contains filesystem traversal and delegates Gitignore grammar to `ignore`.
- `src/index.test.ts` compares traversal behavior with real Git.
- `tests/cli.test.ts` owns real formatter/linter acceptance through isolated Git and pnpm workspace roots.

## Development commands

- From this package, `vp run build` compiles JavaScript and declarations with `tsconfig.build.json`. This package's `prepare` and `prepack` lifecycle scripts run the same TypeScript build.
- From this package, `vp run test` builds the exports and runs both unit and actual VitePlus CLI integration tests.
- For local-link consumers, use the [repository preparation commands](../../AGENTS.md#development-commands), then `vp run build` here before the consumer links this directory.

## Architecture

- Preserve reachable-directory traversal, nested rule precedence, and pruning of ignored parents. Generate escaped, root-anchored positive literals from actual ignored entries rather than flattening raw Gitignore rules.
- Do not traverse symbolic links or load symbolic `.gitignore` files. Exclude `.git` metadata from both scanning and output.
- Keep parser matching separate from VitePlus's own native exclusions. Generated patterns cannot undo additional exclusions imposed by native loaders.
- CLI fixtures remove native Gitignore inputs after generation so those inputs cannot mask generator failures.

## Package-specific rules

- This package is local tooling, excluded from Effront's npm release filter even though its manifest does not set `private: true`.
- Keep the current package-owned TypeScript build separate from the public framework packages' Vite pack tasks.

## Task-specific documentation

- When changing traversal, escaping, CLI acceptance, or supported matching claims, consult [validation boundaries and reproduction commands](docs/VALIDATION.md).

_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._
