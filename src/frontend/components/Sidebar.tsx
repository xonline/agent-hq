// trigger-agents/src/frontend/components/Sidebar.tsx

export type SidebarView = 'office' | 'tasks' | 'logs' | 'agents' | 'trends' | 'settings';

const NAV_ITEMS: { icon: string; label: string; view: SidebarView }[] = [
  { icon: '🏢', label: 'Office',   view: 'office' },
  { icon: '📋', label: 'Tasks',    view: 'tasks' },
  { icon: '📜', label: 'Logs',     view: 'logs' },
  { icon: '👥', label: 'Agents',   view: 'agents' },
  { icon: '📈', label: 'Trends',   view: 'trends' },
];

const NAV_ITEMS_BOTTOM: { icon: string; label: string; view: SidebarView }[] = [
  { icon: '⚙️', label: 'Settings', view: 'settings' },
];

interface Props {
  view: SidebarView;
  onViewChange: (v: SidebarView) => void;
  reviewCount?: number;
}

export function Sidebar({ view, onViewChange, reviewCount = 0 }: Props) {
  return (
    <aside className="sidebar">
      {NAV_ITEMS.map(({ icon, label, view: v }) => {
        const isTasksView = v === 'tasks';
        return (
          <div key={label} className={`nav-btn${view === v ? ' active' : ''}`} title={label} onClick={() => onViewChange(v)}>
            {icon}
            {isTasksView && reviewCount > 0 && (
              <span className="nav-badge">{reviewCount}</span>
            )}
            <span className="tip">{label}</span>
          </div>
        );
      })}
      <div className="nav-sep" />
      {NAV_ITEMS_BOTTOM.map(({ icon, label, view: v }) => (
        <div key={label} className={`nav-btn${view === v ? ' active' : ''}`} title={label} onClick={() => onViewChange(v)}>
          {icon}
          <span className="tip">{label}</span>
        </div>
      ))}
    </aside>
  );
}
