"use client";
import * as React from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "./form-controls";
import { Button } from "./button";
import { EmptyState } from "./states";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell?: (row: T) => React.ReactNode;
  /** Value used for sorting/filtering. Omit to disable sorting. */
  value?: (row: T) => string | number;
  className?: string;
}

export function DataTable<T>({ rows, columns, rowKey, pageSize = 10, filterPlaceholder = "Filter…", emptyTitle = "No results", toolbar }: {
  rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; pageSize?: number; filterPlaceholder?: string; emptyTitle?: string; toolbar?: React.ReactNode;
}) {
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = React.useState(0);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => columns.some((c) => c.value && String(c.value(r)).toLowerCase().includes(q)));
  }, [rows, columns, query]);

  const sorted = React.useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.value) return filtered;
    const get = col.value;
    return [...filtered].sort((a, b) => {
      const x = get(a), y = get(b);
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * sort.dir;
    });
  }, [filtered, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const slice = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Filter table" className="pl-9" placeholder={filterPlaceholder} value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
        </div>
        {toolbar}
      </div>
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn("px-3 py-2.5 font-semibold", c.className)} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                  {c.value ? (
                    <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort((s) => (s?.key === c.key ? (s.dir === 1 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 }))}>
                      {c.header}
                      {sort?.key === c.key && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                    </button>
                  ) : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => (
              <tr key={rowKey(r)} className="border-t border-border hover:bg-muted/40">
                {columns.map((c) => <td key={c.key} className={cn("px-3 py-2.5", c.className)}>{c.cell ? c.cell(r) : c.value ? c.value(r) : null}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {slice.length === 0 && <EmptyState title={emptyTitle} className="rounded-none border-0" />}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Showing {sorted.length === 0 ? 0 : safePage * pageSize + 1}–{Math.min(sorted.length, (safePage + 1) * pageSize)} of {sorted.length}</span>
        <div className="flex items-center gap-1">
          <Button size="icon" aria-label="Previous page" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}><ChevronLeft /></Button>
          <span className="px-2">Page {safePage + 1} / {pages}</span>
          <Button size="icon" aria-label="Next page" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}><ChevronRight /></Button>
        </div>
      </div>
    </div>
  );
}
