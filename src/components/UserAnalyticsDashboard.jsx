import React, { useEffect, useMemo, useRef, useState } from 'react';

const MAIN_DASHBOARD_PATH = '/admin';
const USER_ANALYTICS_PATH = '/admin/pages/user-analytics';

const UserAnalyticsDashboard = () => {
  const [insights, setInsights] = useState(null);
  const [dailyStats, setDailyStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const refreshIntervalRef = useRef(null);
  const chartRef = useRef(null);
  const [activityRange, setActivityRange] = useState(30);

  const fetchData = async (range = activityRange) => {
    try {
      setError(null);

      const fetchOptions = {
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const [insightsResponse, dailyResponse] = await Promise.all([
        fetch('/api/stats/insights', fetchOptions),
        fetch(`/api/stats/daily?days=${range}`, fetchOptions)
      ]);

      if (!insightsResponse.ok) {
        throw new Error(`Failed to fetch insights: ${insightsResponse.status}`);
      }
      const insightsData = await insightsResponse.json();
      setInsights(insightsData);

      if (!dailyResponse.ok) {
        throw new Error(`Failed to fetch daily stats: ${dailyResponse.status}`);
      }
      const dailyData = await dailyResponse.json();
      setDailyStats(dailyData);
    } catch (fetchError) {
      console.error('Error fetching user analytics data:', fetchError);
      setError(fetchError.message);
    }
  };

  useEffect(() => {
    const initialFetch = async () => {
      setLoading(true);
      await fetchData(activityRange);
      setLoading(false);
    };
    initialFetch();
  }, [activityRange]);

  useEffect(() => {
    if (autoRefresh) {
      const intervalId = setInterval(() => fetchData(activityRange), refreshInterval * 1000);
      refreshIntervalRef.current = intervalId;
      return () => clearInterval(intervalId);
    }

    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  }, [autoRefresh, refreshInterval, activityRange]);

  useEffect(() => {
    if (!loading && !error && dailyStats.length > 0) {
      const loadScript = (src, onLoad) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = onLoad;
        script.onerror = () => setError(`Failed to load script: ${src}`);
        document.head.appendChild(script);
        return script;
      };

      const loadChartScripts = () => {
        if (window.Chart && window.Chart._adapters) {
          createChart();
          return;
        }

        loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js', () => {
          loadScript('https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.min.js', () => {
            setTimeout(createChart, 100);
          });
        });
      };

      loadChartScripts();
    } else if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
  }, [loading, error, dailyStats]);

  const createChart = () => {
    if (!window.Chart) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = document.getElementById('dailyActivityChart');
    if (ctx && dailyStats.length > 0) {
      const sortedData = [...dailyStats].sort((a, b) => new Date(a._id) - new Date(b._id));

      chartRef.current = new window.Chart(ctx, {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'Messages',
              data: sortedData.map(item => ({ x: item._id, y: item.total_msgs })),
              borderColor: '#4facfe',
              backgroundColor: 'rgba(79, 172, 254, 0.1)',
              tension: 0.4,
              fill: true
            },
            {
              label: 'Reactions',
              data: sortedData.map(item => ({ x: item._id, y: item.total_reacts })),
              borderColor: '#f093fb',
              backgroundColor: 'rgba(240, 147, 251, 0.1)',
              tension: 0.4,
              fill: true
            },
            {
              label: 'DMs Sent',
              data: sortedData.map(item => ({ x: item._id, y: item.total_dms_sent })),
              borderColor: '#43e97b',
              backgroundColor: 'rgba(67, 233, 123, 0.1)',
              tension: 0.4,
              fill: true
            },
            {
              label: 'New Players',
              data: sortedData.map(item => ({ x: item._id, y: item.total_became_player })),
              borderColor: '#667eea',
              backgroundColor: 'rgba(102, 126, 234, 0.1)',
              tension: 0.4,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'day',
                tooltipFormat: 'PP'
              },
              title: {
                display: true,
                text: 'Date'
              }
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Count'
              }
            }
          },
          plugins: {
            title: {
              display: true,
              text: `Daily User Activity (Last ${activityRange} Days)`
            },
            legend: {
              position: 'top'
            }
          }
        }
      });
    }
  };

  const refreshIntervals = [
    { label: '10s', value: 10 },
    { label: '30s', value: 30 },
    { label: '60s', value: 60 },
    { label: '5m', value: 300 }
  ];

  const activityRanges = useMemo(() => [
    { label: '7d', value: 7 },
    { label: '14d', value: 14 },
    { label: '30d', value: 30 },
    { label: '90d', value: 90 }
  ], []);

  const reactionRate = useMemo(() => {
    if (!insights || !insights.avg_msgs) return 0;
    return (insights.avg_reacts || 0) / (insights.avg_msgs || 1);
  }, [insights]);

  const dmSuccessRate = useMemo(() => {
    if (!insights) return 0;
    const sent = insights.avg_dm_sent || 0;
    const lost = insights.avg_lost_due_cancel || 0;
    if (sent + lost === 0) return 0;
    return sent / (sent + lost);
  }, [insights]);

  const averageDailyActivity = useMemo(() => {
    if (!dailyStats.length) return 0;
    const total = dailyStats.reduce((sum, day) => sum + (day.total_msgs + day.total_reacts), 0);
    return total / dailyStats.length;
  }, [dailyStats]);

  if (loading) {
    return React.createElement('div', { style: { padding: '40px', textAlign: 'center', backgroundColor: '#f8f9fa', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, [
      React.createElement('div', { key: 'loader' }, [
        React.createElement('div', { key: 'spinner', style: { width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #667eea', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' } }),
        React.createElement('h2', { key: 'text', style: { color: '#666', margin: 0 } }, 'Loading User Analytics...')
      ])
    ]);
  }

  if (error) {
    return React.createElement('div', { style: { padding: '40px', textAlign: 'center', backgroundColor: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '8px', margin: '20px', color: '#c53030' } }, [
      React.createElement('h2', { key: 'title', style: { marginBottom: '10px' } }, 'Analytics Error'),
      React.createElement('p', { key: 'message', style: { margin: 0 } }, error)
    ]);
  }

  const metricConfigs = [
    {
      key: 'total-users',
      title: 'Total Users',
      value: insights?.total_users || 0,
      color: '#667eea',
      icon: '👥',
      subtitle: 'Registered users'
    },
    {
      key: 'total-players',
      title: 'Total Players',
      value: insights?.total_players_count || 0,
      color: '#5b21b6',
      icon: '🎮',
      subtitle: 'Players recorded across squads'
    },
    {
      key: 'cancel-rate',
      title: 'Cancel Rate',
      value: `${((insights?.cancel_rate || 0) * 100).toFixed(1)}%`,
      color: '#ff6b6b',
      icon: '🚫',
      subtitle: `${insights?.canceled_users || 0} canceled users`
    },
    {
      key: 'avg-messages',
      title: 'Avg Messages/User',
      value: insights?.avg_msgs || 0,
      color: '#4facfe',
      icon: '💬',
      subtitle: 'Messages per user',
      isDecimal: true
    },
    {
      key: 'avg-reactions',
      title: 'Avg Reactions/User',
      value: insights?.avg_reacts || 0,
      color: '#f093fb',
      icon: '❤️',
      subtitle: 'Reactions per user',
      isDecimal: true
    },
    {
      key: 'avg-dms',
      title: 'Avg DMs Sent/User',
      value: insights?.avg_dm_sent || 0,
      color: '#43e97b',
      icon: '📨',
      subtitle: 'DMs sent per user',
      isDecimal: true
    },
    {
      key: 'avg-lost',
      title: 'Avg Lost DMs/User',
      value: insights?.avg_lost_due_cancel || 0,
      color: '#ffa726',
      icon: '📭',
      subtitle: 'DMs lost to cancellation',
      isDecimal: true
    },
    {
      key: 'avg-players',
      title: 'Avg Player Events/User',
      value: insights?.avg_player || 0,
      color: '#9c88ff',
      icon: '🎮',
      subtitle: 'Player events per user',
      isDecimal: true
    },
    {
      key: 'reaction-rate',
      title: 'Reaction Rate',
      value: `${reactionRate.toFixed(2)} reactions/message`,
      color: '#e91e63',
      icon: '💖',
      subtitle: 'Average reactions per message',
      isDecimal: false
    },
    {
      key: 'message-rate',
      title: 'Messages/User Base',
      value: `${(insights?.avg_msgs || 0).toFixed(1)}/user`,
      color: '#2196f3',
      icon: '📊',
      subtitle: 'Message rate per user',
      isDecimal: false
    },
    {
      key: 'dm-rate',
      title: 'DMs/User Base',
      value: `${(insights?.avg_dm_sent || 0).toFixed(1)}/user`,
      color: '#4caf50',
      icon: '📬',
      subtitle: 'DM rate per user',
      isDecimal: false
    }
  ];

  const rangeButtons = activityRanges.map(range => React.createElement('button', {
    key: range.value,
    onClick: () => setActivityRange(range.value),
    style: {
      background: activityRange === range.value ? '#667eea' : '#f8f9fa',
      color: activityRange === range.value ? 'white' : '#333',
      border: '1px solid #e2e8f0',
      padding: '8px 12px',
      marginLeft: '5px',
      borderRadius: '6px',
      cursor: 'pointer',
      fontWeight: '500'
    }
  }, range.label));

  return React.createElement('div', { style: { padding: '20px', backgroundColor: '#f8f9fa', minHeight: '100vh' } }, [
    React.createElement('style', { key: 'styles' }, `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`),

    React.createElement('div', { key: 'header', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' } }, [
      React.createElement('h1', { key: 'title', style: { margin: 0, color: '#333', fontSize: '28px', fontWeight: 'bold' } }, 'User Analytics Dashboard'),
      React.createElement('div', { key: 'controls', style: { display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' } }, [
        React.createElement('label', { key: 'refresh-label', style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#666' } }, [
          React.createElement('input', {
            key: 'refresh-checkbox',
            type: 'checkbox',
            checked: autoRefresh,
            onChange: (e) => setAutoRefresh(e.target.checked),
            style: { margin: 0 }
          }),
          'Auto Refresh'
        ]),
        autoRefresh && React.createElement('select', {
          key: 'refresh-interval',
          value: refreshInterval,
          onChange: (e) => setRefreshInterval(parseInt(e.target.value, 10)),
          style: { padding: '6px 10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }
        }, refreshIntervals.map(interval =>
          React.createElement('option', { key: interval.value, value: interval.value }, interval.label)
        )),
        React.createElement('button', {
          key: 'manual-refresh',
          onClick: () => fetchData(activityRange),
          style: {
            background: '#667eea',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }
        }, '🔄 Refresh')
      ])
    ]),

    React.createElement('div', { key: 'nav-cards', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' } }, [
      React.createElement(NavCard, {
        key: 'main-dashboard',
        href: MAIN_DASHBOARD_PATH,
        label: 'Main Dashboard',
        description: 'View real-time squad activity metrics.',
        icon: '🏠'
      }),
      React.createElement(NavCard, {
        key: 'user-analytics',
        href: USER_ANALYTICS_PATH,
        label: 'User Analytics',
        description: 'Dive deeper into user engagement trends.',
        icon: '📊',
        active: true
      })
    ]),

    React.createElement('div', { key: 'metrics', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '40px' } },
      metricConfigs.map(config => React.createElement(MetricBox, {
        key: config.key,
        title: config.title,
        value: config.value,
        color: config.color,
        icon: config.icon,
        subtitle: config.subtitle,
        isDecimal: config.isDecimal
      }))
    ),

    React.createElement('div', { key: 'chart-container', style: { backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', marginBottom: '30px' } }, [
      React.createElement('div', { key: 'chart-header', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' } }, [
        React.createElement('h3', { key: 'chart-title', style: { color: '#333', fontSize: '18px', fontWeight: '600', margin: 0 } }, 'Daily User Activity'),
        React.createElement('div', { key: 'range-buttons' }, rangeButtons)
      ]),
      React.createElement('div', { key: 'canvas-container', style: { height: '400px', position: 'relative' } },
        React.createElement('canvas', { id: 'dailyActivityChart', style: { width: '100%', height: '100%' } })
      )
    ]),

    React.createElement('div', { key: 'insights-grid', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px' } }, [
      React.createElement('div', { key: 'engagement-card', style: { backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' } }, [
        React.createElement('h3', { key: 'title', style: { marginBottom: '20px', color: '#333', fontSize: '18px', fontWeight: '600' } }, 'User Engagement'),
        React.createElement('p', { key: 'help-text', style: { fontSize: '14px', color: '#666', marginBottom: '20px', fontStyle: 'italic' } },
          'Understand how often users chat, react, and connect with each other so you can spot healthy communities or users who may need support.'
        ),
        React.createElement('div', { key: 'engagement-stats', style: { display: 'flex', flexDirection: 'column', gap: '15px' } }, [
        React.createElement(InsightRow, {
          key: 'msg-react-ratio',
          label: 'Message to Reaction Ratio (how often users react)',
          value: `${reactionRate.toFixed(2)} reactions/message`,
          color: '#4facfe'
        }),
          React.createElement(InsightRow, {
            key: 'dm-success',
            label: 'DM Success Rate (not blocked by cancellation)',
            value: `${(dmSuccessRate * 100).toFixed(1)}%`,
            color: '#43e97b'
          }),
          React.createElement(InsightRow, {
            key: 'player-conversion',
            label: 'Player Conversion Rate (messages that become games)',
            value: `${(((insights?.avg_player || 0) / (insights?.avg_msgs || 1)) * 100).toFixed(2)}%`,
            color: '#9c88ff'
          })
        ])
      ]),
      React.createElement('div', { key: 'health-card', style: { backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' } }, [
        React.createElement('h3', { key: 'title', style: { marginBottom: '20px', color: '#333', fontSize: '18px', fontWeight: '600' } }, 'Platform Health'),
        React.createElement('div', { key: 'health-stats', style: { display: 'flex', flexDirection: 'column', gap: '15px' } }, [
          React.createElement(InsightRow, {
            key: 'active-users',
            label: 'Active Users',
            value: `${((insights?.total_users || 0) - (insights?.canceled_users || 0)).toLocaleString()}`,
            color: '#0369a1',
            background: '#f0f9ff',
            borderColor: '#e0f2fe'
          }),
          React.createElement(InsightRow, {
            key: 'retention',
            label: 'User Retention',
            value: `${(((1 - (insights?.cancel_rate || 0)) * 100)).toFixed(1)}%`,
            color: insights?.cancel_rate > 0.3 ? '#dc2626' : '#16a34a',
            background: insights?.cancel_rate > 0.3 ? '#fef2f2' : '#f0fdf4',
            borderColor: insights?.cancel_rate > 0.3 ? '#fecaca' : '#bbf7d0'
          }),
          React.createElement(InsightRow, {
            key: 'avg-activity',
            label: 'Avg Daily Activity',
            value: `${averageDailyActivity.toFixed(0)} events/day`,
            color: '#a16207',
            background: '#fefce8',
            borderColor: '#fef3c7'
          })
        ])
      ])
    ])
  ]);
};

const InsightRow = ({ label, value, color, background = '#f8f9fa', borderColor = '#e2e8f0' }) => (
  React.createElement('div', {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px',
      backgroundColor: background,
      borderRadius: '6px',
      border: `1px solid ${borderColor}`
    }
  }, [
    React.createElement('span', { key: 'label', style: { fontWeight: '500', color: '#555' } }, label),
    React.createElement('span', { key: 'value', style: { fontWeight: 'bold', color } }, value)
  ])
);

const MetricBox = ({ title, value, color, icon, subtitle, isDecimal = false }) => {
  const displayValue = isDecimal
    ? (typeof value === 'number' ? value.toFixed(2) : value)
    : (typeof value === 'number' ? value.toLocaleString() : value);

  return React.createElement('div', {
    style: {
      backgroundColor: 'white',
      padding: '20px',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      border: '1px solid #e2e8f0',
      borderLeft: `4px solid ${color}`,
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      cursor: 'pointer'
    },
    onMouseEnter: (e) => {
      const target = e.currentTarget;
      target.style.transform = 'translateY(-2px)';
      target.style.boxShadow = '0 8px 15px rgba(0,0,0,0.15)';
    },
    onMouseLeave: (e) => {
      const target = e.currentTarget;
      target.style.transform = 'translateY(0)';
      target.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    }
  }, [
    React.createElement('div', { key: 'header', style: { display: 'flex', alignItems: 'center', marginBottom: '12px' } }, [
      React.createElement('span', { key: 'icon', style: { fontSize: '20px', marginRight: '8px' } }, icon),
      React.createElement('h3', { key: 'title', style: { margin: 0, fontSize: '12px', color: '#666', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' } }, title)
    ]),
    React.createElement('div', { key: 'value', style: { fontSize: '24px', fontWeight: 'bold', color, lineHeight: '1', marginBottom: '4px' } }, displayValue),
    React.createElement('div', { key: 'subtitle', style: { fontSize: '11px', color: '#888', fontWeight: '400' } }, subtitle)
  ]);
};

const NavCard = ({ href, label, description, icon, active = false }) => {
  const baseStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '20px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    backgroundColor: active ? '#eef2ff' : 'white',
    boxShadow: active ? '0 8px 20px rgba(102, 126, 234, 0.25)' : '0 4px 6px rgba(0,0,0,0.08)',
    color: '#1f2937',
    textDecoration: 'none',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    cursor: 'pointer'
  };

  return React.createElement('a', {
    href,
    style: baseStyle,
    onMouseEnter: (e) => {
      const target = e.currentTarget;
      target.style.transform = 'translateY(-3px)';
      target.style.boxShadow = '0 10px 20px rgba(102, 126, 234, 0.25)';
    },
    onMouseLeave: (e) => {
      const target = e.currentTarget;
      target.style.transform = 'translateY(0)';
      target.style.boxShadow = active ? '0 8px 20px rgba(102, 126, 234, 0.25)' : '0 4px 6px rgba(0,0,0,0.08)';
    }
  }, [
    React.createElement('div', { key: 'icon', style: { fontSize: '24px' } }, icon),
    React.createElement('div', { key: 'label', style: { fontWeight: '600', fontSize: '16px' } }, label),
    React.createElement('div', { key: 'description', style: { fontSize: '13px', color: '#4b5563' } }, description)
  ]);
};

export default UserAnalyticsDashboard;
