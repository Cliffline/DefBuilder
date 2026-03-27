# Steam Inventory ItemDef Schema

![Last Updated](https://img.shields.io/github/last-commit/Cliffline/DefBuilder?path=docs/reference/steam-inventory/schema.md&display_timestamp=committer&label=last%20updated&style=flat-square)

Source: https://partner.steamgames.com/doc/features/inventory/schema

## Purpose

This page summarizes the ItemDef schema that DefBuilder needs to support and validate. It preserves exact formats where Steam expects token-level accuracy and includes the official schema example in full.

## Item Types

Steam documents these built-in ItemDef types:

- `item`: a concrete inventory item.
- `bundle`: expands into a fixed list of items and quantities.
- `generator`: expands into a weighted random item.
- `playtimegenerator`: a generator that can be granted through playtime drop evaluation.
- `tag_generator`: a special definition that contributes tags to downstream items.

These types should be first-class in DefBuilder because they affect which fields are valid, required, or meaningful.

## Core Property Groups

### Identity and Localization

Common identity fields:

- `appid`
- `itemdefid`
- `type`
- `name`
- `description`
- `display_type`

Localized values use suffixed field names such as `name_english` or `description_german`.

### Presentation and Media

Presentation fields include:

- `background_color`
- `name_color`
- `icon_url`
- `icon_url_large`

Steam expects public URLs for icons because the service downloads and caches them.

### Inventory and Market Flags

Important boolean flags include:

- `marketable`
- `tradable`
- `game_only`
- `hidden`
- `store_hidden`
- `auto_stack`

### Store and Purchase Metadata

Sellable items rely on:

- `price`
- `price_category`
- `store_tags`
- `store_images`
- `purchase_limit`
- `use_bundle_price`

### Drop, Promo, and Grant Control

Drop and promo behavior relies on:

- `promo`
- `drop_start_time`
- `drop_interval`
- `use_drop_limit`
- `drop_limit`
- `use_drop_window`
- `drop_window`
- `drop_max_per_window`
- `granted_manually`

### Tags and Generated Tags

Tag-related fields include:

- `tags`
- `tag_generators`
- `tag_generator_name`
- `tag_generator_values`

### Complex Relationships

Complex behavior relies on:

- `bundle`
- `exchange`
- `container_contents_generator`

## Exact Formats

### Bundle Format

Official format:

```text
bundle_def : item_recipe , { ";" , item_recipe }
item_recipe : item_def , [ "x" , quantity ]
```

Steam uses the `bundle` field for `bundle`, `generator`, and `playtimegenerator` types. For bundles, quantities are literal counts. For generators, quantities are relative weights.

### Exchange Format

Official format:

```text
<exchange>: <recipe> { ";" <recipe> }
<recipe>: <material> { "," <material> }
<material>: <item_def_descriptor> / <item_tag_descriptor>
<item_def_descriptor>: <itemdefid> [ "x" <quantity> ]
<item_tag_descriptor>: <tag_name> ":" <tag_value> [ "*" <quantity> ]
```

If quantity is omitted, Steam treats it as `1`.

### Promo Format

Official format:

```text
<promo>: <rule> { ";" <rule> }
<rule>: app_rule / ach_rule / played_rule / manual_rule
<app_rule>: "owns:" <appid>
<ach_rule>: "ach:" <achievement name>
<played_rule>: "played:" <appid>/<minutes played, defaults to 1>
<manual>: "manual"
```

### Price Format

Official format:

```text
Price: <version>;<pricelist>

Version: "1"
<pricelist> : <originalprice>(;<price>)*

<originalprice>: <currency><integer>(,<currency><integer)*
<price>: (<daterange>)<currency><integer>(,<currency><integer)*

<currency> 3 letters like "USD"
<integer> amount in currency-specific units
<daterange>: YYYYMMDDTHHMMSSZ-YYYYMMDDTHHMMSSZ
```

Steam states that `<daterange>` must be exactly 33 characters and must be listed in descending order.

## Official Example Snippets

### Bundle and Generator Examples

These examples are quoted in exact format because the token syntax matters.

```text
type: bundle
bundle: 201;202;203

type: bundle
bundle: 101x1;102x5

type: generator
bundle: 501x90;502x9;503x1
```

### Chained Generator Example

```text
itemdefid: 600
name: Common generator
type: generator
bundle: 601;602;603;604;605

itemdefid: 700
name: Special generator
type: generator
bundle: 701;702;703;704;705

itemdefid: 800
name: Master generator
type: generator
bundle: 600x9;700x1
```

### Exchange Examples

```json
"exchange":"100,101;102x5;103x3,104x3"
"exchange":"handed:left,handed:right"
"exchange":"type:tree*3,quality:fancy"
"exchange":"201x1,202x1;flavor:banana,mass:heavy"
```

### Promo Examples

```json
"promo":"owns:440;owns:480"
"promo":"played:570/15"

"itemdefid": 404,
"type": "item",
"name": "Weekly Quest Item",
"promo": "manual",
"drop_start_time": "20170801T120000Z",
"drop_interval": 10080
```

## Official ItemDef Schema Example

The following JSON is the official schema example shown on the Steam Inventory schema page.

```json
{
  "appid": 480,
  "items": [
    {
      "itemdefid": 10,
      "type": "playtimegenerator",
      "bundle": "100x100;101x50;102x25;103x2;110x20;111x20;120x5;121x3",
      "name": "Drop Generator",
      "name_color": "7D6D00",
      "background_color": "3C352E",
      "icon_url": "http://cdn.beta.steampowered.com/apps/440/icons/c_fireaxe_pyro_xmas_large.fa878752e1aa09a721a03042a234063b6c929278.png",
      "icon_url_large": "http://cdn.beta.steampowered.com/apps/440/icons/c_fireaxe_pyro_xmas_large.fa878752e1aa09a721a03042a234063b6c929278.png",
      "tradable": false,
      "marketable": false
    },
    {
      "itemdefid": 100,
      "type": "item",
      "name": "Hat decoration",
      "description": "Hat decoration description",
      "price": "1;USD99",
      "name_color": "7D6D00",
      "background_color": "3C352E",
      "icon_url": "http://cdn.beta.steampowered.com/apps/440/icons/c_fireaxe_pyro_xmas_large.fa878752e1aa09a721a03042a234063b6c929278.png",
      "icon_url_large": "http://cdn.beta.steampowered.com/apps/440/icons/c_fireaxe_pyro_xmas_large.fa878752e1aa09a721a03042a234063b6c929278.png",
      "tradable": true,
      "marketable": true
    },
    {
      "itemdefid": 200,
      "type": "item",
      "price": "1;VLV100",
      "name_english": "Red Hat",
      "name_german": "Roter Hut",
      "description_english": "Red Hat",
      "description_german": "Roter Hut",
      "store_tags": "hat;featured",
      "icon_url": "http://cdn.beta.steampowered.com/apps/440/icons/c_fireaxe_pyro_xmas_large.fa878752e1aa09a721a03042a234063b6c929278.png",
      "icon_url_large": "http://cdn.beta.steampowered.com/apps/440/icons/c_fireaxe_pyro_xmas_large.fa878752e1aa09a721a03042a234063b6c929278.png",
      "tradable": true,
      "marketable": true
    }
  ]
}
```

Raw JSON copy: [docs/examples/steam-itemdef-schema-official.json](../../examples/steam-itemdef-schema-official.json)

## DefBuilder Implications

DefBuilder should treat the schema as structured authoring data with type-driven validation.

- `type` should drive conditional field groups.
- `price` and `price_category` should be mutually exclusive.
- `bundle`, `exchange`, and `promo` deserve dedicated editors or parsers, not plain text fields only.
- localized name and description variants should be grouped semantically, not left as a flat arbitrary field list.
- unknown custom fields should be preserved because Steam allows extended schema properties.

## Related Pages

- [validation.md](validation.md)
- [official-sources.md](official-sources.md)
