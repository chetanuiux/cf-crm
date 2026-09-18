import { useCallback, useEffect, useState } from "react";

/** Tracks a set of selected row ids for the currently visible page; clears when the page's ids change (new page, filter, or search). */
export function useRowSelection(pageIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pageKey = pageIds.join(",");

  useEffect(() => {
    setSelected(new Set());
  }, [pageKey]);

  const toggle = useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelected(checked ? new Set(pageIds) : new Set());
    },
    [pageKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const clear = useCallback(() => setSelected(new Set()), []);

  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0 && !allSelected;

  return { selected, toggle, toggleAll, clear, allSelected, someSelected };
}
