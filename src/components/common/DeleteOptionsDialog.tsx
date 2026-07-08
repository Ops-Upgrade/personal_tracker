import { useState } from "react";
import Button from "@/components/common/Button";

interface DeleteOptionsDialogProps {
  title: string;
  description: string;
  unlinkOptionLabel: string;
  cascadeOptionLabel: string;
  onCancel: () => void;
  onConfirm: (cascadeMode: "unlink" | "cascade") => void;
}

export default function DeleteOptionsDialog({
  title,
  description,
  unlinkOptionLabel,
  cascadeOptionLabel,
  onCancel,
  onConfirm,
}: DeleteOptionsDialogProps) {
  const [selectedMode, setSelectedMode] = useState<"unlink" | "cascade">("unlink");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
        
        <div className="mt-5 space-y-3">
          <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${selectedMode === 'unlink' ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/20' : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'}`}>
            <input 
              type="radio" 
              name="deleteMode" 
              value="unlink" 
              checked={selectedMode === "unlink"} 
              onChange={() => setSelectedMode("unlink")} 
              className="mt-0.5 h-4 w-4 text-emerald-600 focus:ring-emerald-600 dark:bg-zinc-800 dark:border-zinc-600"
            />
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 block leading-tight">{unlinkOptionLabel}</span>
          </label>
          
          <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${selectedMode === 'cascade' ? 'border-red-500 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30' : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'}`}>
            <input 
              type="radio" 
              name="deleteMode" 
              value="cascade" 
              checked={selectedMode === "cascade"} 
              onChange={() => setSelectedMode("cascade")} 
              className="mt-0.5 h-4 w-4 text-red-600 focus:ring-red-600 dark:bg-zinc-800 dark:border-zinc-600"
            />
            <span className="text-sm font-medium text-red-700 dark:text-red-400 block leading-tight">{cascadeOptionLabel}</span>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={selectedMode === "cascade" ? "danger" : "primary"} onClick={() => onConfirm(selectedMode)}>
            Confirm Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
