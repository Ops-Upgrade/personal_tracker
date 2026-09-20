/**
 * Notes domain type definitions.
 * Defines the plaintext shapes stored in encrypted blobs,
 * canvas blocks, ink strokes, and hydrated row types.
 */

// Plaintext blob shapes
export interface NotebookPlaintext {
  name: string;
  order: number;
  updated_at: string;
}

export interface SectionPlaintext {
  notebook_id: string;
  name: string;
  order: number;
  color?: string;
  updated_at: string;
}

export interface PagePlaintext {
  section_id: string;
  title: string;
  order: number;
  tags: string[];
  outbound_links?: string[];
  image_ids: string[];
  migrated_from?: string;
  created_at: string;
  updated_at: string;
}

export interface PageContentPlaintext {
  page_id: string;
  revision: number;
  sheet_w: number;
  sheet_h: number;
  blocks: CanvasBlock[];
  strokes: InkStroke[];
  updated_at: string;
}

// Canvas block union
export type CanvasBlock =
  | {
      id: string;
      type: "text";
      role: "flow" | "floating";
      x: number;
      y: number;
      w: number;
      h: number;
      z: number;
      html: string;
    }
  | {
      id: string;
      type: "image";
      x: number;
      y: number;
      w: number;
      h: number;
      z: number;
      document_id: string;
      alt?: string;
    };

// Ink stroke
export interface InkStroke {
  id: string;
  points: [number, number, number?][];
  color: string;
  size: number;
  z: number;
}

// Hydrated types (plaintext + row metadata)
export interface Notebook extends NotebookPlaintext {
  id: string;
  created_at: string;
}

export interface Section extends SectionPlaintext {
  id: string;
  created_at: string;
}

export interface Page extends PagePlaintext {
  id: string;
}

export interface PageContent extends PageContentPlaintext {
  id: string;
  revision: number;
  created_at: string;
}

// Factory for the initial empty flow block
export function emptyFlowBlock(): CanvasBlock {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
    type: "text",
    role: "flow",
    x: 0,
    y: 0,
    w: 760,
    h: 0,
    z: 0,
    html: "",
  };
}
