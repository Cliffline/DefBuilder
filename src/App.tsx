import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ITEM_TYPES,
  createEmptyDocument,
  createNewItem,
  parseInventoryDocument,
  replaceItemFromJson,
  updateItemField,
  updateRootNumberField,
  validateInventoryDocument,
  type InventoryDocument,
} from './lib/itemDefs';

const STORAGE_KEY = 'defbuilder-draft';
const PREVIEW_META_STORAGE_KEY = 'defbuilder-preview-meta';

function formatItemLabel(item: Record<string, unknown>, index: number): string {
  const itemdefid = typeof item.itemdefid === 'number' ? `#${item.itemdefid}` : `Item ${index + 1}`;
  const name = typeof item.name === 'string' ? item.name : typeof item.name_english === 'string' ? item.name_english : 'Untitled';
  return `${itemdefid} ${name}`;
}

function formatItemId(item: Record<string, unknown>, index: number): string {
  return typeof item.itemdefid === 'number' ? `#${item.itemdefid}` : `Item ${index + 1}`;
}

function formatItemType(item: Record<string, unknown>): string {
  return typeof item.type === 'string' ? item.type : 'missing type';
}

function formatItemSubtitle(item: Record<string, unknown>, issueCount: number): string {
  const type = formatItemType(item);
  return issueCount > 0 ? `${type} • ${issueCount} issue${issueCount === 1 ? '' : 's'}` : type;
}

function getThumbnailVariant(item: Record<string, unknown>): string {
  const type = formatItemType(item);

  switch (type) {
    case 'item':
      return 'item';
    case 'bundle':
      return 'bundle';
    case 'generator':
      return 'generator';
    case 'playtimegenerator':
      return 'playtimegenerator';
    case 'tag_generator':
      return 'tag-generator';
    default:
      return 'unknown';
  }
}

function getDisplayName(item: Record<string, unknown>, index: number): string {
  if (typeof item.name === 'string' && item.name.trim().length > 0) {
    return item.name;
  }

  if (typeof item.name_english === 'string' && item.name_english.trim().length > 0) {
    return item.name_english;
  }

  if (typeof item.itemdefid === 'number') {
    return `Item #${item.itemdefid}`;
  }

  return `Item ${index + 1}`;
}

function getDisplayDescription(item: Record<string, unknown>): string | null {
  if (typeof item.description === 'string' && item.description.trim().length > 0) {
    return item.description;
  }

  if (typeof item.description_english === 'string' && item.description_english.trim().length > 0) {
    return item.description_english;
  }

  return null;
}

function normalizeColor(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return undefined;
  }

  return `#${trimmed}`;
}

