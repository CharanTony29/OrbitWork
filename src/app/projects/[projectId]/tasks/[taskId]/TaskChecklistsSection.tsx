"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, CheckSquare, Pencil, Trash2, X } from "lucide-react";
import {
  createChecklistItem,
  createTaskChecklist,
  deleteChecklistItem,
  deleteTaskChecklist,
  renameTaskChecklist,
  toggleChecklistItem,
  updateChecklistItemTitle,
} from "@/app/actions";

export type ChecklistRecord = {
  id: string;
  title: string;
};

export type ChecklistItemRecord = {
  id: string;
  checklist_id: string;
  title: string;
  is_complete: boolean;
};

/**
 * Interactive task checklists panel with overall and per-checklist progress bars,
 * plus inline rename and delete actions for checklists and checklist items.
 */
export default function TaskChecklistsSection({
  projectId,
  taskId,
  canEdit,
  checklists: initialChecklists,
  items: initialItems,
}: {
  projectId: string;
  taskId: string;
  canEdit: boolean;
  checklists: ChecklistRecord[];
  items: ChecklistItemRecord[];
}) {
  const [checklists, setChecklists] = useState<ChecklistRecord[]>(initialChecklists);
  const [items, setItems] = useState<ChecklistItemRecord[]>(initialItems);
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [editingChecklistTitle, setEditingChecklistTitle] = useState("");
  const [confirmDeleteChecklistId, setConfirmDeleteChecklistId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemTitle, setEditingItemTitle] = useState("");
  const [newItemDrafts, setNewItemDrafts] = useState<Record<string, string>>({});
  const [newChecklistName, setNewChecklistName] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setChecklists(initialChecklists);
  }, [initialChecklists]);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const totalItems = items.length;
  const completedItems = items.filter((item) => item.is_complete).length;
  const overallPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const handleToggleItem = (item: ChecklistItemRecord) => {
    if (!canEdit) return;
    const nextComplete = !item.is_complete;
    setErrorMsg(null);
    setItems((prev) =>
      prev.map((entry) =>
        entry.id === item.id ? { ...entry, is_complete: nextComplete } : entry
      )
    );
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("taskId", taskId);
    fd.set("itemId", item.id);
    fd.set("complete", nextComplete ? "true" : "false");
    startTransition(async () => {
      await toggleChecklistItem(fd);
    });
  };

  const startRenameChecklist = (checklist: ChecklistRecord) => {
    setErrorMsg(null);
    setConfirmDeleteChecklistId(null);
    setEditingChecklistId(checklist.id);
    setEditingChecklistTitle(checklist.title);
  };

  const handleSaveChecklistRename = (checklistId: string) => {
    const trimmed = editingChecklistTitle.trim();
    if (!trimmed) {
      setErrorMsg("Checklist name cannot be empty.");
      return;
    }
    setErrorMsg(null);
    setChecklists((prev) =>
      prev.map((c) => (c.id === checklistId ? { ...c, title: trimmed } : c))
    );
    setEditingChecklistId(null);
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("taskId", taskId);
    fd.set("checklistId", checklistId);
    fd.set("title", trimmed);
    startTransition(async () => {
      const res = await renameTaskChecklist(fd);
      if (!res.ok) {
        setErrorMsg(res.error ?? "Could not rename checklist.");
      }
    });
  };

  const handleDeleteChecklist = (checklistId: string) => {
    setErrorMsg(null);
    setConfirmDeleteChecklistId(null);
    setChecklists((prev) => prev.filter((c) => c.id !== checklistId));
    setItems((prev) => prev.filter((i) => i.checklist_id !== checklistId));
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("taskId", taskId);
    fd.set("checklistId", checklistId);
    startTransition(async () => {
      const res = await deleteTaskChecklist(fd);
      if (!res.ok) {
        setErrorMsg(res.error ?? "Could not delete checklist.");
      }
    });
  };

  const startEditItem = (item: ChecklistItemRecord) => {
    setErrorMsg(null);
    setEditingItemId(item.id);
    setEditingItemTitle(item.title);
  };

  const handleSaveItemEdit = (itemId: string) => {
    const trimmed = editingItemTitle.trim();
    if (!trimmed) {
      setErrorMsg("Checklist item title cannot be empty.");
      return;
    }
    setErrorMsg(null);
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, title: trimmed } : i))
    );
    setEditingItemId(null);
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("taskId", taskId);
    fd.set("itemId", itemId);
    fd.set("title", trimmed);
    startTransition(async () => {
      const res = await updateChecklistItemTitle(fd);
      if (!res.ok) {
        setErrorMsg(res.error ?? "Could not update checklist item.");
      }
    });
  };

  const handleDeleteItem = (itemId: string) => {
    setErrorMsg(null);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("taskId", taskId);
    fd.set("itemId", itemId);
    startTransition(async () => {
      const res = await deleteChecklistItem(fd);
      if (!res.ok) {
        setErrorMsg(res.error ?? "Could not delete checklist item.");
      }
    });
  };

  const handleAddItem = (checklistId: string) => {
    const title = (newItemDrafts[checklistId] ?? "").trim();
    if (!title) return;
    setErrorMsg(null);
    setNewItemDrafts((prev) => ({ ...prev, [checklistId]: "" }));
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("taskId", taskId);
    fd.set("checklistId", checklistId);
    fd.set("title", title);
    startTransition(async () => {
      await createChecklistItem(fd);
    });
  };

  const handleCreateChecklist = () => {
    const title = newChecklistName.trim();
    if (!title) return;
    setErrorMsg(null);
    setNewChecklistName("");
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("taskId", taskId);
    fd.set("title", title);
    startTransition(async () => {
      await createTaskChecklist(fd);
    });
  };

  return (
    <section className="task-checklists">
      <div className="relationship-heading">
        <div>
          <p className="eyebrow">TASK CHECKLISTS</p>
          <h2>
            Checklists{" "}
            {checklists.length > 0 && (
              <span className="count-pill">{checklists.length}</span>
            )}
          </h2>
        </div>
        <CheckSquare size={17} />
      </div>

      {totalItems > 0 && (
        <div className="relationship-progress-wrap" aria-label="Overall checklist progress">
          <div className="relationship-progress-meta">
            <span>Overall progress</span>
            <strong>
              {completedItems} / {totalItems} ({overallPercent}%)
            </strong>
          </div>
          <div className="relationship-progress-track">
            <div
              className={`relationship-progress-fill${overallPercent === 100 ? " is-complete" : ""}`}
              style={{ width: `${overallPercent}%` }}
            />
          </div>
        </div>
      )}

      {errorMsg && (
        <p className="checklist-error-note" role="alert">
          {errorMsg}
        </p>
      )}

      {checklists.map((checklist) => {
        const listItems = items.filter((item) => item.checklist_id === checklist.id);
        const doneCount = listItems.filter((item) => item.is_complete).length;
        const pct = listItems.length > 0 ? Math.round((doneCount / listItems.length) * 100) : 0;
        const isEditingChecklist = editingChecklistId === checklist.id;
        const isConfirmingDelete = confirmDeleteChecklistId === checklist.id;

        return (
          <div className="checklist-block" key={checklist.id}>
            <div className="checklist-block-head">
              {isEditingChecklist ? (
                <form
                  className="checklist-inline-edit-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveChecklistRename(checklist.id);
                  }}
                >
                  <input
                    value={editingChecklistTitle}
                    onChange={(e) => setEditingChecklistTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setEditingChecklistId(null);
                    }}
                    maxLength={100}
                    autoFocus
                    aria-label="Edit checklist name"
                  />
                  <button
                    type="submit"
                    className="checklist-icon-btn is-save"
                    disabled={isPending}
                    aria-label="Save checklist name"
                    title="Save"
                  >
                    <Check size={13} />
                  </button>
                  <button
                    type="button"
                    className="checklist-icon-btn"
                    onClick={() => setEditingChecklistId(null)}
                    aria-label="Cancel rename"
                    title="Cancel"
                  >
                    <X size={13} />
                  </button>
                </form>
              ) : (
                <>
                  <div className="checklist-title-wrap">
                    <h3>{checklist.title}</h3>
                    <span className="checklist-count-tag">
                      {doneCount}/{listItems.length} · {pct}%
                    </span>
                  </div>
                  {canEdit && (
                    <div className="checklist-head-actions">
                      {isConfirmingDelete ? (
                        <div className="checklist-delete-confirm">
                          <button
                            type="button"
                            className="checklist-confirm-btn is-danger"
                            onClick={() => handleDeleteChecklist(checklist.id)}
                            disabled={isPending}
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            className="checklist-confirm-btn"
                            onClick={() => setConfirmDeleteChecklistId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="checklist-icon-btn"
                            onClick={() => startRenameChecklist(checklist)}
                            title="Rename checklist"
                            aria-label={`Rename ${checklist.title}`}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className="checklist-icon-btn is-danger"
                            onClick={() => setConfirmDeleteChecklistId(checklist.id)}
                            title="Delete checklist"
                            aria-label={`Delete ${checklist.title}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {listItems.length > 0 && (
              <div className="relationship-progress-track is-compact">
                <div
                  className={`relationship-progress-fill${pct === 100 ? " is-complete" : ""}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}

            <div className="checklist-items-list">
              {listItems.map((item) => {
                const isEditingItem = editingItemId === item.id;
                if (isEditingItem) {
                  return (
                    <form
                      key={item.id}
                      className="checklist-item-edit-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSaveItemEdit(item.id);
                      }}
                    >
                      <input
                        value={editingItemTitle}
                        onChange={(e) => setEditingItemTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setEditingItemId(null);
                        }}
                        maxLength={300}
                        autoFocus
                        aria-label="Edit checklist item"
                      />
                      <button
                        type="submit"
                        className="checklist-icon-btn is-save"
                        disabled={isPending}
                        aria-label="Save item"
                        title="Save"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        type="button"
                        className="checklist-icon-btn"
                        onClick={() => setEditingItemId(null)}
                        aria-label="Cancel edit"
                        title="Cancel"
                      >
                        <X size={13} />
                      </button>
                    </form>
                  );
                }

                return (
                  <div className="checklist-item-row" key={item.id}>
                    {canEdit ? (
                      <button
                        type="button"
                        className="checklist-item-toggle"
                        onClick={() => handleToggleItem(item)}
                        aria-label={
                          item.is_complete ? `Reopen ${item.title}` : `Complete ${item.title}`
                        }
                      >
                        <span className={item.is_complete ? "checkmark checked" : "checkmark"}>
                          {item.is_complete ? "✓" : ""}
                        </span>
                        <span className={item.is_complete ? "item-complete" : ""}>
                          {item.title}
                        </span>
                      </button>
                    ) : (
                      <div className="checklist-item-static">
                        <span className={item.is_complete ? "checkmark checked" : "checkmark"}>
                          {item.is_complete ? "✓" : ""}
                        </span>
                        <span className={item.is_complete ? "item-complete" : ""}>
                          {item.title}
                        </span>
                      </div>
                    )}

                    {canEdit && (
                      <div className="checklist-item-actions">
                        <button
                          type="button"
                          className="checklist-icon-btn"
                          onClick={() => startEditItem(item)}
                          title="Edit item"
                          aria-label={`Edit ${item.title}`}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          className="checklist-icon-btn is-danger"
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={isPending}
                          title="Delete item"
                          aria-label={`Delete ${item.title}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {canEdit && (
              <form
                className="relationship-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddItem(checklist.id);
                }}
              >
                <input
                  value={newItemDrafts[checklist.id] ?? ""}
                  onChange={(e) =>
                    setNewItemDrafts((prev) => ({
                      ...prev,
                      [checklist.id]: e.target.value,
                    }))
                  }
                  placeholder="Add checklist item"
                  maxLength={300}
                  required
                />
                <button type="submit" className="mini-save" disabled={isPending}>
                  Add item
                </button>
              </form>
            )}
          </div>
        );
      })}

      {canEdit && (
        <form
          className="relationship-form checklist-create-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateChecklist();
          }}
        >
          <input
            value={newChecklistName}
            onChange={(e) => setNewChecklistName(e.target.value)}
            placeholder="New checklist name"
            maxLength={100}
            required
          />
          <button type="submit" className="mini-save" disabled={isPending}>
            Create checklist
          </button>
        </form>
      )}
    </section>
  );
}
