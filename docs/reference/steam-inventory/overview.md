# Steam Inventory Service Overview

![Last Updated](https://img.shields.io/github/last-commit/Cliffline/DefBuilder?path=docs/reference/steam-inventory/overview.md&display_timestamp=committer&label=last%20updated&style=flat-square)

Source: https://partner.steamgames.com/doc/features/inventory

## What This Service Does

Steam Inventory Service provides persistent player inventories without requiring a custom inventory backend for the basic feature set. It supports item definitions, inventory retrieval, item drops, exchanges, purchases, and Steam-hosted purchase flows.

For DefBuilder, this page matters because it defines the product boundary. The editor needs to model Steam ItemDefs first, then support the relationships that make those ItemDefs usable in inventory, exchange, and store flows.

## Trust Model

Steam documents two operating modes:

- Client-only usage, where the game client talks to Steam directly.
- Trusted-server usage, where a secure backend can grant specific items or perform privileged operations.

The trust boundary shapes editor behavior:

- Fields that imply trusted grants should be explained clearly.
- Client-safe flows such as playtime drops, promo checks, and exchange recipes should be distinguishable from privileged workflows.
- Validation should warn when a design assumes a trusted server but the schema does not express that cleanly.

## Implementation Flow

Steam's documented implementation flow is straightforward:

1. Create and upload ItemDefs.
2. Enable Inventory Service.
3. Download user inventory with `ISteamInventory::GetAllItems`.
4. Generate test items with `ISteamInventory::GenerateItems`.
5. Optionally grant playtime drops with `ISteamInventory::TriggerItemDrop`.
6. Optionally sell items through the Item Store, purchase APIs, or Steam-hosted web purchase flows.

DefBuilder should treat step 1 as the primary authoring workflow and treat the remaining steps as downstream integration context.

## Interfaces DefBuilder Needs To Respect

### Client API

The main API surface is `ISteamInventory`.

Editor-relevant implications:

- Item types such as `generator`, `playtimegenerator`, and `tag_generator` are not abstract metadata. They change runtime behavior.
- Exchange, promo, and pricing fields are consumed by Steam APIs and need exact syntax.
- Result properties such as tags and dynamic properties inform how users expect authored data to behave.

### Web API

The privileged web surface is `IInventoryService`.

Editor-relevant implications:

- Some workflows assume a secure publisher key.
- Dynamic property mutation and other server-side actions should be documented as secure-only operations.
- DefBuilder can plan future export or integration features around these endpoints, but the schema editor should not blur trusted and untrusted actions.

### Web Functions

Steam also exposes hosted purchase flows:

- `ItemCart` for multi-item purchases.
- `BuyItem` for a single sellable ItemDef.

These functions depend on correctly authored sellable items, price data, and visibility rules.

## DefBuilder Feature Implications

The first implementation wave of DefBuilder should be able to:

- author ItemDefs as structured data rather than freeform JSON only
- represent item type semantics directly
- validate syntax-heavy fields such as `bundle`, `exchange`, `promo`, and `price`
- distinguish inventory-facing metadata from store-facing metadata
- preserve unknown extension fields without destructive normalization

## Related Pages

- [schema.md](schema.md)
- [validation.md](validation.md)
- [official-sources.md](official-sources.md)
