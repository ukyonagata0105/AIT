/**
 * Split Pane Manager
 * Manages split pane layouts for terminal and editor panels
 */

export type SplitDirection = 'horizontal' | 'vertical';
export type PanelType = 'terminal' | 'editor';

export interface SplitPane {
  id: string;
  type: PanelType;
  parentId: string | null;
  children: SplitPane[];
  direction?: SplitDirection;
  sizes?: number[]; // Percentages for child panes
}

export interface SplitPaneConfig {
  direction: SplitDirection;
  sizes: number[];
  panels: PanelType[];
}

export class SplitPaneManager {
  private rootPane: SplitPane | null = null;
  private paneCounter = 0;
  private activePaneId: string | null = null;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    // Initialize with a single terminal pane
    this.rootPane = {
      id: this.generatePaneId(),
      type: 'terminal',
      parentId: null,
      children: [],
    };
    this.activePaneId = this.rootPane.id;
  }

  private generatePaneId(): string {
    return `pane-${++this.paneCounter}`;
  }

  /**
   * Split a pane into two panes
   */
  splitPane(paneId: string, direction: SplitDirection, newType: PanelType): string {
    const pane = this.findPane(this.rootPane!, paneId);
    if (!pane) {
      throw new Error(`Pane ${paneId} not found`);
    }

    // Create new split container
    const splitContainer: SplitPane = {
      id: this.generatePaneId(),
      type: pane.type, // Will be overridden by container
      parentId: pane.parentId,
      children: [],
      direction,
      sizes: [50, 50],
    };

    // Create the two child panes
    const firstChild: SplitPane = {
      id: pane.id,
      type: pane.type,
      parentId: splitContainer.id,
      children: pane.children,
    };

    const secondChild: SplitPane = {
      id: this.generatePaneId(),
      type: newType,
      parentId: splitContainer.id,
      children: [],
    };

    splitContainer.children = [firstChild, secondChild];

    // Update parent reference
    if (pane.parentId) {
      const parent = this.findPane(this.rootPane!, pane.parentId);
      if (parent) {
        const index = parent.children.findIndex(p => p.id === paneId);
        if (index !== -1) {
          parent.children[index] = splitContainer;
        }
      }
    } else {
      this.rootPane = splitContainer;
    }

    return secondChild.id;
  }

  /**
   * Close a pane, merging it with its sibling if possible
   */
  closePane(paneId: string): boolean {
    const pane = this.findPane(this.rootPane!, paneId);
    if (!pane) {
      return false;
    }

    // Cannot close root if it's the only pane
    if (!pane.parentId && this.rootPane!.children.length === 0) {
      return false;
    }

    const parent = this.findPane(this.rootPane!, pane.parentId!);
    if (!parent || parent.children.length !== 2) {
      return false;
    }

    // Get the sibling pane
    const sibling = parent.children.find(p => p.id !== paneId);
    if (!sibling) {
      return false;
    }

    // Replace parent with sibling
    if (parent.parentId) {
      const grandParent = this.findPane(this.rootPane!, parent.parentId);
      if (grandParent) {
        const index = grandParent.children.findIndex(p => p.id === parent.id);
        if (index !== -1) {
          grandParent.children[index] = sibling;
          sibling.parentId = grandParent.id;
        }
      }
    } else {
      this.rootPane = sibling;
      sibling.parentId = null;
    }

    // Update active pane if needed
    if (this.activePaneId === paneId) {
      this.activePaneId = sibling.id;
    }

    return true;
  }

  /**
   * Resize a pane by adjusting the split ratio
   */
  resizePane(paneId: string, delta: number): boolean {
    const pane = this.findPane(this.rootPane!, paneId);
    if (!pane || !pane.parentId) {
      return false;
    }

    const parent = this.findPane(this.rootPane!, pane.parentId);
    if (!parent || !parent.sizes || parent.children.length !== 2) {
      return false;
    }

    const index = parent.children.findIndex(p => p.id === paneId);
    if (index === -1) {
      return false;
    }

    // Adjust sizes (delta is percentage points)
    const currentSize = parent.sizes[index];
    const siblingIndex = index === 0 ? 1 : 0;
    const siblingSize = parent.sizes[siblingIndex];

    const newSize = Math.max(10, Math.min(90, currentSize + delta));
    const newSiblingSize = 100 - newSize;

    parent.sizes[index] = newSize;
    parent.sizes[siblingIndex] = newSiblingSize;

    return true;
  }

  /**
   * Get the active pane ID
   */
  getActivePane(): string | null {
    return this.activePaneId;
  }

  /**
   * Set the active pane
   */
  setActivePane(paneId: string): boolean {
    const pane = this.findPane(this.rootPane!, paneId);
    if (!pane) {
      return false;
    }
    this.activePaneId = paneId;
    return true;
  }

  /**
   * Get pane by ID
   */
  getPane(paneId: string): SplitPane | null {
    return this.findPane(this.rootPane!, paneId);
  }

  /**
   * Get all leaf panes (actual content panes, not containers)
   */
  getLeafPanes(): SplitPane[] {
    const leaves: SplitPane[] = [];
    this.collectLeaves(this.rootPane!, leaves);
    return leaves;
  }

  /**
   * Get the split tree structure
   */
  getSplitTree(): SplitPane | null {
    return this.rootPane;
  }

  /**
   * Reset to single pane layout
   */
  reset(): void {
    this.initialize();
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private findPane(root: SplitPane, paneId: string): SplitPane | null {
    if (root.id === paneId) {
      return root;
    }

    if (root.children.length > 0) {
      for (const child of root.children) {
        const found = this.findPane(child, paneId);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  private collectLeaves(pane: SplitPane, leaves: SplitPane[]): void {
    if (pane.children.length === 0) {
      leaves.push(pane);
    } else {
      for (const child of pane.children) {
        this.collectLeaves(child, leaves);
      }
    }
  }

  // ─── Serialization ───────────────────────────────────────────────────────

  toJSON(): object {
    return {
      rootPane: this.rootPane,
      activePaneId: this.activePaneId,
      paneCounter: this.paneCounter,
    };
  }

  fromJSON(data: any): void {
    if (data.rootPane) {
      this.rootPane = data.rootPane;
      this.activePaneId = data.activePaneId;
      this.paneCounter = data.paneCounter;
    }
  }
}
