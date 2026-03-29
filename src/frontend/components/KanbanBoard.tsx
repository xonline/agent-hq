// trigger-agents/src/frontend/components/KanbanBoard.tsx
import { Fragment, useState, useEffect } from 'react';
import type { KanbanBoard as Board, TaskCategory, KanbanCard as Card } from '../types/hq.js';
import { KanbanCard } from './KanbanCard.js';

const CATEGORIES: { key: TaskCategory; label: string }[] = [
  { key: 'business', label: 'Business' },
  { key: 'systems',  label: 'Systems'  },
  { key: 'research', label: 'Research' },
  { key: 'general',  label: 'General'  },
  { key: 'deferred', label: 'Deferred' },
];

const COLS = [
  { key: 'backlog'     as const, label: 'Backlog',     cls: 'c-blue'   },
  { key: 'inProgress' as const, label: 'In Progress', cls: 'c-amber'  },
  { key: 'review'     as const, label: 'Review',      cls: 'c-purple' },
  { key: 'done'       as const, label: 'Done',        cls: 'c-green'  },
];

interface Props { board: Board; }

export function KanbanBoard({ board }: Props) {
  const [donCollapsed, setDoneCollapsed] = useState(false);
  const [maxDoneItems, setMaxDoneItems] = useState(10);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('kanban-max-done');
    if (stored) setMaxDoneItems(parseInt(stored));
  }, []);

  const allCards = [
    ...board.backlog,
    ...board.inProgress,
    ...board.review,
    ...board.done,
  ];

  const activeCategories = CATEGORIES.filter(cat =>
    allCards.some(c => c.category === cat.key)
  );

  const showCategories = activeCategories.length > 0
    ? activeCategories
    : [{ key: 'general' as TaskCategory, label: 'Tasks' }];

  return (
    <div className="kanban-board">
      {selectedCard && (
        <div className="kcard-modal-backdrop" onClick={() => setSelectedCard(null)}>
          <div className="kcard-modal" onClick={e => e.stopPropagation()}>
            <div className="kcard-modal-title">{selectedCard.title}</div>
            {selectedCard.description && <div className="kcard-modal-desc">{selectedCard.description}</div>}
            <button className="kcard-modal-close" onClick={() => setSelectedCard(null)}>✕ close</button>
          </div>
        </div>
      )}
      {/* Header row */}
      <div className="kb-corner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button
          onClick={() => setDoneCollapsed(!donCollapsed)}
          style={{
            background: donCollapsed ? 'var(--bg3)' : 'none',
            border: '1px solid var(--border)',
            borderRadius: '2px',
            cursor: 'pointer',
            padding: '2px 5px',
            color: donCollapsed ? 'var(--accent2)' : 'var(--text3)',
            fontSize: '10px',
            lineHeight: 1.2,
            transition: 'all 0.1s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
          title={donCollapsed ? 'Show done column' : 'Hide done column'}
        >
          {donCollapsed ? '▶' : '◀'}<br />done
        </button>
      </div>
      {COLS.map(col => (
        <div key={col.key} className="kb-col-hdr">
          <span className={col.cls}>{col.label}</span>
          <span className="c-dim">({board[col.key].length})</span>
        </div>
      ))}

      {/* Swim lanes — always render rows; Done cells collapse per-row */}
      {showCategories.map(cat => {
        // Deferred: span all columns as an idea pool
        if (cat.key === 'deferred') {
          const ideas = board.backlog.filter(c => c.category === 'deferred');
          return (
            <Fragment key={cat.key}>
              <div className="kb-lane-label cat-deferred">Deferred</div>
              <div className="kb-cell kb-cell-deferred kb-deferred-pool">
                {ideas.length === 0 && <div className="kb-empty">— no deferred ideas —</div>}
                {ideas.map(card => (
                  <KanbanCard key={card.id} card={card} isDone={false} onClick={() => setSelectedCard(card)} />
                ))}
              </div>
            </Fragment>
          );
        }

        return (
          <Fragment key={cat.key}>
            <div className={`kb-lane-label cat-${cat.key}`}>{cat.label}</div>
            {COLS.map(col => {
              const cellCls = 'kb-cell';
              if (col.key === 'done' && donCollapsed) {
                const count = board.done.filter(c => c.category === cat.key).length;
                return (
                  <div key={`${cat.key}-${col.key}`} className={cellCls} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="kb-empty">{count > 0 ? `${count} hidden` : '—'}</div>
                  </div>
                );
              }
              let cards = board[col.key].filter(c => c.category === cat.key);
              if (col.key === 'done' && cards.length > maxDoneItems) {
                cards = cards.slice(0, maxDoneItems);
              }
              return (
                <div key={`${cat.key}-${col.key}`} className={cellCls}>
                  {cards.map(card => (
                    <KanbanCard key={card.id} card={card} isDone={col.key === 'done'} onClick={() => setSelectedCard(card)} />
                  ))}
                  {cards.length === 0 && <div className="kb-empty">—</div>}
                </div>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}
