import { z } from 'zod';

export const ITEM_TYPES = ['item', 'bundle', 'generator', 'playtimegenerator', 'tag_generator'] as const;

export type ItemType = (typeof ITEM_TYPES)[number];
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type ItemDef = Record<string, JsonValue>;

export interface InventoryDocument {
  appid?: number;
  items: ItemDef[];
}

export interface ValidationMessage {
  path: string;
  message: string;
  severity: 'error' | 'warning';
  itemIndex?: number;
}

const jsonLiteralSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([jsonLiteralSchema, z.array(jsonValueSchema), z.record(jsonValueSchema)]),
);
const itemDefSchema = z.record(jsonValueSchema);
const inventoryDocumentSchema = z
  .object({
    appid: z.number().int().nonnegative().optional(),
    items: z.array(itemDefSchema),
  })
  .passthrough();

function zodPathToString(path: (string | number)[]): string {
  if (path.length === 0) {
    return 'document';
  }

  return path
    .map((segment) => (typeof segment === 'number' ? `[${segment}]` : segment))
    .join('.');
}

function isPlainObject(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateRecipeSyntax(value: string): boolean {
  return /^\d+x\d+(;\d+x\d+)*$/.test(value.trim());
}

function nextItemDefId(items: ItemDef[]): number {
  const usedIds = new Set(
    items
      .map((item) => item.itemdefid)
      .filter((value): value is number => typeof value === 'number' && Number.isInteger(value)),
  );

  let candidate = 1000;
  while (usedIds.has(candidate)) {
    candidate += 1;
  }

  return candidate;
}

export function createEmptyDocument(): InventoryDocument {
  return {
    appid: 480,
    items: [
      {
        itemdefid: 1000,
        type: 'item',
        name: 'New Item',
        description: '',
        tradable: true,
        marketable: true,
      },
    ],
  };
}

export function createNewItem(items: ItemDef[], preferredItemDefId?: number): ItemDef {
  const itemdefid =
    typeof preferredItemDefId === 'number' && Number.isInteger(preferredItemDefId)
      ? preferredItemDefId
      : nextItemDefId(items);

  return {
    itemdefid,
    type: 'item',
    name: 'New Item',
    description: '',
    tradable: true,
    marketable: true,
  };
}

export function parseInventoryDocument(source: string):
  | { success: true; data: InventoryDocument }
  | { success: false; errors: ValidationMessage[] } {
  let parsed: unknown;

  try {
    parsed = JSON.parse(source);
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          path: 'document',
          message: error instanceof Error ? error.message : 'Invalid JSON.',
          severity: 'error',
        },
      ],
    };
  }

  const result = inventoryDocumentSchema.safeParse(parsed);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((issue) => ({
        path: zodPathToString(issue.path),
        message: issue.message,
        severity: 'error',
      })),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

export function validateInventoryDocument(document: InventoryDocument): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  const seenIds = new Map<number, number>();

  if (document.items.length === 0) {
    messages.push({
      path: 'items',
      message: 'At least one ItemDef is recommended before export.',
      severity: 'warning',
    });
  }

  document.items.forEach((item, itemIndex) => {
    const itemdefid = item.itemdefid;
    const type = item.type;
    const price = item.price;
    const priceCategory = item.price_category;

    if (typeof itemdefid !== 'number' || !Number.isInteger(itemdefid)) {
      messages.push({
        path: `items[${itemIndex}].itemdefid`,
        message: 'itemdefid is required and must be an integer.',
        severity: 'error',
        itemIndex,
      });
    } else if (seenIds.has(itemdefid)) {
      messages.push({
        path: `items[${itemIndex}].itemdefid`,
        message: `itemdefid ${itemdefid} duplicates item ${seenIds.get(itemdefid)}.`,
        severity: 'error',
        itemIndex,
      });
    } else {
      seenIds.set(itemdefid, itemIndex);
    }

    if (typeof type !== 'string' || !ITEM_TYPES.includes(type as ItemType)) {
      messages.push({
        path: `items[${itemIndex}].type`,
        message: 'type is required and must be a supported Steam built-in type.',
        severity: 'error',
        itemIndex,
      });
    }

    if (typeof price === 'string' && typeof priceCategory === 'string') {
      messages.push({
        path: `items[${itemIndex}]`,
        message: 'price and price_category are mutually exclusive.',
        severity: 'error',
        itemIndex,
      });
    }

    if (typeof item.bundle === 'string' && item.bundle.length > 0 && !validateRecipeSyntax(item.bundle)) {
      messages.push({
        path: `items[${itemIndex}].bundle`,
        message: 'bundle must use semicolon-separated quantity pairs like 100x1;101x2.',
        severity: 'error',
        itemIndex,
      });
    }

    if (typeof item.exchange === 'string' && item.exchange.length > 0 && !validateRecipeSyntax(item.exchange)) {
      messages.push({
        path: `items[${itemIndex}].exchange`,
        message: 'exchange must use semicolon-separated quantity pairs like 100x1;101x2.',
        severity: 'error',
        itemIndex,
      });
    }

    if (typeof item.name !== 'string' && typeof item.name_english !== 'string') {
      messages.push({
        path: `items[${itemIndex}].name`,
        message: 'A visible item usually needs name or name_english.',
        severity: 'warning',
        itemIndex,
      });
    }

    if (typeof item.icon_url !== 'string' && typeof item.icon_url_large !== 'string') {
      messages.push({
        path: `items[${itemIndex}].icon_url`,
        message: 'A visible item usually needs icon_url or icon_url_large.',
        severity: 'warning',
        itemIndex,
      });
    }
  });

  return messages;
}

export function cloneDocument(document: InventoryDocument): InventoryDocument {
  return structuredClone(document);
}

export function updateRootNumberField(
  document: InventoryDocument,
  key: 'appid',
  rawValue: string,
): InventoryDocument {
  const nextDocument = cloneDocument(document);

  if (rawValue.trim() === '') {
    delete nextDocument[key];
    return nextDocument;
  }

  const nextValue = Number(rawValue);
  if (Number.isFinite(nextValue)) {
    nextDocument[key] = nextValue;
  }

  return nextDocument;
}

export function updateItemField(
  document: InventoryDocument,
  itemIndex: number,
  key: string,
  value: JsonValue | undefined,
): InventoryDocument {
  const nextDocument = cloneDocument(document);
  const targetItem = nextDocument.items[itemIndex];

  if (!targetItem) {
    return document;
  }

  if (value === undefined || value === '') {
    delete targetItem[key];
  } else {
    targetItem[key] = value;
  }

  return nextDocument;
}

export function replaceItemFromJson(
  document: InventoryDocument,
  itemIndex: number,
  rawValue: string,
): { success: true; data: InventoryDocument } | { success: false; error: string } {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawValue);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid JSON.',
    };
  }

  if (!isPlainObject(parsed as JsonValue | undefined)) {
    return {
      success: false,
      error: 'Selected item JSON must be an object.',
    };
  }

  const nextDocument = cloneDocument(document);
  nextDocument.items[itemIndex] = parsed as ItemDef;

  return {
    success: true,
    data: nextDocument,
  };
}
