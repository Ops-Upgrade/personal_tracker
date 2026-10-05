// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import GenericDomainModal, {
  type FieldDef,
  type GenericDomainModalProps,
} from "@/components/common/GenericDomainModal";
import {
  getModalDomainConfig,
  type ModalDomainConfig,
} from "@/components/common/modalDomainConfig";

/**
 * Tier 1-B — GenericDomainModal lifecycle.
 * Regression suite for the form-init refactor: the init effect must populate
 * the form once per target identity (create defaults included) without
 * looping (the "Maximum update depth exceeded" crash) and the dirty check
 * must gate the close path.
 */

vi.mock("@/components/common/modalDomainConfig", () => ({
  getModalDomainConfig: vi.fn(),
}));

vi.mock("@/components/common/RichTextEditor", () => ({
  default: ({ value }: { value: string }) => <div data-testid="richtext">{value}</div>,
}));

vi.mock("@/components/common/DocPreviewPanel", () => ({
  default: () => <div data-testid="doc-preview" />,
}));

vi.mock("@/components/common/FileUploadZone", () => ({
  default: () => <div data-testid="file-upload-zone" />,
}));

vi.mock("@/api/common/encryptedFileStorage", () => ({
  downloadFile: vi.fn(async () => new Blob()),
}));

const FIELDS: FieldDef[] = [
  { key: "name", label: "Title", type: "text" },
  {
    key: "priority",
    label: "Priority",
    type: "select",
    options: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
    ],
  },
  { key: "due_date", label: "Due date", type: "date" },
];

function makeConfig(overrides: Partial<ModalDomainConfig> = {}): ModalDomainConfig {
  return {
    label: "taskmanager",
    allowFiles: false,
    allowLinking: false,
    canCreateParent: false,
    deleteKind: "simple",
    deleteLabel: "Delete",
    initialDataFor: vi.fn((data: Record<string, unknown> | null) => ({
      name: (data?.name as string) ?? "",
      priority: (data?.priority as string) ?? "medium",
      due_date: (data?.due_date as string) ?? "",
    })),
    fetchContext: vi.fn(async () => ({ documents: [], parentRecords: [] })),
    modalTitle: vi.fn((_type: string, isEdit: boolean) =>
      isEdit ? "Edit task" : "Add task",
    ),
    saveRecord: vi.fn(async () => ({ id: "s1", name: "Saved" })),
    deleteRecord: vi.fn(async () => {}),
    ...overrides,
  };
}

function renderModal(props: Partial<GenericDomainModalProps> = {}) {
  const onClose = vi.fn();
  const utils = render(
    <GenericDomainModal
      mode="record"
      domain="taskmanager"
      fields={FIELDS}
      userId="u1"
      onClose={onClose}
      {...props}
    />,
  );
  return { onClose, ...utils };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("form initialisation", () => {
  it("edit mode hydrates the form through initialDataFor and skips createDefaults", async () => {
    const createDefaults = vi.fn(async () => ({ due_date: "2026-08-23" }));
    vi.mocked(getModalDomainConfig).mockReturnValue(makeConfig({ createDefaults }));

    renderModal({
      target: {
        type: "record",
        id: "1",
        data: { name: "My Task", priority: "high", due_date: "" },
      },
    });

    const title = (await screen.findByLabelText("Title")) as HTMLInputElement;
    expect(title.value).toBe("My Task");
    const priority = screen.getByLabelText("Priority") as HTMLSelectElement;
    expect(priority.value).toBe("high");
    expect(createDefaults).not.toHaveBeenCalled();
  });

  it("create mode merges async createDefaults exactly once outside StrictMode", async () => {
    const createDefaults = vi.fn(async () => ({ due_date: "2026-08-23" }));
    vi.mocked(getModalDomainConfig).mockReturnValue(makeConfig({ createDefaults }));

    renderModal({}); // no target → create

    const due = await screen.findByDisplayValue("23/08/2026");
    expect(due).toBeTruthy();
    expect(createDefaults).toHaveBeenCalledTimes(1);
  });
});

describe("dirty check on close", () => {
  it("closes immediately when the form is unchanged", async () => {
    vi.mocked(getModalDomainConfig).mockReturnValue(makeConfig());
    const { onClose } = renderModal({
      target: { type: "record", id: "1", data: { name: "My Task", priority: "medium" } },
    });

    await screen.findByLabelText("Title");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Unsaved changes")).toBeNull();
  });

  it("shows the discard confirmation when a field changed", async () => {
    vi.mocked(getModalDomainConfig).mockReturnValue(makeConfig());
    const { onClose } = renderModal({
      target: { type: "record", id: "1", data: { name: "My Task", priority: "medium" } },
    });

    const title = (await screen.findByLabelText("Title")) as HTMLInputElement;
    fireEvent.change(title, { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Unsaved changes")).toBeTruthy();

    // "No, stay" dismisses the dialog without closing the modal.
    fireEvent.click(screen.getByRole("button", { name: "No, stay" }));
    expect(screen.queryByText("Unsaved changes")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    // "Yes, discard" closes through the confirmation.
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, discard" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("treats Escape as close, gated by the same dirty check", async () => {
    vi.mocked(getModalDomainConfig).mockReturnValue(makeConfig());
    const { onClose } = renderModal({
      target: { type: "record", id: "1", data: { name: "My Task", priority: "medium" } },
    });

    await screen.findByLabelText("Title");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("StrictMode safety", () => {
  it("populates create defaults without looping or dropping the async init", async () => {
    const createDefaults = vi.fn(async () => ({ due_date: "2026-08-23" }));
    vi.mocked(getModalDomainConfig).mockReturnValue(makeConfig({ createDefaults }));

    render(
      <StrictMode>
        <GenericDomainModal
          mode="record"
          domain="taskmanager"
          fields={FIELDS}
          userId="u1"
          onClose={vi.fn()}
        />
      </StrictMode>,
    );

    // The pre-fix implementation re-ran the init effect on fresh object refs
    // and crashed with "Maximum update depth exceeded"; this regression guard
    // re-runs the init under StrictMode and must still land the async
    // defaults (StrictMode double-invokes effects, so the count is not exact).
    const due = await screen.findByDisplayValue("23/08/2026");
    expect(due).toBeTruthy();
  });
});
