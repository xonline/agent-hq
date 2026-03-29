// trigger-agents/src/lib/tasksParser.ts

export type TaskCategory = 'business' | 'systems' | 'research' | 'general' | 'deferred';

export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  category: TaskCategory;
}

export interface KanbanBoard {
  backlog: KanbanCard[];
  inProgress: KanbanCard[];
  review: KanbanCard[];
  done: KanbanCard[];
}

function extractCategory(raw: string): { category: TaskCategory; title: string } {
  const m = raw.match(/^\[(\w+)\]\s+(.+)$/);
  if (m) {
    const tag = m[1].toLowerCase();
    const title = m[2];
    if (tag === 'business') return { category: 'business', title };
    if (tag === 'systems')  return { category: 'systems',  title };
    if (tag === 'research') return { category: 'research', title };
    if (tag === 'deferred') return { category: 'deferred', title };
  }
  return { category: 'general', title: raw };
}

// Detect what kind of section a ## heading represents
type SectionContext = 'inprogress' | 'complete' | 'backlog' | 'neutral';

function getSectionContext(heading: string): SectionContext {
  const h = heading.toLowerCase();
  if (h.includes('🟡') || h.includes('in progress') || h.includes('in-progress')) return 'inprogress';
  if (h.includes('🟢') || h.includes('complete') || h.includes('completed') || h.includes('done')) return 'complete';
  if (h.includes('🔴') && (h.includes('completed') || h.includes('complete'))) return 'complete';
  return 'neutral';
}

export function parseTasks(markdown: string): KanbanBoard {
  const board: KanbanBoard = { backlog: [], inProgress: [], review: [], done: [] };
  let idx = 0;
  let sectionCtx: SectionContext = 'neutral';

  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();

    // Track section context from ## headings
    if (trimmed.startsWith('##')) {
      sectionCtx = getSectionContext(trimmed);
      continue;
    }

    // Emoji-prefix in-progress (standalone 🟡 items)
    const inProgEmoji = trimmed.match(/^-?\s*🟡\s+\*\*(.+?)\*\*(?:\s+—\s+(.+))?$/);
    if (inProgEmoji) {
      const { category, title } = extractCategory(inProgEmoji[1]);
      board.inProgress.push({ id: `t${idx++}`, title, description: inProgEmoji[2], category });
      continue;
    }

    // [x] or ✅ done (always done regardless of section)
    const doneMatch = trimmed.match(/^-\s+\[x\]\s+\*\*(.+?)\*\*(?:\s+—\s+(.+))?$/);
    const doneEmoji = trimmed.match(/^-?\s*✅\s+\*\*(.+?)\*\*(?:\s+—\s+(.+))?$/);
    if (doneMatch || doneEmoji) {
      const m = doneMatch ?? doneEmoji!;
      const { category, title } = extractCategory(m[1]);
      board.done.push({ id: `t${idx++}`, title, description: m[2], category });
      continue;
    }

    // [~] explicit in-progress marker
    const inProgMatch = trimmed.match(/^-\s+\[~\]\s+\*\*(.+?)\*\*(?:\s+—\s+(.+))?$/);
    if (inProgMatch) {
      const { category, title } = extractCategory(inProgMatch[1]);
      board.inProgress.push({ id: `t${idx++}`, title, description: inProgMatch[2], category });
      continue;
    }

    // [ ] unchecked — destination depends on section context
    const todoMatch = trimmed.match(/^-\s+\[\s\]\s+\*\*(.+?)\*\*(?:\s+—\s+(.+))?$/);
    if (todoMatch) {
      const { category, title } = extractCategory(todoMatch[1]);
      const card: KanbanCard = { id: `t${idx++}`, title, description: todoMatch[2], category };
      if (sectionCtx === 'inprogress') {
        board.inProgress.push(card);
      } else {
        board.backlog.push(card);
      }
    }
  }

  // Keep last 10 done items per category (40 max total)
  const cats = ['business', 'systems', 'research', 'general'] as TaskCategory[];
  board.done = cats.flatMap(cat =>
    board.done.filter(c => c.category === cat).slice(-10)
  );

  return board;
}
