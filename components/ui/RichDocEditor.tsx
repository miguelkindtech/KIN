"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PASTEL_UNDERLINES = [
  "#F5E8F0",
  "#EDE8FF",
  "#E8F4EE",
  "#FFF4E6",
  "#E8EFF5",
];

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeDocHtml(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return "<p></p>";
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return value;

  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function selectionWrap(style: string) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  if (range.collapsed) return;

  const span = document.createElement("span");
  span.setAttribute("style", style);

  try {
    range.surroundContents(span);
  } catch {
    const fragment = range.extractContents();
    span.appendChild(fragment);
    range.insertNode(span);
  }

  selection.removeAllRanges();
  const nextRange = document.createRange();
  nextRange.selectNodeContents(span);
  selection.addRange(nextRange);
}

type RichDocEditorProps = {
  title: string;
  titlePlaceholder?: string;
  value: string;
  placeholder?: string;
  backLabel?: string;
  beforeEditor?: ReactNode;
  sidePanel?: ReactNode;
  toolbarExtras?: ReactNode;
  onTitleChange?: (value: string) => void;
  onChange: (value: string) => void;
  onBack: () => void;
  onDelete?: () => void;
};

export default function RichDocEditor({
  title,
  titlePlaceholder,
  value,
  placeholder = "Start writing…",
  backLabel = "back",
  beforeEditor,
  sidePanel,
  toolbarExtras,
  onTitleChange,
  onChange,
  onBack,
  onDelete,
}: RichDocEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(false);

  const normalizedValue = useMemo(() => normalizeDocHtml(value), [value]);

  useEffect(() => {
    if (!editorRef.current) return;

    if (editorRef.current.innerHTML !== normalizedValue) {
      editorRef.current.innerHTML = normalizedValue;
    }

    const textContent = editorRef.current.textContent?.trim() || "";
    setIsEmpty(textContent.length === 0);
  }, [normalizedValue]);

  const syncFromDom = useCallback(() => {
    if (!editorRef.current) return;

    const html = editorRef.current.innerHTML;
    const textContent = editorRef.current.textContent?.trim() || "";
    setIsEmpty(textContent.length === 0);
    onChange(html === "<br>" ? "<p></p>" : html);
  }, [onChange]);

  const runCommand = useCallback(
    (command: string, commandValue?: string) => {
      if (!editorRef.current) return;

      editorRef.current.focus();
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand(command, false, commandValue);
      syncFromDom();
    },
    [syncFromDom]
  );

  const applyPastelUnderline = useCallback(
    (color: string) => {
      if (!editorRef.current) return;

      editorRef.current.focus();
      selectionWrap(
        `box-shadow: inset 0 -0.38em 0 ${color}; text-decoration: none;`
      );
      syncFromDom();
    },
    [syncFromDom]
  );

  const applyTextScale = useCallback(
    (fontSize: string) => {
      if (!editorRef.current) return;

      editorRef.current.focus();
      selectionWrap(`font-size: ${fontSize};`);
      syncFromDom();
    },
    [syncFromDom]
  );

  return (
    <div className="page">
      <button className="back-btn" onClick={onBack}>
        ← {backLabel}
      </button>

      <div className={sidePanel ? "note-editor-shell" : "rich-doc-shell"}>
        <div className="card rich-doc-card">
          <div className="rich-doc-head">
            {onTitleChange ? (
              <input
                className="rich-doc-title-input"
                value={title}
                placeholder={titlePlaceholder || "Untitled document"}
                onChange={(event) => onTitleChange(event.target.value)}
              />
            ) : (
              <h2 className="rich-doc-title-static">{title}</h2>
            )}
          </div>

          <div className="rich-doc-toolbar">
            <button
              className="ghost-btn small-btn"
              type="button"
              onClick={() => runCommand("formatBlock", "p")}
            >
              Body
            </button>
            <button
              className="ghost-btn small-btn"
              type="button"
              onClick={() => runCommand("formatBlock", "h2")}
            >
              Large
            </button>
            <button
              className="ghost-btn small-btn"
              type="button"
              onClick={() => runCommand("formatBlock", "h1")}
            >
              XL
            </button>
            <button
              className="ghost-btn small-btn"
              type="button"
              onClick={() => applyTextScale("1.15em")}
            >
              T+
            </button>
            <button
              className="ghost-btn small-btn"
              type="button"
              onClick={() => applyTextScale("0.9em")}
            >
              T-
            </button>
            <button
              className="ghost-btn small-btn"
              type="button"
              onClick={() => runCommand("bold")}
            >
              B
            </button>
            <button
              className="ghost-btn small-btn"
              type="button"
              onClick={() => runCommand("italic")}
            >
              I
            </button>
            <button
              className="ghost-btn small-btn"
              type="button"
              onClick={() => runCommand("strikeThrough")}
            >
              S
            </button>
            <div className="rich-doc-swatches">
              {PASTEL_UNDERLINES.map((color) => (
                <button
                  key={color}
                  className="rich-doc-swatch"
                  style={{ background: color }}
                  type="button"
                  title="pastel underline"
                  onClick={() => applyPastelUnderline(color)}
                />
              ))}
            </div>
            {toolbarExtras}
            {onDelete ? (
              <button
                className="danger-btn small-btn rich-doc-delete"
                type="button"
                onClick={onDelete}
              >
                delete
              </button>
            ) : null}
          </div>

          {beforeEditor}

          <div
            ref={editorRef}
            className={`rich-doc-editor${isEmpty ? " is-empty" : ""}`}
            data-placeholder={placeholder}
            contentEditable
            suppressContentEditableWarning
            onInput={syncFromDom}
            onBlur={syncFromDom}
          />
        </div>

        {sidePanel ? (
          <div className="card note-meta-card rich-doc-side-panel">{sidePanel}</div>
        ) : null}
      </div>
    </div>
  );
}
