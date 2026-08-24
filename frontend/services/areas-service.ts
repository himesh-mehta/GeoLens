/**
 * areas-service.ts
 *
 * Isolated service layer for saved areas and analysis history.
 * All localStorage access lives here — UI components never touch storage directly.
 * The service can be replaced by a real backend call without changing any UI.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SavedArea {
  id: string;           // matches eoService locationId ("nashik", "pune", etc.)
  name: string;
  state?: string;       // e.g. "Maharashtra"
  latitude?: number;
  longitude?: number;
  coordinates?: string;
  lastChecked?: string; // human-readable date label, e.g. "May 2025"
  recentFinding?: string; // e.g. "Vegetation decreased"
  latestAnalysis?: any;
  lastAnalyzedDate?: string;
  createdAt?: string;
}

export interface HistoryItem {
  id: string;
  areaId: string;
  areaName: string;
  type: 'analysis' | 'comparison';
  date?: string;        // e.g. "May 2025" (analysis)
  beforeDate?: string;  // comparison only
  afterDate?: string;   // comparison only
  status: 'completed' | 'failed' | 'processing';
  /** ISO timestamp for sorting */
  createdAt: string;
}

// ─── Storage keys ────────────────────────────────────────────────────────────

const AREAS_KEY = 'solvenest_saved_areas';
const HISTORY_KEY = 'solvenest_history';

// ─── Seed data ────────────────────────────────────────────────────────────────
// Pre-loaded so demo pages are never blank during SIH presentation.

const SEED_AREAS: SavedArea[] = [
  {
    id: 'nashik',
    name: 'Nashik',
    state: 'Maharashtra',
    lastChecked: 'May 2025',
    recentFinding: 'Vegetation decreased',
  },
  {
    id: 'pune',
    name: 'Pune',
    state: 'Maharashtra',
    lastChecked: 'May 2025',
    recentFinding: 'Built-up areas increased',
  },
];

const SEED_HISTORY: HistoryItem[] = [
  {
    id: 'hist-001',
    areaId: 'nashik',
    areaName: 'Nashik',
    type: 'analysis',
    date: 'May 2025',
    status: 'completed',
    createdAt: '2025-05-15T10:00:00Z',
  },
  {
    id: 'hist-002',
    areaId: 'nashik',
    areaName: 'Nashik',
    type: 'comparison',
    beforeDate: 'May 2022',
    afterDate: 'May 2025',
    status: 'completed',
    createdAt: '2025-05-15T11:30:00Z',
  },
  {
    id: 'hist-003',
    areaId: 'pune',
    areaName: 'Pune',
    type: 'analysis',
    date: 'May 2025',
    status: 'completed',
    createdAt: '2025-05-16T09:15:00Z',
  },
];

// ─── Storage helpers ──────────────────────────────────────────────────────────

function readAreas(): SavedArea[] {
  if (typeof window === 'undefined') return [...SEED_AREAS];
  try {
    const raw = localStorage.getItem(AREAS_KEY);
    if (raw === null) {
      // First run — seed and persist
      localStorage.setItem(AREAS_KEY, JSON.stringify(SEED_AREAS));
      return [...SEED_AREAS];
    }
    return JSON.parse(raw) as SavedArea[];
  } catch {
    return [...SEED_AREAS];
  }
}

function writeAreas(areas: SavedArea[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AREAS_KEY, JSON.stringify(areas));
  } catch {
    // storage quota — silently ignore
  }
}

function readHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return [...SEED_HISTORY];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw === null) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(SEED_HISTORY));
      return [...SEED_HISTORY];
    }
    return JSON.parse(raw) as HistoryItem[];
  } catch {
    return [...SEED_HISTORY];
  }
}

function writeHistory(items: HistoryItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    // storage quota — silently ignore
  }
}

function generateId(): string {
  return `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Service API ──────────────────────────────────────────────────────────────

export const areasService = {
  /**
   * Return all saved areas, most-recently-checked first.
   */
  getSavedAreas(): SavedArea[] {
    return readAreas();
  },

  /**
   * Return a single saved area by ID, or undefined if not saved.
   */
  getAreaById(id: string): SavedArea | undefined {
    return readAreas().find(a => a.id === id);
  },

  /**
   * Return true if an area with the given ID is currently saved.
   */
  isAreaSaved(id: string): boolean {
    return readAreas().some(a => a.id === id);
  },

  /**
   * Save (or update) an area.
   * If an area with the same ID already exists, its record is updated.
   */
  saveArea(area: SavedArea): void {
    const areas = readAreas();
    const idx = areas.findIndex(a => a.id === area.id);
    if (idx >= 0) {
      areas[idx] = { ...areas[idx], ...area };
    } else {
      areas.unshift(area);
    }
    writeAreas(areas);
  },

  /**
   * Remove a saved area by ID. No-op if not found.
   */
  removeArea(id: string): void {
    const areas = readAreas().filter(a => a.id !== id);
    writeAreas(areas);
  },

  // ── History ──────────────────────────────────────────────────────────────

  /**
   * Return all history items, most-recent first.
   */
  getHistory(): HistoryItem[] {
    return readHistory().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  /**
   * Return a single history item by ID, or undefined.
   */
  getHistoryItem(id: string): HistoryItem | undefined {
    return readHistory().find(h => h.id === id);
  },

  /**
   * Search history by area name (partial, case-insensitive) and optional type filter.
   */
  searchHistory(
    query: string,
    type?: 'analysis' | 'comparison'
  ): HistoryItem[] {
    const all = this.getHistory();
    const q = query.trim().toLowerCase();
    return all.filter(h => {
      const matchesQuery = q === '' || h.areaName.toLowerCase().includes(q);
      const matchesType = type == null || h.type === type;
      return matchesQuery && matchesType;
    });
  },

  /**
   * Append a new history item.
   * Deduplicates by areaId + type + date/beforeDate+afterDate to avoid double-entries
   * on re-renders (keeps the most recent).
   */
  addHistoryItem(
    item: Omit<HistoryItem, 'id' | 'createdAt'>
  ): HistoryItem {
    const all = readHistory();

    // Dedup: remove any existing entry that matches area+type+dates
    const filtered = all.filter(h => {
      if (h.areaId !== item.areaId || h.type !== item.type) return true;
      if (item.type === 'analysis') return h.date !== item.date;
      return h.beforeDate !== item.beforeDate || h.afterDate !== item.afterDate;
    });

    const newItem: HistoryItem = {
      ...item,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };

    filtered.unshift(newItem);
    writeHistory(filtered);
    return newItem;
  },

  /**
   * Delete a history item by ID.
   */
  deleteHistoryItem(id: string): void {
    const all = readHistory();
    const filtered = all.filter(h => h.id !== id);
    writeHistory(filtered);
  },
};
