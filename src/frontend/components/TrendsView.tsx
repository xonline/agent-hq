import { useState, useCallback } from 'react';
import { useTrends } from '../hooks/useTrends.js';
import type { TrendsDayData, TrendsPlanInfo } from '../hooks/useTrends.js';
import { authHeaders } from '../lib/auth.js';

const PLAN_OPTIONS = [
  { key: 'pro',    label: 'Claude Pro ($20/mo)' },
  { key: 'max5x',  label: 'Claude Max 5× ($100/mo)' },
  { key: 'max20x', label: 'Claude Max 20× ($200/mo)' },
  { key: 'teams',  label: 'Claude Teams ($30/mo)' },
];

function formatDateAEST(isoDate: string): string {
  // isoDate from backend is "YYYY-MM-DD"
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year.slice(2)}`; // DD-MM-YY
}

interface SparklineProps {
  data: number[];
  label: string;
  currentValue: string | number;
  colour: string;
  height?: number;
}

// Simple inline SVG sparkline
function Sparkline({ data, label, currentValue, colour, height = 60 }: SparklineProps) {
  if (!data || data.length === 0) {
    return (
      <div className="sparkline-panel">
        <div className="sparkline-label">{label}</div>
        <div className="sparkline-value" style={{ color: colour }}>—</div>
      </div>
    );
  }

  const maxValue = Math.max(...data, 1);
  const minValue = Math.min(...data, 0);
  const range = maxValue - minValue || 1;
  const width = 100;
  const padding = 4;
  const innerHeight = height - padding * 2;

  // Normalize points to SVG coordinates
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = innerHeight - ((v - minValue) / range) * innerHeight;
    return [x, y];
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');

  return (
    <div className="sparkline-panel">
      <div className="sparkline-label">{label}</div>
      <div className="sparkline-value" style={{ color: colour }}>{currentValue}</div>
      <svg className="sparkline-svg" width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {/* Area fill (light, low opacity) */}
        <path
          d={`${pathD} L ${width} ${innerHeight} L 0 ${innerHeight} Z`}
          fill={colour}
          opacity="0.15"
        />
        {/* Line */}
        <polyline points={points.map(p => `${p[0]},${p[1]}`).join(' ')} fill="none" stroke={colour} strokeWidth="2" />
        {/* Last point dot */}
        {points.length > 0 && (
          <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="3" fill={colour} />
        )}
      </svg>
    </div>
  );
}

interface PlanSavingsPanelProps {
  plan: TrendsPlanInfo;
  days: number;
  planOverride: string | null;
  onPlanChange: (key: string) => void;
  savingPlan: boolean;
}

function PlanSavingsPanel({ plan, days, planOverride, onPlanChange, savingPlan }: PlanSavingsPanelProps) {
  const effectiveKey = planOverride ?? plan.key;
  const isSaving = plan.savings > 0;
  const savingsColour = isSaving ? 'var(--green)' : 'var(--red)';
  const savingsLabel = isSaving ? 'You save' : 'You overpay';

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: '4px', padding: '10px 14px', marginBottom: '10px' }}>
      <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', marginBottom: '8px' }}>
        Plan vs API cost ({days}d window)
        {plan.detected && <span style={{ marginLeft: 6, color: 'var(--cyan)' }}>auto-detected</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)' }}>API equiv cost</div>
          <div style={{ fontSize: 'var(--fs-lg)', color: 'var(--amber)', fontVariantNumeric: 'tabular-nums' }}>
            ${(plan.planCostForPeriod + plan.savings).toFixed(2)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)' }}>{plan.name}</div>
          <div style={{ fontSize: 'var(--fs-lg)', color: 'var(--blue)', fontVariantNumeric: 'tabular-nums' }}>
            ${plan.planCostForPeriod.toFixed(2)}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)' }}>${plan.monthlyUsd}/mo prorated {days}d</div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)' }}>{savingsLabel}</div>
          <div style={{ fontSize: 'var(--fs-lg)', color: savingsColour, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
            ${Math.abs(plan.savings).toFixed(2)}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)' }}>vs token-by-token billing</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)' }}>Plan:</span>
        {PLAN_OPTIONS.map(o => (
          <button
            key={o.key}
            onClick={() => onPlanChange(o.key)}
            disabled={savingPlan || effectiveKey === o.key}
            style={{
              fontSize: 'var(--fs-xs)',
              padding: '2px 8px',
              border: `1px solid ${effectiveKey === o.key ? 'var(--blue)' : 'var(--border)'}`,
              background: effectiveKey === o.key ? 'var(--blue)' : 'var(--bg3)',
              color: effectiveKey === o.key ? 'var(--bg)' : 'var(--text2)',
              borderRadius: '3px',
              cursor: effectiveKey === o.key ? 'default' : 'pointer',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TrendsView() {
  const [days, setDays] = useState<7 | 30 | 60 | 90>(7);
  const [planOverride, setPlanOverride] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const { data, loading, error } = useTrends(days);

  const handleToggleDays = (newDays: 7 | 30 | 60 | 90) => {
    setDays(newDays);
  };

  const handlePlanChange = useCallback(async (key: string) => {
    setSavingPlan(true);
    try {
      const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
      const r = await fetch('/api/config/plan', { method: 'PUT', headers, body: JSON.stringify({ key }) });
      if (r.ok) setPlanOverride(key);
    } finally {
      setSavingPlan(false);
    }
  }, []);

  if (error) {
    return (
      <div className="trends-view">
        <div style={{ color: 'var(--red)' }}>Error loading trends: {error}</div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="trends-view">
        <div style={{ color: 'var(--text3)' }}>Loading trends…</div>
      </div>
    );
  }

  const { daily, totals } = data;

  // Prepare data for sparklines
  const costData = daily.map(d => d.costUsd);
  const tokensData = daily.map(d => d.tokensIn + d.tokensOut);
  const completedData = daily.map(d => d.jobsCompleted);
  const failedData = daily.map(d => d.jobsFailed);
  const sessionsData = daily.map(d => d.sessions);

  // Calculate average error rate
  const totalJobs = totals.jobsCompleted + totals.jobsFailed;
  const errorRate = totalJobs > 0 ? Math.round((totals.jobsFailed / totalJobs) * 100) : 0;

  return (
    <div className="trends-view">
      {/* Toggle */}
      <div className="trends-toggle">
        <button className={`toggle-btn ${days === 7  ? 'active' : ''}`} onClick={() => handleToggleDays(7)}>7D</button>
        <button className={`toggle-btn ${days === 30 ? 'active' : ''}`} onClick={() => handleToggleDays(30)}>30D</button>
        <button className={`toggle-btn ${days === 60 ? 'active' : ''}`} onClick={() => handleToggleDays(60)}>60D</button>
        <button className={`toggle-btn ${days === 90 ? 'active' : ''}`} onClick={() => handleToggleDays(90)}>90D</button>
      </div>

      {/* Summary Row */}
      <div className="trends-summary">
        <div className="trend-card">
          <div className="trend-card-label">Total Cost</div>
          <div className="trend-card-value" style={{ color: 'var(--green)' }}>
            ${totals.costUsd.toFixed(2)}
          </div>
        </div>
        <div className="trend-card">
          <div className="trend-card-label">Total Tokens</div>
          <div className="trend-card-value" style={{ color: 'var(--blue)' }}>
            {(totals.tokensIn + totals.tokensOut).toLocaleString()}
          </div>
        </div>
        <div className="trend-card">
          <div className="trend-card-label">Jobs Completed</div>
          <div className="trend-card-value" style={{ color: 'var(--cyan)' }}>
            {totals.jobsCompleted}
          </div>
        </div>
        <div className="trend-card">
          <div className="trend-card-label">Error Rate</div>
          <div className="trend-card-value" style={{ color: errorRate > 10 ? 'var(--red)' : 'var(--green)' }}>
            {errorRate}%
          </div>
        </div>
      </div>

      {/* Plan vs API cost savings panel */}
      {data.plan && (
        <PlanSavingsPanel
          plan={data.plan}
          days={days}
          planOverride={planOverride}
          onPlanChange={handlePlanChange}
          savingPlan={savingPlan}
        />
      )}

      {/* Charts Grid */}
      <div className="trends-charts">
        <Sparkline
          data={costData}
          label="Daily Cost (USD)"
          currentValue={`$${costData[costData.length - 1]?.toFixed(2) ?? '0.00'}`}
          colour="var(--green)"
        />
        <Sparkline
          data={tokensData}
          label="Daily Tokens"
          currentValue={tokensData[tokensData.length - 1]?.toLocaleString() ?? '0'}
          colour="var(--blue)"
        />
        <Sparkline
          data={completedData}
          label="Jobs Completed"
          currentValue={completedData[completedData.length - 1] ?? '0'}
          colour="var(--green)"
        />
        <Sparkline
          data={failedData}
          label="Jobs Failed"
          currentValue={failedData[failedData.length - 1] ?? '0'}
          colour="var(--red)"
        />
        <Sparkline
          data={sessionsData}
          label="Sessions Per Day"
          currentValue={sessionsData[sessionsData.length - 1] ?? '0'}
          colour="var(--purple)"
        />
      </div>

      {/* Daily breakdown table */}
      {daily.length > 0 && (
        <div className="trends-daily-table">
          <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', marginBottom: '6px' }}>
            Daily breakdown
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-xs)' }}>
            <thead>
              <tr style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border2)' }}>
                <th style={{ textAlign: 'left', padding: '3px 6px', fontWeight: 'normal' }}>Date (AEST)</th>
                <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 'normal' }}>Cost (est.)</th>
                <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 'normal' }}>Tokens</th>
                <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 'normal' }}>Jobs ✓/✗</th>
              </tr>
            </thead>
            <tbody>
              {[...daily].reverse().map(d => (
                <tr key={d.date} style={{ borderBottom: '1px solid var(--border2)', opacity: 0.85 }}>
                  <td style={{ padding: '3px 6px', color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>{formatDateAEST(d.date)}</td>
                  <td style={{ padding: '3px 6px', textAlign: 'right', color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>${d.costUsd.toFixed(2)}</td>
                  <td style={{ padding: '3px 6px', textAlign: 'right', color: 'var(--blue)', fontVariantNumeric: 'tabular-nums' }}>{(d.tokensIn + d.tokensOut).toLocaleString()}</td>
                  <td style={{ padding: '3px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ color: 'var(--green)' }}>{d.jobsCompleted}</span>
                    {' / '}
                    <span style={{ color: d.jobsFailed > 0 ? 'var(--red)' : 'var(--text3)' }}>{d.jobsFailed}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: '6px', fontSize: 'var(--fs-xs)', color: 'var(--text3)', fontStyle: 'italic' }}>
            * Cost estimated at API rates ($3/MTok in, $15/MTok out) — not actual subscription charges
          </div>
        </div>
      )}
    </div>
  );
}
