import _ from 'lodash';
import type { RawTextItem, TableBlock } from './schemas';

/* ═══════════════════════════════════════════════
   GRID-BASED TABLE DETECTION
   Detects tabular data from PDF text items
   by analyzing row/column alignment patterns.
   ═══════════════════════════════════════════════ */

const MIN_TABLE_ROWS = 2;
const MIN_TABLE_COLS = 2;
const ROW_Y_TOLERANCE = 5;         // px tolerance for same-row grouping
const COL_X_TOLERANCE = 15;        // px tolerance for column alignment
const MAX_CELL_TEXT_LENGTH = 200;   // cells longer than this → probably not a table

interface CellCandidate {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  items: RawTextItem[];
}

interface RowCandidate {
  y: number;
  cells: CellCandidate[];
}

interface ColumnBound {
  xStart: number;
  xEnd: number;
  center: number;
}

export interface DetectedTable {
  block: TableBlock;
  consumedItems: Set<RawTextItem>;
  yStart: number;
  yEnd: number;
}

/* ── Column Detection ── */

function detectColumnBounds(rows: RowCandidate[]): ColumnBound[] | null {
  // Collect all x-positions across rows
  const allXPositions: number[] = [];
  for (const row of rows) {
    for (const cell of row.cells) {
      allXPositions.push(Math.round(cell.x / COL_X_TOLERANCE) * COL_X_TOLERANCE);
    }
  }

  // Count x-position frequencies
  const xCounts = _.countBy(allXPositions);

  // Keep positions that appear in at least half of rows
  const threshold = Math.max(2, Math.floor(rows.length * 0.4));
  const dominantXs = Object.entries(xCounts)
    .filter(([, count]) => count >= threshold)
    .map(([x]) => Number(x))
    .sort((a, b) => a - b);

  if (dominantXs.length < MIN_TABLE_COLS) return null;

  // Build column bounds
  return dominantXs.map((x, i) => {
    const nextX = dominantXs[i + 1];
    return {
      xStart: x - COL_X_TOLERANCE,
      xEnd: nextX ? nextX - COL_X_TOLERANCE : x + 500,
      center: x,
    };
  });
}

/* ── Cell Assignment ── */

function assignCellToColumn(cell: CellCandidate, columns: ColumnBound[]): number {
  let bestCol = 0;
  let bestDist = Infinity;
  for (let c = 0; c < columns.length; c++) {
    const dist = Math.abs(cell.x - columns[c].center);
    if (dist < bestDist) {
      bestDist = dist;
      bestCol = c;
    }
  }
  return bestCol;
}

/* ── Main Table Detection ── */

/**
 * Detect tables from a set of text items on a single PDF page.
 * Returns detected tables with their consumed items.
 */
export function detectTables(items: RawTextItem[]): DetectedTable[] {
  if (items.length < MIN_TABLE_ROWS * MIN_TABLE_COLS) return [];

  // Group items into rows by Y-coordinate
  const sorted = _.orderBy(items, [i => -i.y, i => i.x]);

  const rows: RowCandidate[] = [];
  let currentRowItems: RawTextItem[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.y - currentY) <= ROW_Y_TOLERANCE) {
      currentRowItems.push(item);
    } else {
      if (currentRowItems.length >= MIN_TABLE_COLS) {
        rows.push(buildRow(currentRowItems, currentY));
      }
      currentRowItems = [item];
      currentY = item.y;
    }
  }
  if (currentRowItems.length >= MIN_TABLE_COLS) {
    rows.push(buildRow(currentRowItems, currentY));
  }

  if (rows.length < MIN_TABLE_ROWS) return [];

  // Find consecutive row sequences that have consistent column count
  const tables: DetectedTable[] = [];
  let tableStart = 0;

  while (tableStart < rows.length) {
    const testRows: RowCandidate[] = [];
    let ti = tableStart;

    // Collect consecutive rows with similar cell count
    const refCellCount = rows[tableStart].cells.length;
    while (ti < rows.length && Math.abs(rows[ti].cells.length - refCellCount) <= 1) {
      testRows.push(rows[ti]);
      ti++;
    }

    if (testRows.length >= MIN_TABLE_ROWS) {
      const columns = detectColumnBounds(testRows);
      if (columns && columns.length >= MIN_TABLE_COLS) {
        const table = buildTable(testRows, columns);
        if (table) {
          tables.push(table);
          tableStart = ti;
          continue;
        }
      }
    }

    tableStart++;
  }

  return tables;
}

function buildRow(items: RawTextItem[], y: number): RowCandidate {
  // Sort left-to-right
  const sorted = _.orderBy(items, [i => i.x]);

  // Group close items into cells
  const cells: CellCandidate[] = [];
  let cellItems: RawTextItem[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gap = curr.x - (prev.x + prev.width);

    if (gap > prev.height * 1.5) {
      cells.push(buildCell(cellItems));
      cellItems = [curr];
    } else {
      cellItems.push(curr);
    }
  }
  cells.push(buildCell(cellItems));

  return { y, cells };
}

function buildCell(items: RawTextItem[]): CellCandidate {
  const text = items.map(i => i.str).join(' ').trim();
  const x = items[0].x;
  const y = items[0].y;
  const width = items.reduce((sum, i) => sum + i.width, 0);
  const height = items[0].height;
  return { text, x, y, width, height, items };
}

function buildTable(rows: RowCandidate[], columns: ColumnBound[]): DetectedTable | null {
  const numCols = columns.length;
  const builtRows: string[][] = [];
  const consumedItems = new Set<RawTextItem>();

  for (const row of rows) {
    const rowData: string[] = new Array(numCols).fill('');

    for (const cell of row.cells) {
      if (cell.text.length > MAX_CELL_TEXT_LENGTH) return null;
      const colIdx = assignCellToColumn(cell, columns);
      rowData[colIdx] = cell.text;
      cell.items.forEach(i => consumedItems.add(i));
    }

    builtRows.push(rowData);
  }

  if (builtRows.length < MIN_TABLE_ROWS) return null;

  // First row as headers if it looks distinct (bold or has label-like short text)
  const headers = builtRows.shift()!;
  const tableRows = builtRows;

  // Validate: headers shouldn't be too long
  if (headers.some(h => h.length > MAX_CELL_TEXT_LENGTH)) return null;

  const yStart = rows[0].y;
  const yEnd = rows[rows.length - 1].y;

  return {
    block: {
      type: 'table',
      headers,
      rows: tableRows,
    },
    consumedItems,
    yStart,
    yEnd,
  };
}
