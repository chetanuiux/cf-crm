import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface BulkDeleteBarProps {
  count: number;
  /** Singular label, e.g. "lead", "firm", "follow-up" */
  itemLabel: string;
  onConfirm: () => Promise<void>;
}

/** Super-admin-only bulk delete bar: shows a selection count and a confirm-then-delete action. Renders nothing when count is 0. */
export function BulkDeleteBar({ count, itemLabel, onConfirm }: BulkDeleteBarProps) {
  const [deleting, setDeleting] = useState(false);

  if (count === 0) return null;

  const plural = count === 1 ? itemLabel : `${itemLabel}s`;

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
    } catch {
      // Caller is responsible for surfacing the error (e.g. via toast)
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
      <span className="text-sm font-medium">
        {count} {plural} selected
      </span>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm">
            <Trash2 className="h-4 w-4" /> Delete selected
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {count} {plural}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the selected {plural} and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
