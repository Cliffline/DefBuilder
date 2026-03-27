# Documentation

![Last Updated](https://img.shields.io/github/last-commit/Cliffline/DefBuilder?path=docs/README.md&display_timestamp=committer&label=last%20updated&style=flat-square)

This directory contains the project reference wiki for DefBuilder.

The Steam Inventory reference pages are written in English and stay focused on editor-relevant rules, field relationships, and validation behavior. Narrative sections summarize the Steamworks documentation. Official ItemDef format examples are included in full where exact sample payloads matter.

## Sections

- [Steam Inventory Reference](reference/steam-inventory/README.md)

## Writing Rules

- Treat Steamworks documentation as the canonical source.
- Keep narrative sections concise and present-focused.
- Preserve exact syntax where paraphrasing would change the rule.
- Label official examples clearly and keep the source URL close to the example.
- Add a file-specific `last updated` badge to the top of every Markdown page.
- Start new documentation pages from [templates/reference-page-template.md](templates/reference-page-template.md).

## Badge Pattern

Use this Shields.io pattern and replace the `path` value with the Markdown file path inside the repository:

```md
![Last Updated](https://img.shields.io/github/last-commit/Cliffline/DefBuilder?path=docs/path/to/page.md&display_timestamp=committer&label=last%20updated&style=flat-square)
```
