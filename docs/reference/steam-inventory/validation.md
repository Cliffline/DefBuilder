# Steam Inventory Validation Notes

![Last Updated](https://img.shields.io/github/last-commit/Cliffline/DefBuilder?path=docs/reference/steam-inventory/validation.md&display_timestamp=committer&label=last%20updated&style=flat-square)

Sources:

- https://partner.steamgames.com/doc/features/inventory
- https://partner.steamgames.com/doc/features/inventory/schema
- https://partner.steamgames.com/doc/features/inventory/dynamicproperties
- https://partner.steamgames.com/doc/features/inventory/itemtags
- https://partner.steamgames.com/doc/features/inventory/tools

## Goal

This page lists the validation behavior DefBuilder should implement or at least explain clearly. Steam accepts flexible data, but many fields carry exact formatting rules or runtime assumptions that are easy to author incorrectly.

## High-Value Structural Checks

### Required Core Fields

Every ItemDef should have:

- `itemdefid`
- `type`

In practice, most user-facing items also need name and icon fields if they are meant to appear cleanly in inventory or store UIs.

### Item Type Constraints

`type` must be one of:

- `item`
- `bundle`
- `generator`
- `playtimegenerator`
- `tag_generator`

Validation should reject unknown built-in types unless the editor is explicitly operating in a permissive raw mode.

### Mutually Exclusive Pricing Fields

Steam states that `price` and `price_category` are alternatives. Validation should flag any ItemDef that sets both.

## Syntax-Sensitive Fields

### Bundle

Validation should check:

- semicolon-separated recipes
- numeric ItemDef tokens
- optional `xN` quantity or weight suffix
- positive integer quantities

### Exchange

Validation should check:

- semicolon-separated recipe alternatives
- comma-separated materials within each recipe
- itemdef materials using `itemdefid` or `itemdefidxN`
- tag materials using `tag:value` or `tag:value*N`

Validation should also warn when an exchange targets a type that makes little sense for the authored workflow.

### Promo

Validation should check:

- `owns:<appid>`
- `ach:<achievement>`
- `played:<appid>/<minutes>`
- `manual`

If `drop_start_time` is present, validate the `YYYYMMDDTHHMMSSZ` timestamp format.

### Price

Validation should check:

- version prefix `1;`
- uppercase three-letter currency codes
- integer amount tokens
- correctly formed date ranges
- descending date-range ordering

## Cross-Field Checks

### Bundle and Generator Semantics

- `bundle` is required for `bundle`, `generator`, and `playtimegenerator` to be useful.
- `container_contents_generator` should point to a generator-like definition.
- Selling a random chest directly as `generator` is the wrong authored pattern according to Steam guidance. The sellable item should be an `item`, while opening behavior is modeled through exchange into a generator.

### Playtime Drop Controls

- `drop_limit` only matters when `use_drop_limit` is true.
- `drop_window` and `drop_max_per_window` only make sense when `use_drop_window` is true.
- A playtime drop configuration without windowing may be technically valid but should produce a design warning because it can enable farming more easily.

### Store Visibility

- `store_hidden` affects sellable visibility in the hosted item store.
- `hidden` removes the ItemDef from client display and purchase visibility.
- `purchase_limit` only applies to `item` types.

### Localized Fields

- Tag localization requires at least an English visible string in Steamworks configuration.
- Localized name and description suffixes should be grouped by base field and locale.
- Editors should not assume only English and German examples exist.

## Tags and Dynamic Properties

### Tag Validation

Steam's `tags` field uses `category:value` pairs joined by semicolons. Validation should check:

- each pair contains exactly one category/value separator
- category and value tokens are not empty
- the list does not contain malformed separators

### Tag Generator Validation

For `tag_generator` definitions:

- require `tag_generator_name`
- require `tag_generator_values`
- validate `tag_generator_values` as semicolon-separated `value[:chance]` entries

For downstream items:

- validate `tag_generators` as a semicolon-separated list of referenced ItemDef IDs

### Dynamic Property Constraints

Steam documents these important limits:

- at most 100 item updates per user per call
- dynamic property JSON is limited to 1024 bytes per item

Dynamic properties are mutable and are cleared when an item is traded. Tags are not the same thing and should not be modeled as interchangeable with dynamic properties.

## Tool-Related Checks

When authoring `tag_tool` behavior, the editor should validate:

- target items define `allowed_tags_from_tools` for the relevant categories
- `tags_to_remove_on_tool_use` is present when the design expects replacement rather than accumulation
- exchange-based tool application keeps the output ItemDef aligned with the target item type

## Warning-Level Design Heuristics

The following cases are worth warning about even if they are syntactically valid:

- public-facing sellable items without icons
- bundle items without individually priced contents when bundle revenue allocation matters
- store-facing items that are both priced and hidden from store display without a clear reason
- localized variants with missing base English fields
- generators with very opaque weights and no descriptive name or linked container item

## DefBuilder Priorities

The first validation engine for DefBuilder should prioritize:

1. syntax correctness
2. cross-field consistency
3. Steam-guidance warnings
4. preservation of extension fields

## Related Pages

- [schema.md](schema.md)
- [overview.md](overview.md)
- [official-sources.md](official-sources.md)
