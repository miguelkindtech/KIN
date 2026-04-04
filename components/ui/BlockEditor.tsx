"use client";

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { Block } from "@/lib/types";
import { BLOCK_MENU } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { uploadAttachment } from "@/lib/supabase/storage";
import {
  createBlock,
  insertBlockAfter,
  replaceBlockType,
} from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BlockEditorProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  uploadContext?: {
    entityType: string;
    entityId: string;
  };
}

interface SlashMenuState {
  blockId: string;
  query: string;
  activeIndex: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// -- Auto-resizing textarea --------------------------------------------------

interface AutoTextareaProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  autoFocus?: boolean;
}

function AutoTextarea({
  value,
  onChange,
  className,
  placeholder,
  onKeyDown,
  autoFocus,
}: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Resize on mount and value change
  useEffect(() => {
    autoResize(ref.current);
  }, [value]);

  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
      // place cursor at end
      const len = ref.current.value.length;
      ref.current.setSelectionRange(len, len);
    }
  }, [autoFocus]);

  function handleInput(e: ChangeEvent<HTMLTextAreaElement>) {
    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
    onChange(e.target.value);
  }

  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      placeholder={placeholder}
      rows={1}
      onChange={handleInput}
      onKeyDown={onKeyDown}
    />
  );
}

// -- Slash Menu --------------------------------------------------------------

interface SlashMenuProps {
  query: string;
  activeIndex: number;
  onSelect: (type: Block["type"]) => void;
}

