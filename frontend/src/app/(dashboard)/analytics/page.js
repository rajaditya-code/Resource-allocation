'use client';

import { useFetch } from '@/hooks/useFetch';
import { CHART_COLORS } from '@/lib/constants';
import { formatNumber } from '@/lib/utils';
import {
  BarChart3, TrendingUp, PieChart as PieChartIcon, Activity, Cpu, Users,
  Layers, Flame, Clock, Zap, CalendarDays, Grid3x3, Shield, ListOrdered,
} from 'lucide-react';
import { useEffect, useRef } from 'react';

// Lazy chart registration
let chartsRegistered = false;
function registerCharts() {
  if (chartsRegistered) return;
  const {
    Chart, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement,
    Title, Tooltip, Legend, Filler, BarController, LineController, DoughnutController
  } = require('chart.js');
  Chart.register(
    CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement,
    Title, Tooltip, Legend, Filler, BarController, LineController, DoughnutController
  );
  chartsRegistered = true;
}

function ChartCard({ title, icon: Icon, children }) {
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {Icon && <Icon size={18} style={{ color: 'var(--color-primary)' }} />}
          <h3 className="chart-card-title">{title}</h3>
        </div>
      </div>
      {children}
    </div>
  );
}

function BarChartComponent({ data, label }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!data || !canvasRef.current) return;
    registerCharts();
    const { Chart } = require('chart.js');

    if (chartRef.current) chartRef.current.destroy();

    let labels, values;
    if (Array.isArray(data)) {
      labels = data.map(d => d.name || d.label || d.asset_name || '');
      values = data.map(d => d.count || d.value || d.total_bookings || 0);
    } else if (data.labels && (data.values || data.datasets)) {
      labels = data.labels;
      values = data.values || (data.datasets?.[0]?.data) || [];
    } else {
      return;
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: label || 'Count',
          data: values,
          backgroundColor: CHART_COLORS.slice(0, values.length),
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { grid: { color: 'rgba(148,163,184,0.1)' }, beginAtZero: true },
        },
      },
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [data, label]);

  return <div style={{ height: 280 }}><canvas ref={canvasRef} /></div>;
}

function LineChartComponent({ data }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!data || !canvasRef.current) return;
    registerCharts();
    const { Chart } = require('chart.js');

    if (chartRef.current) chartRef.current.destroy();

    let labels, values;
    if (Array.isArray(data)) {
      labels = data.map(d => d.month || d.label || d.period || '');
      values = data.map(d => d.count || d.value || d.bookings || 0);
    } else if (data.labels && data.datasets) {
      labels = data.labels;
      values = data.datasets[0]?.data || [];
    } else if (data.labels && data.values) {
      labels = data.labels;
      values = data.values;
    } else {
      return;
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Bookings',
          data: values,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#6366f1',
          pointBorderWidth: 0,
          pointRadius: 4,
          pointHoverRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { grid: { color: 'rgba(148,163,184,0.1)' }, beginAtZero: true },
        },
      },
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [data]);

  return <div style={{ height: 280 }}><canvas ref={canvasRef} /></div>;
}

function DoughnutChartComponent({ data }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!data || !canvasRef.current) return;
    registerCharts();
    const { Chart } = require('chart.js');

    if (chartRef.current) chartRef.current.destroy();

    let labels, values;
    if (Array.isArray(data)) {
      labels = data.map(d => d.category || d.name || d.label || '');
      values = data.map(d => d.count || d.value || d.total || 0);
    } else if (data.labels && data.values) {
      labels = data.labels;
      values = data.values;
    } else {
      return;
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: CHART_COLORS.slice(0, values.length),
          borderWidth: 0,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 16, font: { size: 12 }, usePointStyle: true, pointStyle: 'circle' } },
        },
        cutout: '65%',
      },
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [data]);

  return <div style={{ height: 300 }}><canvas ref={canvasRef} /></div>;
}