function toRgba(value: unknown, alpha: number): string | undefined {
  const color = normalizeColor(value);
  if (!color) {
    return undefined;
  }

  const hex = color.slice(1);
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getListImageUrl(item: Record<string, unknown>): string | null {
  if (typeof item.icon_url === 'string' && item.icon_url.trim().length > 0) {
    return item.icon_url;
  }

  if (typeof item.icon_url_large === 'string' && item.icon_url_large.trim().length > 0) {
    return item.icon_url_large;
  }

  return null;
}

function getPreviewImageUrl(item: Record<string, unknown>): string | null {
  if (typeof item.icon_url_large === 'string' && item.icon_url_large.trim().length > 0) {
    return item.icon_url_large;
  }

  if (typeof item.icon_url === 'string' && item.icon_url.trim().length > 0) {
    return item.icon_url;
  }

  return null;
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function parseTagList(value: unknown): string[] {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatTag(entry: string): string {
  const [category, rawValue] = entry.split(':');

  if (rawValue) {
    return `${titleCase(category)}: ${titleCase(rawValue)}`;
  }

  return titleCase(category);
}

function getPreviewTags(item: Record<string, unknown>): string[] {
  const tags = [
    ...parseTagList(item.tags),
    ...parseTagList(item.store_tags),
  ].map(formatTag);

  if (item.tradable === true) {
    tags.push('Tradable');
  } else if (item.tradable === false) {
    tags.push('Not Tradable');
  }

  if (item.marketable === true) {
    tags.push('Marketable');
  } else if (item.marketable === false) {
    tags.push('Not Marketable');
  }

  return [...new Set(tags)];
}

function parseBundleReferences(value: unknown): number[] {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return [];
  }

  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => Number(entry.split('x')[0]))
    .filter((entry) => Number.isInteger(entry));
}

function getAccessoryLabel(items: Record<string, unknown>[]): string {
  const preferredTags = ['sticker', 'patch', 'charm', 'accessory'];

  for (const tag of preferredTags) {
    const allMatch = items.every((item) => {
      const entries = [...parseTagList(item.tags), ...parseTagList(item.store_tags)].map((entry) => entry.toLowerCase());
      return entries.some((entry) => entry === tag || entry.endsWith(`:${tag}`));
    });

    if (allMatch) {
      return titleCase(tag);
    }
  }

  const sharedType = items[0]?.type;
  if (typeof sharedType === 'string' && items.every((item) => item.type === sharedType)) {
    return titleCase(sharedType);
  }

  return 'Accessories';
}

function getValidationSummary(issueCount: number): string {
  return issueCount > 0 ? `Validation (${issueCount})` : 'Validation';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function getHighlightedJsonHtml(value: string): string {
  const escaped = escapeHtml(value);

  return escaped.replace(
    /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"\s*:?)|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?/g,
    (match) => {
      if (match.startsWith('"')) {
        if (match.endsWith(':')) {
          return `<span class="json-key">${match}</span>`;
        }

        return `<span class="json-string">${match}</span>`;
      }

      if (match === 'true' || match === 'false') {
        return `<span class="json-boolean">${match}</span>`;
      }

      if (match === 'null') {
        return `<span class="json-null">${match}</span>`;
      }

      return `<span class="json-number">${match}</span>`;
    },
  );
}

function formatValidationPath(path: string): string {
  if (path === 'document') {
    return 'document';
  }

  const cleaned = path.replace(/^items\[\d+\]\.?/, '');

  if (cleaned.length === 0) {
    return 'general';
  }

  return cleaned;
}

function downloadJson(filename: string, inventoryDocument: InventoryDocument): void {
  const blob = new Blob([JSON.stringify(inventoryDocument, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function loadPreviewMeta(): { gameName: string; gameIconUrl: string } {
  const saved = window.localStorage.getItem(PREVIEW_META_STORAGE_KEY);

  if (!saved) {
    return { gameName: '', gameIconUrl: '' };
  }

  try {
    const parsed = JSON.parse(saved) as { gameName?: unknown; gameIconUrl?: unknown };

    return {
      gameName: typeof parsed.gameName === 'string' ? parsed.gameName : '',
      gameIconUrl: typeof parsed.gameIconUrl === 'string' ? parsed.gameIconUrl : '',
    };
  } catch {
    return { gameName: '', gameIconUrl: '' };
  }
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rawEditorInputRef = useRef<HTMLTextAreaElement | null>(null);
  const rawEditorHighlightRef = useRef<HTMLPreElement | null>(null);
  const [documentState, setDocumentState] = useState<InventoryDocument>(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return createEmptyDocument();
    }

    const parsed = parseInventoryDocument(saved);
    return parsed.success ? parsed.data : createEmptyDocument();
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [rawItemDraft, setRawItemDraft] = useState('');
  const [rawItemError, setRawItemError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newItemId, setNewItemId] = useState('');
  const [newItemError, setNewItemError] = useState<string | null>(null);
  const [gameName, setGameName] = useState(() => loadPreviewMeta().gameName);
  const [gameIconUrl, setGameIconUrl] = useState(() => loadPreviewMeta().gameIconUrl);

  const selectedItem = documentState.items[selectedIndex] ?? null;
  const itemById = useMemo(() => {
    const nextMap = new Map<number, Record<string, unknown>>();

    documentState.items.forEach((item) => {
      if (typeof item.itemdefid === 'number') {
        nextMap.set(item.itemdefid, item);
      }
    });

    return nextMap;
  }, [documentState.items]);
  const validationMessages = useMemo(() => validateInventoryDocument(documentState), [documentState]);
  const itemIssueCounts = useMemo(() => {
    const counts = new Map<number, number>();

    validationMessages.forEach((message) => {
      if (message.itemIndex !== undefined) {
        counts.set(message.itemIndex, (counts.get(message.itemIndex) ?? 0) + 1);
      }
    });

    return counts;
  }, [validationMessages]);
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return documentState.items.map((item, index) => ({ item, index }));
    }

    return documentState.items
      .map((item, index) => ({ item, index }))
      .filter(({ item, index }) => {
        const values = [
          formatItemLabel(item, index),
          formatItemType(item),
          typeof item.itemdefid === 'number' ? String(item.itemdefid) : '',
        ];

        return values.some((value) => value.toLowerCase().includes(query));
      });
  }, [documentState.items, searchQuery]);
  const previewTags = useMemo(() => (selectedItem ? getPreviewTags(selectedItem) : []), [selectedItem]);
  const previewAccentColor = useMemo(() => (selectedItem ? normalizeColor(selectedItem.name_color) : undefined), [selectedItem]);
  const previewSurfaceColor = useMemo(() => (selectedItem ? normalizeColor(selectedItem.background_color) : undefined), [selectedItem]);
  const previewCardBorder = useMemo(() => (selectedItem ? previewAccentColor ?? toRgba(selectedItem.background_color, 0.5) : undefined), [previewAccentColor, selectedItem]);
  const previewAttachmentBorder = useMemo(() => (selectedItem ? toRgba(selectedItem.name_color, 0.5) : undefined), [selectedItem]);
  const previewImageUrl = useMemo(() => (selectedItem ? getPreviewImageUrl(selectedItem) : null), [selectedItem]);
  const previewSurfaceBackground = useMemo(() => {
    if (!selectedItem) {
      return undefined;
    }

    if (previewSurfaceColor) {
      return `linear-gradient(180deg, ${toRgba(selectedItem.background_color, 0.46)} 0%, ${toRgba(selectedItem.background_color, 0.88)} 100%)`;
    }

    return 'linear-gradient(180deg, #343434 0%, #292929 100%)';
  }, [previewSurfaceColor, selectedItem]);
  const previewAccessories = useMemo(() => {
    if (!selectedItem) {
      return [] as Record<string, unknown>[];
    }

    return parseBundleReferences(selectedItem.bundle)
      .map((itemdefid) => itemById.get(itemdefid))
      .filter((item): item is Record<string, unknown> => Boolean(item));
  }, [itemById, selectedItem]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(documentState));
  }, [documentState]);

  useEffect(() => {
    window.localStorage.setItem(
      PREVIEW_META_STORAGE_KEY,
      JSON.stringify({ gameName, gameIconUrl }),
    );
  }, [gameIconUrl, gameName]);

  useEffect(() => {
    if (!selectedItem) {
      setRawItemDraft('');
      return;
    }

    setRawItemDraft(JSON.stringify(selectedItem, null, 2));
  }, [selectedItem]);

  useEffect(() => {
    if (selectedIndex >= documentState.items.length) {
      setSelectedIndex(Math.max(documentState.items.length - 1, 0));
    }
  }, [documentState.items.length, selectedIndex]);

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleExportClick() {
    const filename = window.prompt('Export file name', 'itemdefs.json')?.trim();

    if (!filename) {
      return;
    }

    downloadJson(filename, documentState);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const source = await file.text();
    const parsed = parseInventoryDocument(source);

    if (!parsed.success) {
      setImportError(parsed.errors.map((error) => `${error.path}: ${error.message}`).join('\n'));
      return;
    }

    setDocumentState(parsed.data);
    setSelectedIndex(0);
    setImportError(null);
    setRawItemError(null);
  }

  function handleAddItem() {
    const parsedItemId = Number(newItemId.trim());

    if (!newItemId.trim()) {
      setNewItemError('Enter the itemdefid to create.');
      return;
    }

    if (!Number.isInteger(parsedItemId)) {
      setNewItemError('itemdefid must be an integer.');
      return;
    }

    if (documentState.items.some((item) => item.itemdefid === parsedItemId)) {
      setNewItemError(`itemdefid ${parsedItemId} already exists.`);
      return;
    }

    setDocumentState((current) => ({
      ...current,
      items: [...current.items, createNewItem(current.items, parsedItemId)],
    }));
    setSelectedIndex(documentState.items.length);
    setNewItemError(null);
    setNewItemId('');
  }

  function handleRemoveItem() {
    if (!selectedItem) {
      return;
    }

    setDocumentState((current) => ({
      ...current,
      items: current.items.filter((_, index) => index !== selectedIndex),
    }));
    setRawItemError(null);
  }

  function handleApplyRawItem() {
    if (!selectedItem) {
      return;
    }

    const result = replaceItemFromJson(documentState, selectedIndex, rawItemDraft);
    if (!result.success) {
      setRawItemError(result.error);
      return;
    }

    setDocumentState(result.data);
    setRawItemError(null);
  }

  function syncRawEditorScroll() {
    if (!rawEditorInputRef.current || !rawEditorHighlightRef.current) {
      return;
    }

    rawEditorHighlightRef.current.scrollTop = rawEditorInputRef.current.scrollTop;
    rawEditorHighlightRef.current.scrollLeft = rawEditorInputRef.current.scrollLeft;
  }

  return (
    <div className="app-shell">
      <div className="app-stage">
        <header className="topbar">
          <div>
            <p className="eyebrow">DefBuilder</p>
            <p className="summary">Import JSON, edit common fields, run validation, and export a clean ItemDef file.</p>
          </div>
          <div className="topbar-actions">
            <button type="button" onClick={() => setDocumentState(createEmptyDocument())}>New Draft</button>
            <button type="button" onClick={handleImportClick}>Import JSON</button>
            <button type="button" className="primary" onClick={handleExportClick}>Export JSON</button>
            <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleFileChange} />
          </div>
        </header>

        <main className="workspace">
        <div className="main-region">
          <div className="top-strip">
            <div className="meta-cluster">
              <aside className="panel panel-compact meta-panel">
                <div className="meta-panel-grid">
                  <label className="field compact-field">
                    <span>App ID</span>
                    <input
                      type="number"
                      value={documentState.appid ?? ''}
                      onChange={(event) => setDocumentState((current) => updateRootNumberField(current, 'appid', event.target.value))}
                    />
                  </label>

                  <label className="field compact-field">
                    <span>Game Name</span>
                    <input
                      type="text"
                      value={gameName}
                      onChange={(event) => setGameName(event.target.value)}
                    />
                  </label>

                  <label className="field compact-field">
                    <span>Game Icon URL</span>
                    <input
                      type="text"
                      value={gameIconUrl}
                      onChange={(event) => setGameIconUrl(event.target.value)}
                    />
                  </label>
                </div>
              </aside>
            </div>

            <section className="panel panel-compact add-item-panel">
              <div className="create-item-row">
                <label className="field compact-field create-item-field">
                  <span>New Item ID</span>
                  <input
                    type="number"
                    value={newItemId}
                    onChange={(event) => setNewItemId(event.target.value)}
                  />
                </label>
                <button type="button" className="icon-button" onClick={handleAddItem} aria-label="Add item">Add</button>
              </div>
              {newItemError ? <p className="inline-error">{newItemError}</p> : null}
            </section>
          </div>

          <div className="editor-band">
            <aside className="band-section sidebar">
              <div className="panel-header">
                <div>
                  <p className="section-title">ItemList</p>
                </div>
              </div>

              <div className="list-controls">
                <label className="field compact-field">
                  <span>Search Items</span>
                  <input
                    type="search"
                    placeholder="Filter by name, type, or id"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </label>
              </div>

              <div className="item-list">
                {filteredItems.map(({ item, index }) => (
                  <button
                    type="button"
                    key={`${item.itemdefid ?? index}-${index}`}
                    className={index === selectedIndex ? 'item-row active' : 'item-row'}
                    onClick={() => setSelectedIndex(index)}
                  >
                    <div
                      className={`item-thumb item-thumb-${getThumbnailVariant(item)}`}
                      aria-hidden="true"
                      style={{ borderColor: normalizeColor(item.name_color) }}
                    >
                      {getListImageUrl(item) ? (
                        <img
                          className="item-thumb-image"
                          src={getListImageUrl(item) ?? undefined}
                          alt={getDisplayName(item, index)}
                        />
                      ) : (
                        <span>{typeof item.itemdefid === 'number' ? item.itemdefid : index + 1}</span>
                      )}
                    </div>
                    <div className="item-copy">
                      <span className="item-id">{formatItemId(item, index)}</span>
                      <span className="item-name" style={{ color: normalizeColor(item.name_color) }}>
                        {getDisplayName(item, index)}
                      </span>
                      <small className="item-subtitle">{formatItemSubtitle(item, itemIssueCounts.get(index) ?? 0)}</small>
                    </div>
                  </button>
                ))}
                {filteredItems.length === 0 ? <p className="item-list-empty">No matching items.</p> : null}
              </div>
            </aside>

            <section className="band-section editor-panel">
            <div className="panel-header">
              <div>
                <h2>{selectedItem ? formatItemLabel(selectedItem, selectedIndex) : 'No Item Selected'}</h2>
              </div>
              <button type="button" className="danger" onClick={handleRemoveItem} disabled={!selectedItem}>Remove</button>
            </div>

            {selectedItem ? (
              <>
                <div className="editor-grid">
                <label className="field">
                  <span>ItemDef ID</span>
                  <input
                    type="number"
                    value={typeof selectedItem.itemdefid === 'number' ? selectedItem.itemdefid : ''}
                    onChange={(event) => {
                      const value = event.target.value.trim();
                      setDocumentState((current) => updateItemField(current, selectedIndex, 'itemdefid', value === '' ? undefined : Number(value)));
                    }}
                  />
                </label>

                <label className="field">
                  <span>Type</span>
                  <select
                    value={typeof selectedItem.type === 'string' ? selectedItem.type : ''}
                    onChange={(event) => setDocumentState((current) => updateItemField(current, selectedIndex, 'type', event.target.value || undefined))}
                  >
                    <option value="">Select a type</option>
                    {ITEM_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>

                <label className="field field-wide">
                  <span>Name</span>
                  <input
                    type="text"
                    value={typeof selectedItem.name === 'string' ? selectedItem.name : ''}
                    onChange={(event) => setDocumentState((current) => updateItemField(current, selectedIndex, 'name', event.target.value || undefined))}
                  />
                </label>

                <label className="field field-wide">
                  <span>Description</span>
                  <textarea
                    rows={3}
                    value={typeof selectedItem.description === 'string' ? selectedItem.description : ''}
                    onChange={(event) => setDocumentState((current) => updateItemField(current, selectedIndex, 'description', event.target.value || undefined))}
                  />
                </label>

                <label className="field field-wide">
                  <span>Icon URL</span>
                  <input
                    type="text"
                    value={typeof selectedItem.icon_url === 'string' ? selectedItem.icon_url : ''}
                    onChange={(event) => setDocumentState((current) => updateItemField(current, selectedIndex, 'icon_url', event.target.value || undefined))}
                  />
                </label>

                <label className="field field-wide">
                  <span>Large Icon URL</span>
                  <input
                    type="text"
                    value={typeof selectedItem.icon_url_large === 'string' ? selectedItem.icon_url_large : ''}
                    onChange={(event) => setDocumentState((current) => updateItemField(current, selectedIndex, 'icon_url_large', event.target.value || undefined))}
                  />
                </label>

                <label className="field">
                  <span>Background Color</span>
                  <input
                    type="text"
                    placeholder="707d6a"
                    value={typeof selectedItem.background_color === 'string' ? selectedItem.background_color : ''}
                    onChange={(event) => setDocumentState((current) => updateItemField(current, selectedIndex, 'background_color', event.target.value || undefined))}
                  />
                </label>

                <label className="field">
                  <span>Name Color</span>
                  <input
                    type="text"
                    placeholder="cf6a32"
                    value={typeof selectedItem.name_color === 'string' ? selectedItem.name_color : ''}
                    onChange={(event) => setDocumentState((current) => updateItemField(current, selectedIndex, 'name_color', event.target.value || undefined))}
                  />
                </label>

              </div>

              <div className="toggle-row">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedItem.tradable === true}
                    onChange={(event) => setDocumentState((current) => updateItemField(current, selectedIndex, 'tradable', event.target.checked))}
                  />
                  <span>Tradable</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedItem.marketable === true}
                    onChange={(event) => setDocumentState((current) => updateItemField(current, selectedIndex, 'marketable', event.target.checked))}
                  />
                  <span>Marketable</span>
                </label>
              </div>

                <section className="raw-editor">
                  <div className="json-editor-frame">
                    <div className="json-editor-toolbar">
                      <p className="section-title">JSON Block</p>
                      <button type="button" className="json-toolbar-button" onClick={handleApplyRawItem}>Apply JSON</button>
                    </div>
                    <div className="json-editor-shell">
                      <pre
                        ref={rawEditorHighlightRef}
                        className="json-editor-highlight"
                        aria-hidden="true"
                        dangerouslySetInnerHTML={{ __html: `${getHighlightedJsonHtml(rawItemDraft)}\n` }}
                      />
                      <textarea
                        ref={rawEditorInputRef}
                        className="json-editor-input"
                        rows={18}
                        wrap="soft"
                        spellCheck={false}
                        value={rawItemDraft}
                        onChange={(event) => setRawItemDraft(event.target.value)}
                        onScroll={syncRawEditorScroll}
                      />
                    </div>
                  </div>
                  {rawItemError ? <p className="inline-error">{rawItemError}</p> : null}
                </section>
              </>
            ) : (
              <p className="empty-state">Add an ItemDef to start editing.</p>
            )}
            </section>
          </div>
        </div>

        <aside className="panel preview-panel">
          <section className="preview-stage">
            <div className="panel-header">
              <div>
                <p className="section-title">Preview</p>
                {selectedItem ? null : <h2>No Item Selected</h2>}
              </div>
            </div>

            {selectedItem ? (
              <div
                className="preview-card"
                style={{
                  borderColor: previewCardBorder,
                  boxShadow: previewAccentColor ? `inset 0 0 0 1px ${toRgba(previewAccentColor, 0.16)}` : undefined,
                }}
              >
                <div
                  className={`preview-thumb item-thumb item-thumb-${getThumbnailVariant(selectedItem)}`}
                  style={{
                    background: previewSurfaceBackground,
                  }}
                >
                  {previewImageUrl ? (
                    <img
                      className="preview-thumb-image"
                      src={previewImageUrl}
                      alt={getDisplayName(selectedItem, selectedIndex)}
                    />
                  ) : (
                    <span>{typeof selectedItem.itemdefid === 'number' ? selectedItem.itemdefid : selectedIndex + 1}</span>
                  )}
                </div>
                <div className="preview-copy">
                  <h3 style={{ color: previewAccentColor }}>{getDisplayName(selectedItem, selectedIndex)}</h3>
                  {(gameName.trim().length > 0 || gameIconUrl.trim().length > 0) ? (
                    <div className="preview-game-row">
                      {gameIconUrl.trim().length > 0 ? (
                        <img className="preview-game-icon" src={gameIconUrl.trim()} alt={gameName.trim() || 'Game icon'} />
                      ) : (
                        <div className="preview-game-icon preview-game-icon-placeholder" aria-hidden="true" />
                      )}
                      <span className="preview-game-name">{gameName.trim() || 'Game Name'}</span>
                    </div>
                  ) : null}
                  {getDisplayDescription(selectedItem) ? (
                    <p className="preview-description">{getDisplayDescription(selectedItem)}</p>
                  ) : null}
                  {previewAccessories.length > 0 ? (
                    <section className="preview-attachments" style={{ borderColor: previewAttachmentBorder }}>
                      <div className="preview-attachment-icons">
                        {previewAccessories.map((accessory, index) => {
                          const imageUrl = getPreviewImageUrl(accessory);

                          return (
                            <div
                              key={`${accessory.itemdefid ?? index}-${index}`}
                              className="preview-attachment-icon"
                              style={{ borderColor: previewAttachmentBorder }}
                            >
                              {imageUrl ? (
                                <img src={imageUrl} alt={getDisplayName(accessory, index)} />
                              ) : (
                                <span>{getDisplayName(accessory, index).slice(0, 1)}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <p className="preview-attachment-label">
                        {getAccessoryLabel(previewAccessories)}: {previewAccessories.map((accessory, index) => getDisplayName(accessory, index)).join(', ')}
                      </p>
                    </section>
                  ) : null}
                  {previewTags.length > 0 ? (
                    <p className="preview-tags-line">
                      <span className="preview-tags-label">Tags:</span>{' '}
                      {previewTags.join(', ')}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="empty-state">Select an ItemDef to preview it here.</p>
            )}
          </section>

          <section className="preview-validation">
            <div className="panel-header">
              <div>
                <p className="section-title">Validation</p>
                <h2 className={validationMessages.length > 0 ? 'status-title status-title-error' : 'status-title status-title-ok'}>
                  {getValidationSummary(validationMessages.length)}
                </h2>
              </div>
            </div>

            {importError ? <pre className="import-error">{importError}</pre> : null}

            {validationMessages.length > 0 ? (
              <section className="problem-list">
                {validationMessages.map((message, index) => {
                  const isClickable = message.itemIndex !== undefined;

                  return (
                    <button
                      type="button"
                      key={`${message.path}-${message.message}-${index}`}
                      className={`problem-row problem-row-${message.severity}`}
                      onClick={() => {
                        if (message.itemIndex !== undefined) {
                          setSelectedIndex(message.itemIndex);
                        }
                      }}
                      disabled={!isClickable}
                    >
                      <span className={`problem-dot problem-dot-${message.severity}`} aria-hidden="true" />
                      <div className="problem-copy">
                        <p className="problem-text">{message.message}</p>
                        <p className="problem-path">{formatValidationPath(message.path)}</p>
                      </div>
                    </button>
                  );
                })}
              </section>
            ) : (
              <p className="empty-copy">No problems.</p>
            )}
          </section>
        </aside>
        </main>
      </div>
    </div>
  );
}
