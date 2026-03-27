# Official Sources

![Last Updated](https://img.shields.io/github/last-commit/Cliffline/DefBuilder?path=docs/reference/steam-inventory/official-sources.md&display_timestamp=committer&label=last%20updated&style=flat-square)

This page maps the local DefBuilder reference pages to their authoritative Steamworks documentation sources.

## Core Sources

- Overview: https://partner.steamgames.com/doc/features/inventory
- ItemDef schema: https://partner.steamgames.com/doc/features/inventory/schema
- Dynamic properties: https://partner.steamgames.com/doc/features/inventory/dynamicproperties
- Item tags: https://partner.steamgames.com/doc/features/inventory/itemtags
- Item tools: https://partner.steamgames.com/doc/features/inventory/tools
- Accessories: https://partner.steamgames.com/doc/features/inventory/accessories
- Item store: https://partner.steamgames.com/doc/features/inventory/itemstore
- Web functions: https://partner.steamgames.com/doc/features/inventory/webfunctions

## Local Page Mapping

| Local page | Primary source | Notes |
| --- | --- | --- |
| [overview.md](overview.md) | Inventory overview | Service model, trust boundary, implementation flow, API map |
| [schema.md](schema.md) | Inventory schema | Built-in types, exact field formats, pricing, exchange, promo, official ItemDef example |
| [validation.md](validation.md) | Inventory overview, schema, dynamic properties, item tags, tools | Editor-oriented validation and cross-field rules |

## Conflict Rule

If a local summary conflicts with Steamworks documentation, Steamworks documentation wins.

## Example Policy

DefBuilder keeps official ItemDef examples in full when exact example payloads are important to authoring or validation. Narrative explanation remains summary-oriented.