function RankTable({ data, label, valueLabel }) {
  if (!data || !Array.isArray(data) || data.length === 0) return <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>No data available</p>;
  return (
    <div className="table-container">
      <table className="table">
        <thead><tr><th>#</th><th>{label}</th><th>{valueLabel}</th></tr></thead>
        <tbody>
          {data.slice(0, 10).map((item, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 700, color: i < 3 ? 'var(--color-primary)' : 'var(--text-tertiary)' }}>{i + 1}</td>
              <td style={{ fontWeight: 600 }}>{item.name || item.asset_name || item.user_name || item.label || '—'}</td>
              <td>{formatNumber(item.count || item.value || item.total_bookings || item.overdue_count || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Heatmap component for booking/category grids
function HeatmapGrid({ data, title }) {
  if (!data) return null;

  // data can be { rows, columns, values } or an array of { label, data: [...] }
  let rows = [];
  let columns = [];
  let matrix = [];

  if (data.rows && data.columns && data.values) {
    rows = data.rows;
    columns = data.columns;
    matrix = data.values;
  } else if (Array.isArray(data)) {
    rows = data.map(r => r.label || r.name || r.day || '');
    if (data.length > 0 && Array.isArray(data[0].data)) {
      columns = data[0].data.map((_, i) => `${i}`);
      matrix = data.map(r => r.data);
    } else {
      return <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>Invalid heatmap data</p>;
    }
  } else {
    return <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>No heatmap data</p>;
  }

  const allValues = matrix.flat();
  const maxVal = Math.max(...allValues, 1);

  const getCellColor = (val) => {
    if (!val) return 'var(--bg-surface-hover)';
    const intensity = Math.min(val / maxVal, 1);
    const alpha = 0.15 + intensity * 0.7;
    return `rgba(99, 102, 241, ${alpha})`;
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${columns.length}, 1fr)`, gap: 2, fontSize: 'var(--text-xs)' }}>
        {/* Header row */}
        <div />
        {columns.map((col, i) => (
          <div key={i} style={{ textAlign: 'center', padding: '4px 2px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
            {col}
          </div>
        ))}
        {/* Data rows */}
        {rows.map((row, ri) => (
          <>
            <div key={`label-${ri}`} style={{ padding: '6px 4px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row}
            </div>
            {(matrix[ri] || []).map((val, ci) => (
              <div key={`${ri}-${ci}`} style={{
                background: getCellColor(val),
                borderRadius: 'var(--radius-sm)',
                padding: '6px 2px',
                textAlign: 'center',
                fontWeight: val > 0 ? 600 : 400,
                color: val > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
                minWidth: 28,
              }}>
                {val || ''}
              </div>
            ))}
          </>
        ))}
      </div>
    </div>
  );
}

// Helper to extract card values from backend { cards: [{ label, value }] }
function getCardValue(cards, keyword) {
  if (!Array.isArray(cards)) return 0;
  const card = cards.find((c) => c.label?.toLowerCase().includes(keyword.toLowerCase()));
  return card?.value ?? 0;
}

export default function AnalyticsPage() {
  const { data: summary } = useFetch('/analytics/summary');
  const { data: utilization } = useFetch('/analytics/asset-utilization', { params: { limit: 10 } });
  const { data: trends } = useFetch('/analytics/booking-trends', { params: { months: 12 } });
  const { data: categoryDist } = useFetch('/analytics/category-distribution');
  const { data: maintStats } = useFetch('/analytics/maintenance-stats');
  const { data: mostBooked } = useFetch('/analytics/most-booked', { params: { limit: 10 } });
  const { data: mostOverdue } = useFetch('/analytics/most-overdue', { params: { limit: 10 } });
  const { data: demandPred } = useFetch('/analytics/demand-prediction');
  const { data: clubUsage } = useFetch('/analytics/club-usage');
  // Phase 2: Additional analytics endpoints
  const { data: peakUsage } = useFetch('/analytics/peak-usage');
  const { data: maintFreq } = useFetch('/analytics/maintenance-frequency', { params: { limit: 10 } });
  const { data: heatmapDays } = useFetch('/analytics/heatmap/bookings-by-day');
  const { data: heatmapCats } = useFetch('/analytics/heatmap/categories-by-month');
  const { data: reliabilityDist } = useFetch('/analytics/reliability-distribution');
  const { data: queueStats } = useFetch('/analytics/queue-stats');

  // Backend returns { cards: [{ label, value, ... }] }
  const summaryCards = summary?.cards;

  const kpiCards = summaryCards ? [
    { label: 'Total Assets', value: getCardValue(summaryCards, 'asset'), icon: Layers, color: 'var(--color-primary)' },
    { label: 'Active Bookings', value: getCardValue(summaryCards, 'active') || getCardValue(summaryCards, 'booking'), icon: Activity, color: 'var(--color-success)' },
    { label: 'Open Tickets', value: getCardValue(summaryCards, 'maintenance') || getCardValue(summaryCards, 'open') || getCardValue(summaryCards, 'ticket'), icon: Flame, color: 'var(--color-warning)' },
    { label: 'Total Users', value: getCardValue(summaryCards, 'user'), icon: Users, color: 'var(--color-accent)' },
  ] : [];

  // Backend returns { most_utilized: [...], least_utilized: [...] } for utilization
  const utilizationData = utilization?.most_utilized || (Array.isArray(utilization) ? utilization : utilization?.data);

  // Backend returns { users: [...] } for most-overdue
  const overdueData = mostOverdue?.users || (Array.isArray(mostOverdue) ? mostOverdue : mostOverdue?.data);

  // Backend returns { clubs: [...] } for club-usage
  const clubData = clubUsage?.clubs || (Array.isArray(clubUsage) ? clubUsage : clubUsage?.data);

  // Maintenance stats data
  const maintStatsCards = maintStats ? [
    { label: 'Open', value: maintStats.open || maintStats.open_count || 0, color: 'var(--color-warning)' },
    { label: 'In Progress', value: maintStats.in_progress || maintStats.in_progress_count || 0, color: 'var(--color-info)' },
    { label: 'Resolved', value: maintStats.resolved || maintStats.resolved_count || 0, color: 'var(--color-success)' },
    { label: 'Avg Resolution', value: `${maintStats.avg_resolution_hours || maintStats.avg_resolution_time || 0}h`, color: 'var(--text-secondary)' },
  ] : [];

  // Maintenance frequency data
  const maintFreqData = maintFreq?.data || (Array.isArray(maintFreq) ? maintFreq : null);

  // Peak usage data
  const peakUsageData = peakUsage?.data || (Array.isArray(peakUsage) ? peakUsage : null);

  // Queue stats
  const queueStatsCards = queueStats ? [
    { label: 'Active Queues', value: queueStats.active_queues || queueStats.total_queues || 0, color: 'var(--color-primary)' },
    { label: 'Total Waiting', value: queueStats.total_waiting || queueStats.users_in_queue || 0, color: 'var(--color-warning)' },
    { label: 'Avg Wait Time', value: `${queueStats.avg_wait_days || queueStats.avg_wait_time || 0}d`, color: 'var(--text-secondary)' },
  ] : [];

  // Reliability distribution
  const reliabilityDistData = reliabilityDist?.data || (Array.isArray(reliabilityDist) ? reliabilityDist : null);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title"><BarChart3 size={28} /> Analytics Dashboard</h1>
          <p className="page-subtitle">Insights and predictions for resource management</p>
        </div>
      </div>

      {/* KPI Cards */}
      {kpiCards.length > 0 && (
        <div className="grid-cols-4" style={{ marginBottom: 'var(--space-6)' }}>
          {kpiCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="stats-card animate-fade-in-up" style={{ animationDelay: `${idx * 80}ms` }}>
                <div className="stats-card-icon" style={{ background: `${card.color}18` }}>
                  <Icon size={22} style={{ color: card.color }} />
                </div>
                <div className="stats-card-value">{formatNumber(card.value || 0)}</div>
                <div className="stats-card-label">{card.label}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid-cols-2" style={{ marginBottom: 'var(--space-6)', alignItems: 'start' }}>
        <ChartCard title="Booking Trends" icon={TrendingUp}>
          <LineChartComponent data={trends} />
        </ChartCard>
        <ChartCard title="Category Distribution" icon={PieChartIcon}>
          <DoughnutChartComponent data={categoryDist} />
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid-cols-2" style={{ marginBottom: 'var(--space-6)', alignItems: 'start' }}>
        <ChartCard title="Asset Utilization" icon={BarChart3}>
          <BarChartComponent data={utilizationData} label="Bookings" />
        </ChartCard>
        <ChartCard title="Demand Forecast (AI)" icon={Cpu}>
          {demandPred ? (
            <BarChartComponent data={demandPred} label="Predicted Demand" />
          ) : (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
              <Cpu size={32} style={{ opacity: 0.3 }} />
            </div>
          )}
        </ChartCard>
      </div>

      {/* Peak Usage & Maintenance Frequency */}
      <div className="grid-cols-2" style={{ marginBottom: 'var(--space-6)', alignItems: 'start' }}>
        <ChartCard title="Peak Usage Hours" icon={Zap}>
          {peakUsageData ? (
            <BarChartComponent data={peakUsageData} label="Bookings" />
          ) : (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
              <Zap size={32} style={{ opacity: 0.3 }} />
            </div>
          )}
        </ChartCard>
        <ChartCard title="Maintenance Frequency" icon={Flame}>
          <RankTable data={maintFreqData} label="Asset" valueLabel="Tickets" />
        </ChartCard>
      </div>

      {/* Maintenance Stats */}
      {maintStatsCards.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <Flame size={18} style={{ color: 'var(--color-warning)' }} />
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Maintenance Overview</h3>
          </div>
          <div className="grid-cols-4" style={{ gap: 'var(--space-4)' }}>
            {maintStatsCards.map((stat) => (
              <div key={stat.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heatmaps */}
      <div className="grid-cols-2" style={{ marginBottom: 'var(--space-6)', alignItems: 'start' }}>
        {heatmapDays && (
          <ChartCard title="Bookings by Day of Week" icon={CalendarDays}>
            <HeatmapGrid data={heatmapDays} />
          </ChartCard>
        )}
        {heatmapCats && (
          <ChartCard title="Categories by Month" icon={Grid3x3}>
            <HeatmapGrid data={heatmapCats} />
          </ChartCard>
        )}
      </div>

      {/* Queue Stats */}
      {queueStatsCards.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <ListOrdered size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Queue Statistics</h3>
          </div>
          <div className="grid-cols-3" style={{ gap: 'var(--space-4)' }}>
            {queueStatsCards.map((stat) => (
              <div key={stat.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reliability Distribution */}
      {reliabilityDistData && (
        <ChartCard title="Reliability Score Distribution" icon={Shield}>
          <BarChartComponent data={reliabilityDistData} label="Users" />
        </ChartCard>
      )}

      {/* Spacer */}
      {reliabilityDistData && <div style={{ marginBottom: 'var(--space-6)' }} />}

      {/* Tables Row */}
      <div className="grid-cols-2" style={{ marginBottom: 'var(--space-6)', alignItems: 'start' }}>
        <ChartCard title="Most Booked Assets" icon={Activity}>
          <RankTable data={mostBooked?.data || (Array.isArray(mostBooked) ? mostBooked : null)} label="Asset" valueLabel="Bookings" />
        </ChartCard>
        <ChartCard title="Most Overdue Users" icon={Clock}>
          <RankTable data={overdueData} label="User" valueLabel="Overdue Count" />
        </ChartCard>
      </div>

      {/* Club Usage */}
      {clubData && (
        <ChartCard title="Club Usage" icon={Users}>
          <BarChartComponent data={clubData} label="Bookings" />
        </ChartCard>
      )}
    </div>
  );
}
