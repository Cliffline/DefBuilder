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

function formatItemLabel(item: Record<string, unknown>, index: number): string {
  const itemdefid = typeof item.itemdefid === 'number' ? `#${item.itemdefid}` : `Item ${index + 1}`;
  const name = typeof item.name === 'string' ? item.name : typeof item.name_english === 'string' ? item.name_english : 'Untitled';
  return `${itemdefid} ${name}`;
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

function getPreviewFacts(item: Record<string, unknown>): string[] {
  const facts = [
    typeof item.itemdefid === 'number' ? `ItemDef #${item.itemdefid}` : null,
    typeof item.price === 'string' ? `Price ${item.price}` : null,
    typeof item.price_category === 'string' ? `Category ${item.price_category}` : null,
    item.tradable === true ? 'Tradable' : null,
    item.marketable === true ? 'Marketable' : null,
  ];

  return facts.filter((fact): fact is string => Boolean(fact));
}

function getValidationSummary(issueCount: number): string {
  return issueCount > 0 ? `Validation (${issueCount})` : 'Validation';
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

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  const selectedItem = documentState.items[selectedIndex] ?? null;
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

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(documentState));
  }, [documentState]);

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

  return (
    <div className="app-shell">
      <div className="app-stage">
        <header className="topbar">
          <div>
            <p className="eyebrow">DefBuilder</p>
            <h1>Steam ItemDef editor</h1>
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
            <aside className="panel panel-compact sidebar-meta">
              <label className="field">
                <span>App ID</span>
                <input
                  type="number"
                  value={documentState.appid ?? ''}
                  onChange={(event) => setDocumentState((current) => updateRootNumberField(current, 'appid', event.target.value))}
                />
              </label>
            </aside>

            <section className="panel panel-compact add-item-panel">
              <div className="create-item-row">
                <label className="field compact-field create-item-field">
                  <span>New Item ID</span>
                  <input
                    type="number"
                    placeholder="1001"
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
                    <div className={`item-thumb item-thumb-${getThumbnailVariant(item)}`} aria-hidden="true">
                      <span>{typeof item.itemdefid === 'number' ? item.itemdefid : index + 1}</span>
                    </div>
                    <div className="item-copy">
                      <span className="item-name">{formatItemLabel(item, index)}</span>
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
                  <div className="raw-editor-header">
                    <div>
                      <p className="section-title">Advanced JSON</p>
                      <h3>Raw selected item</h3>
                    </div>
                    <button type="button" onClick={handleApplyRawItem}>Apply JSON</button>
                  </div>
                  <textarea rows={18} value={rawItemDraft} onChange={(event) => setRawItemDraft(event.target.value)} />
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
              <div className="preview-card">
                <div className={`preview-thumb item-thumb item-thumb-${getThumbnailVariant(selectedItem)}`} aria-hidden="true">
                  <span>{typeof selectedItem.itemdefid === 'number' ? selectedItem.itemdefid : selectedIndex + 1}</span>
                </div>
                <div className="preview-copy">
                  <p className="preview-type">{formatItemType(selectedItem)}</p>
                  <h3>{formatItemLabel(selectedItem, selectedIndex)}</h3>
                  <p className="preview-description">
                    {typeof selectedItem.description === 'string' && selectedItem.description.trim().length > 0
                      ? selectedItem.description
                      : 'No description set.'}
                  </p>
                  <div className="preview-facts">
                    {getPreviewFacts(selectedItem).map((fact) => (
                      <span key={fact} className="preview-fact">{fact}</span>
                    ))}
                  </div>
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
