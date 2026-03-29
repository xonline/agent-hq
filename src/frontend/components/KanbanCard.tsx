// trigger-agents/src/frontend/components/KanbanCard.tsx
import type { KanbanCard as Card } from '../types/hq.js';

interface Props { card: Card; isDone?: boolean; onClick?: () => void; }

export function KanbanCard({ card, isDone, onClick }: Props) {
  return (
    <div className={`kcard kcard-cat-${card.category}${isDone ? ' done' : ''}${onClick ? ' kcard-clickable' : ''}`} onClick={onClick}>
      <div className="kcard-title">{card.title}</div>
      {card.description && (
        <div className="kcard-desc">{card.description}</div>
      )}
    </div>
  );
}