function SlashMenu({ query, activeIndex, onSelect }: SlashMenuProps) {
  const lower = query.toLowerCase();
  const filtered = BLOCK_MENU.filter(
    (item) =>
      item.label.toLowerCase().includes(lower) ||
      item.hint.toLowerCase().includes(lower) ||
      item.type.toLowerCase().includes(lower)
  );

  if (filtered.length === 0) return null;

  return (
    <div className="slash-menu">
      {filtered.map((item, i) => (
        <button
          key={item.type}
          className={`slash-item${i === activeIndex ? " active" : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item.type as Block["type"]);
          }}
        >
          <strong>{item.label}</strong>
          <span>{item.hint}</span>
        </button>
      ))}
    </div>
  );
}

// -- Individual block renderers ----------------------------------------------

interface BlockRowProps {
  block: Block;
  slashMenu: SlashMenuState | null;
  focusId: string | null;
  uploading: boolean;
  onUpdate: (id: string, patch: Partial<Block>) => void;
  onDelete: (id: string) => void;
  onInsertAfter: (id: string, type?: Block["type"]) => void;
  onSlashOpen: (blockId: string, query: string) => void;
  onSlashClose: () => void;
  onSlashNavigate: (dir: 1 | -1) => void;
  onSlashSelect: (blockId: string, type: Block["type"]) => void;
  onIndentChange: (id: string, delta: number) => void;
  onUploadMedia: (blockId: string, file: File) => Promise<void>;
}

function BlockRow({
  block,
  slashMenu,
  focusId,
  uploading,
  onUpdate,
  onDelete,
  onInsertAfter,
  onSlashOpen,
  onSlashClose,
  onSlashNavigate,
  onSlashSelect,
  onIndentChange,
  onUploadMedia,
}: BlockRowProps) {
  const isSlashOpen = slashMenu?.blockId === block.id;
  const shouldFocus = focusId === block.id;

  // Shared key handler for text-like blocks
  function handleTextKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    const val = (e.target as HTMLTextAreaElement).value;

    // Slash menu navigation
    if (isSlashOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        onSlashNavigate(1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        onSlashNavigate(-1);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (slashMenu) {
          const lower = slashMenu.query.toLowerCase();
          const filtered = BLOCK_MENU.filter(
            (item) =>
              item.label.toLowerCase().includes(lower) ||
              item.hint.toLowerCase().includes(lower) ||
              item.type.toLowerCase().includes(lower)
          );
          if (filtered[slashMenu.activeIndex]) {
            onSlashSelect(
              block.id,
              filtered[slashMenu.activeIndex].type as Block["type"]
            );
          }
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onSlashClose();
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onInsertAfter(block.id, "text");
      return;
    }

    if (e.key === "Backspace" && val === "") {
      e.preventDefault();
      onDelete(block.id);
      return;
    }
  }

  // Handle text change (detect slash command)
  function handleTextChange(val: string) {
    onUpdate(block.id, { text: val });

    const slashIdx = val.lastIndexOf("/");
    if (slashIdx !== -1) {
      const query = val.slice(slashIdx + 1);
      // Only open if no space in query (i.e. still one "word" after slash)
      if (!query.includes(" ")) {
        onSlashOpen(block.id, query);
        return;
      }
    }
    if (isSlashOpen) {
      onSlashClose();
    }
  }

  // -- Render by type --------------------------------------------------------

  function renderContent() {
    switch (block.type) {
      // Text
      case "text":
        return (
          <div style={{ position: "relative" }}>
            <AutoTextarea
              value={block.text ?? ""}
              onChange={handleTextChange}
              className="block-input"
              placeholder="Type '/' for commands…"
              onKeyDown={handleTextKeyDown}
              autoFocus={shouldFocus}
            />
            {isSlashOpen && (
              <SlashMenu
                query={slashMenu!.query}
                activeIndex={slashMenu!.activeIndex}
                onSelect={(type) => onSlashSelect(block.id, type)}
              />
            )}
          </div>
        );

      // Headings
      case "heading1":
      case "heading2":
      case "heading3": {
        const cls =
          block.type === "heading1"
            ? "block-heading1"
            : block.type === "heading2"
            ? "block-heading2"
            : "block-heading3";
        const placeholder =
          block.type === "heading1"
            ? "Heading 1"
            : block.type === "heading2"
            ? "Heading 2"
            : "Heading 3";
        return (
          <div style={{ position: "relative" }}>
            <AutoTextarea
              value={block.text ?? ""}
              onChange={handleTextChange}
              className={`block-input ${cls}`}
              placeholder={placeholder}
              onKeyDown={handleTextKeyDown}
              autoFocus={shouldFocus}
            />
            {isSlashOpen && (
              <SlashMenu
                query={slashMenu!.query}
                activeIndex={slashMenu!.activeIndex}
                onSelect={(type) => onSlashSelect(block.id, type)}
              />
            )}
          </div>
        );
      }

      // Todo
      case "todo": {
        const indent = block.indent ?? 0;
        const indentClass =
          indent === 1
            ? " todo-indent-1"
            : indent === 2
            ? " todo-indent-2"
            : "";
        return (
          <div className={`todo-row${indentClass}`}>
            <button
              className={`todo-check${block.checked ? " done" : ""}`}
              onClick={() =>
                onUpdate(block.id, { checked: !block.checked })
              }
              aria-label={block.checked ? "Uncheck" : "Check"}
            >
              {block.checked ? "✓" : ""}
            </button>
            <input
              className="todo-text-input"
              type="text"
              value={block.text ?? ""}
              placeholder="To-do item…"
              onChange={(e) => onUpdate(block.id, { text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onInsertAfter(block.id, "todo");
                }
                if (e.key === "Backspace" && (block.text ?? "") === "") {
                  e.preventDefault();
                  onDelete(block.id);
                }
                if (e.key === "Tab") {
                  e.preventDefault();
                  onIndentChange(block.id, e.shiftKey ? -1 : 1);
                }
              }}
            />
          </div>
        );
      }

      // Divider
      case "divider":
        return <hr className="block-divider" />;

      // Callout
      case "callout":
        return (
          <div className="block-callout">
            <button
              className="block-callout-icon"
              onClick={() => {
                const next = window.prompt("Callout icon", block.icon ?? "i");
                if (next !== null) onUpdate(block.id, { icon: next || "i" });
              }}
              title="Change icon"
            >
              {block.icon ?? "i"}
            </button>
            <AutoTextarea
              value={block.text ?? ""}
              onChange={(val) => onUpdate(block.id, { text: val })}
              className="block-callout-input"
              placeholder="Callout text…"
              autoFocus={shouldFocus}
            />
          </div>
        );

      // Code
      case "code":
        return (
          <div>
            <input
              type="text"
              className="inline-btn"
              style={{ fontSize: "0.75rem", marginBottom: 4, display: "block" }}
              value={block.language ?? ""}
              placeholder="Language (e.g. typescript)"
              onChange={(e) =>
                onUpdate(block.id, { language: e.target.value })
              }
            />
            <AutoTextarea
              value={block.text ?? ""}
              onChange={(val) => onUpdate(block.id, { text: val })}
              className="block-code"
              placeholder="// code…"
              autoFocus={shouldFocus}
            />
          </div>
        );

      // Table
      case "table": {
        const rows = block.rows ?? [["", ""], ["", ""]];
        const colCount = rows[0]?.length ?? 2;

        const updateCell = (r: number, c: number, val: string) => {
          const next = rows.map((row) => [...row]);
          next[r][c] = val;
          onUpdate(block.id, { rows: next });
        };

        const addRow = () => {
          const next = [...rows, Array(colCount).fill("")];
          onUpdate(block.id, { rows: next });
        };

        const addCol = () => {
          const next = rows.map((row) => [...row, ""]);
          onUpdate(block.id, { rows: next });
        };

        const removeRow = (r: number) => {
          if (rows.length <= 1) return;
          const next = rows.filter((_, i) => i !== r);
          onUpdate(block.id, { rows: next });
        };

        const removeCol = (c: number) => {
          if (colCount <= 1) return;
          const next = rows.map((row) => row.filter((_, i) => i !== c));
          onUpdate(block.id, { rows: next });
        };

        return (
          <div className="block-table-wrap">
            <table className="block-table">
              <tbody>
                {rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td key={c}>
                        <input
                          type="text"
                          value={cell}
                          placeholder="…"
                          onChange={(e) => updateCell(r, c, e.target.value)}
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        className="inline-btn"
                        title="Remove row"
                        onClick={() => removeRow(r)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="block-table-actions">
              <button className="inline-btn" onClick={addRow}>
                + Row
              </button>
              <button className="inline-btn" onClick={addCol}>
                + Column
              </button>
              {colCount > 1 && (
                <button
                  className="inline-btn"
                  onClick={() => removeCol(colCount - 1)}
                >
                  − Column
                </button>
              )}
            </div>
          </div>
        );
      }

      // Image
      case "image":
        return (
          <div className="block-media">
            {block.src ? (
              <div className="block-media-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={block.src} alt={block.caption ?? ""} />
              </div>
            ) : (
              <div className="block-media-meta">
                <label className="inline-btn">
                  {uploading ? "Uploading..." : "Upload image"}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      await onUploadMedia(block.id, file);
                      e.target.value = "";
                    }}
                  />
                </label>
                <input
                  type="text"
                  className="inline-btn"
                  placeholder="…or paste URL"
                  style={{ marginLeft: 8 }}
                  onBlur={(e) => {
                    if (e.target.value)
                      onUpdate(block.id, { src: e.target.value });
                  }}
                />
              </div>
            )}
            <input
              type="text"
              className="block-caption"
              placeholder="Caption…"
              value={block.caption ?? ""}
              onChange={(e) => onUpdate(block.id, { caption: e.target.value })}
            />
          </div>
        );

      // PDF / File
      case "pdf":
        return (
          <div className="block-media">
            {block.src ? (
              <div className="block-media-preview">
                <iframe src={block.src} title={block.name ?? "File"} />
                <div className="block-media-meta">
                  <span>{block.name || block.src}</span>
                  <button
                    className="inline-btn"
                    onClick={() => onUpdate(block.id, { src: "", name: "" })}
                  >
                    Replace
                  </button>
                </div>
              </div>
            ) : (
              <div className="block-media-meta">
                <label className="inline-btn">
                  {uploading ? "Uploading..." : "Upload file / PDF"}
                  <input
                    type="file"
                    accept="application/pdf,*/*"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      await onUploadMedia(block.id, file);
                      e.target.value = "";
                    }}
                  />
                </label>
                <input
                  type="text"
                  className="inline-btn"
                  placeholder="…or paste URL"
                  style={{ marginLeft: 8 }}
                  onBlur={(e) => {
                    if (e.target.value)
                      onUpdate(block.id, { src: e.target.value });
                  }}
                />
              </div>
            )}
            <input
              type="text"
              className="block-caption"
              placeholder="Caption…"
              value={block.caption ?? ""}
              onChange={(e) => onUpdate(block.id, { caption: e.target.value })}
            />
          </div>
        );

      // Note Link
      case "note_link":
        return (
          <div className="block-link-card">
            <div className="block-link-actions">
              <span>Note Link</span>
            </div>
            <input
              type="text"
              className="inline-btn"
              placeholder="Note ID or title…"
              value={block.noteId ?? ""}
              onChange={(e) => onUpdate(block.id, { noteId: e.target.value })}
              style={{ flex: 1 }}
            />
          </div>
        );

      // Entity Link
      case "entity_link":
        return (
          <div className="block-entity-card">
            <div className="block-link-actions">
              <span>Entity Link</span>
            </div>
            <input
              type="text"
              className="inline-btn"
              placeholder="Entity ID (event, vertical, applied, member)…"
              value={block.entity ?? ""}
              onChange={(e) => onUpdate(block.id, { entity: e.target.value })}
              style={{ flex: 1 }}
            />
          </div>
        );

      default:
        return (
          <div className="block-input" style={{ opacity: 0.5 }}>
            Unknown block type: {block.type}
          </div>
        );
    }
  }

  return (
    <div className="block-row">
      <button
        className="block-handle"
        tabIndex={-1}
        aria-label="Drag handle"
        title="Drag to reorder"
      >
        ⠿
      </button>
      <div className="block-content">{renderContent()}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function BlockEditor({
  blocks,
  onChange,
  uploadContext,
}: BlockEditorProps) {
  const supabase = useMemo(() => createClient(), []);
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);

  // ── Updaters ──────────────────────────────────────────────────────────────

  const updateBlock = useCallback(
    (id: string, patch: Partial<Block>) => {
      onChange(
        blocks.map((b) => (b.id === id ? { ...b, ...patch } : b))
      );
    },
    [blocks, onChange]
  );

  const deleteBlock = useCallback(
    (id: string) => {
      const next = blocks.filter((b) => b.id !== id);
      // Always keep at least one block
      const result =
        next.length === 0 ? [createBlock("text")] : next;
      // Focus the block before the deleted one (or first)
      const idx = blocks.findIndex((b) => b.id === id);
      const target = result[Math.max(0, idx - 1)];
      setFocusId(target?.id ?? null);
      onChange(result);
    },
    [blocks, onChange]
  );

  const insertAfter = useCallback(
    (afterId: string, type: Block["type"] = "text") => {
      const newBlocks = insertBlockAfter(blocks, afterId, type);
      // The newly inserted block is right after afterId
      const afterIdx = blocks.findIndex((b) => b.id === afterId);
      const newBlock = newBlocks[afterIdx + 1];
      setFocusId(newBlock?.id ?? null);
      onChange(newBlocks);
    },
    [blocks, onChange]
  );

  // ── Slash menu ────────────────────────────────────────────────────────────

  const openSlash = useCallback((blockId: string, query: string) => {
    setSlashMenu({ blockId, query, activeIndex: 0 });
  }, []);

  const closeSlash = useCallback(() => {
    setSlashMenu(null);
  }, []);

  const navigateSlash = useCallback(
    (dir: 1 | -1) => {
      setSlashMenu((prev) => {
        if (!prev) return prev;
        const lower = prev.query.toLowerCase();
        const filtered = BLOCK_MENU.filter(
          (item) =>
            item.label.toLowerCase().includes(lower) ||
            item.hint.toLowerCase().includes(lower) ||
            item.type.toLowerCase().includes(lower)
        );
        const next =
          (prev.activeIndex + dir + filtered.length) % filtered.length;
        return { ...prev, activeIndex: next };
      });
    },
    []
  );

  const selectSlash = useCallback(
    (blockId: string, type: Block["type"]) => {
      // Find the block and replace it, stripping the slash + query from text
      const block = blocks.find((b) => b.id === blockId);
      if (!block) {
        closeSlash();
        return;
      }

      // Strip the slash command from the text
      const rawText = block.text ?? "";
      const slashIdx = rawText.lastIndexOf("/");
      const cleanText = slashIdx !== -1 ? rawText.slice(0, slashIdx) : rawText;

      const replaced = replaceBlockType(
        { ...block, text: cleanText },
        type
      );
      // Preserve the id so focus targeting works
      const withId = { ...replaced, id: blockId };
      onChange(blocks.map((b) => (b.id === blockId ? withId : b)));
      setFocusId(blockId);
      closeSlash();
    },
    [blocks, onChange, closeSlash]
  );

  // ── Indent ────────────────────────────────────────────────────────────────

  const changeIndent = useCallback(
    (id: string, delta: number) => {
      const block = blocks.find((b) => b.id === id);
      if (!block) return;
      const current = block.indent ?? 0;
      const next = Math.max(0, Math.min(2, current + delta));
      updateBlock(id, { indent: next });
    },
    [blocks, updateBlock]
  );

  const uploadMedia = useCallback(
    async (blockId: string, file: File) => {
      if (!uploadContext) {
        const objectUrl = URL.createObjectURL(file);
        updateBlock(blockId, {
          src: objectUrl,
          name: file.name,
        });
        return;
      }

      setUploadingBlockId(blockId);
      try {
        const uploaded = await uploadAttachment(
          supabase,
          file,
          uploadContext.entityType,
          uploadContext.entityId
        );
        updateBlock(blockId, {
          src: uploaded.url,
          name: uploaded.name,
          path: uploaded.path,
        });
      } finally {
        setUploadingBlockId(null);
      }
    },
    [supabase, updateBlock, uploadContext]
  );

  // ── Dismiss slash on click outside ────────────────────────────────────────

  useEffect(() => {
    if (!slashMenu) return;
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".slash-menu") && !target.closest(".block-input")) {
        closeSlash();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [slashMenu, closeSlash]);

  // Clear focusId after it's been consumed (one render cycle)
  useEffect(() => {
    if (focusId !== null) {
      const timer = setTimeout(() => setFocusId(null), 100);
      return () => clearTimeout(timer);
    }
  }, [focusId]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="block-editor">
      {blocks.map((block) => (
        <BlockRow
          key={block.id}
          block={block}
          slashMenu={slashMenu}
          focusId={focusId}
          uploading={uploadingBlockId === block.id}
          onUpdate={updateBlock}
          onDelete={deleteBlock}
          onInsertAfter={insertAfter}
          onSlashOpen={openSlash}
          onSlashClose={closeSlash}
          onSlashNavigate={navigateSlash}
          onSlashSelect={selectSlash}
          onIndentChange={changeIndent}
          onUploadMedia={uploadMedia}
        />
      ))}

      {/* Add block button at bottom */}
      <div className="block-row" style={{ opacity: 0.4 }}>
        <button
          className="block-handle"
          tabIndex={-1}
          style={{ visibility: "hidden" }}
        >
          ⠿
        </button>
        <button
          className="inline-btn block-content"
          style={{ textAlign: "left", justifyContent: "flex-start" }}
          onClick={() => {
            const last = blocks[blocks.length - 1];
            if (last) {
              insertAfter(last.id, "text");
            } else {
              onChange([createBlock("text")]);
            }
          }}
        >
          + Add block
        </button>
      </div>
    </div>
  );
}
