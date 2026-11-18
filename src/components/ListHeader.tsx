import { useEffect, useRef, useState } from "react";
import { decodeText, readTable } from "../../shared/importFile";
import type { Cell } from "../../shared/importParse";
import type { ListGroup, Watchlist } from "../../shared/types";
import { IS_DEMO } from "../api";
import { isImportBundle, type ImportBundle } from "../useStore";

interface Props {
  list: Watchlist;
  group?: ListGroup;
  canDelete: boolean;
  allLists: Watchlist[];
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onImport: (lists: Watchlist[]) => void;
  onImportBundle: (bundle: ImportBundle) => void;
  /** A CSV/XLSX table of key figures, for the import dialog. */
  onImportTable: (fileName: string, table: Cell[][]) => void;
}

/** Title and actions for the open watchlist. */
export function ListHeader({ list, group, canDelete, allLists, onRename, onDuplicate, onDelete, onImport, onImportBundle, onImportTable }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [menu, setMenu] = useState(false);
  const [importError, setImportError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const finish = () => {
    onRename(draft);
    setEditing(false);
  };

  const exportLists = () => {
    const blob = new Blob([JSON.stringify(allLists, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `watchlists-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /** JSON = lists or an import bundle; anything else is a table of key figures (CSV, XLSX…), told apart by content. */
  const importFile = async (file: File) => {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { kind, table } = await readTable(bytes, file.name);
      const looksJson = kind === "csv" && /^\s*[[{]/.test(decodeText(bytes.slice(0, 64)));
      if (!looksJson) {
        if (table.length < 2) throw new Error("The file has no rows to import");
        onImportTable(file.name, table);
        setImportError(undefined);
        return;
      }
      const data = JSON.parse(decodeText(bytes));
      if (isImportBundle(data)) {
        onImportBundle(data);
        setImportError(undefined);
        return;
      }
      const arr = Array.isArray(data) ? data : Array.isArray(data?.lists) ? data.lists : [data];
      const valid = arr.filter((l: Watchlist) => l && typeof l.name === "string" && Array.isArray(l.symbols));
      if (!valid.length) throw new Error("No watchlists found in the file");
      onImport(valid.map((l: Watchlist) => ({ id: "", name: String(l.name), symbols: l.symbols.map(String) })));
      setImportError(undefined);
    } catch (e) {
      setImportError((e as Error).message);
    }
  };

  const startRename = () => (setDraft(list.name), setEditing(true));
  const openFile = () => fileInput.current?.click();
  /** The list menu. `key` is the keyboard shortcut, shown in the menu and active anywhere on the list page. */
  const actions: { key: string; label: string; run: () => void; disabled?: boolean; title?: string }[] = [
    { key: "R", label: "Rename", run: startRename },
    { key: "C", label: "Make a copy", run: onDuplicate },
    { key: "E", label: "Export all lists", run: exportLists, title: "Download all lists as a JSON file" },
    { key: "I", label: "Import…", run: openFile, title: "Lists from a JSON file, or key figures from a CSV/Excel file (e.g. a Börsdata screener export)" },
    { key: "D", label: "Delete list…", run: () => setConfirm(true), disabled: !canDelete, title: canDelete ? undefined : "You need at least one list" },
  ];
  const latest = useRef({ actions, confirm, editing });
  latest.current = { actions, confirm, editing };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { actions, confirm, editing } = latest.current;
      const target = e.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable]");
      if (editing || typing || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('[aria-modal="true"]')) return;
      if (confirm) {
        if (e.key === "Escape") setConfirm(false);
        return;
      }
      const action = actions.find((a) => a.key === e.key.toUpperCase());
      if (!action || action.disabled || e.shiftKey) return;
      e.preventDefault();
      setMenu(false);
      action.run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close the menu on Escape or a click outside it; arrow keys move between items.
  useEffect(() => {
    if (!menu) return;
    const items = () => [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ?? [])];
    items()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const all = items();
      const i = all.indexOf(document.activeElement as HTMLButtonElement);
      all[(i + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length]?.focus();
    };
    const onClick = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [menu]);

  return (
    <div className="list-header">
      <div className="crumbs">
        {group && <span className="muted">{group.name} › </span>}
        {editing ? (
          <input
            className="title-edit"
            autoFocus
            value={draft}
            maxLength={60}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={finish}
            onKeyDown={(e) => {
              if (e.key === "Enter") finish();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        ) : (
          <h2 onDoubleClick={startRename} title="Double-click or press R to rename">
            {list.name}
          </h2>
        )}
      </div>
      <div className="list-actions" ref={menuRef}>
        {confirm ? (
          <div className="delete-confirm" role="alert">
            <span>Delete “{list.name}”?</span>
            <button
              className="danger"
              autoFocus
              onClick={() => {
                onDelete();
                setConfirm(false);
              }}
            >
              Delete
            </button>
            <button onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        ) : (
          <>
            <button onClick={openFile} title={actions[3].title}>
              Import
            </button>
            {IS_DEMO && (
              <button
                onClick={async () => {
                  const { default: csv } = await import("../../docs/examples/borsdata-screener-sample.csv?raw");
                  onImportTable("borsdata-screener-sample.csv", (await readTable(new TextEncoder().encode(csv), "sample.csv")).table);
                }}
                title="Open the import dialog with a made-up screener export (docs/examples/borsdata-screener-sample.csv)"
              >
                Try sample import
              </button>
            )}
            <button className="more-btn" onClick={() => setMenu((v) => !v)} aria-label="List actions" aria-haspopup="menu" aria-expanded={menu}>
              ⋯
            </button>
            {menu && (
              <div className="action-menu" role="menu" aria-label="List actions">
                {actions.map((a) => (
                  <button
                    key={a.key}
                    role="menuitem"
                    className={a.key === "D" ? "danger-item" : undefined}
                    disabled={a.disabled}
                    title={a.title}
                    onClick={() => {
                      setMenu(false);
                      a.run();
                    }}
                  >
                    <span>{a.label}</span>
                    <kbd>{a.key}</kbd>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json,.csv,text/csv,.txt,.xlsx,.xls,.ods"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importFile(f);
            e.target.value = "";
          }}
        />
        {importError && <span className="neg">{importError}</span>}
      </div>
    </div>
  );
}
