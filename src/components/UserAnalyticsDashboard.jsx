const { useState, useEffect } = React;

const UserAnalyticsDashboard = (props) => {
  const [insights, setInsights] = useState(null);
  const [dailyStats, setDailyStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds
  const [refreshIntervalId, setRefreshIntervalId] = useState(null);
  const [chartInstance, setChartInstance] = useState(null);

  const fetchData = async () => {
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
        fetch('/api/stats/daily?days=30', fetchOptions)
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

    } catch (error) {
      console.error('Error fetching user analytics data:', error);
      setError(error.message);
    }
  };

  useEffect(() => {
    const initialFetch = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };
    initialFetch();
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      const intervalId = setInterval(fetchData, refreshInterval * 1000);
      setRefreshIntervalId(intervalId);
      return () => clearInterval(intervalId);
    } else if (refreshIntervalId) {
      clearInterval(refreshIntervalId);
      setRefreshIntervalId(null);
    }
  }, [autoRefresh, refreshInterval]);

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
    }
  }, [loading, error, dailyStats]);

  const createChart = () => {
    if (!window.Chart) return;

    const existingChart = window.Chart.getChart('dailyActivityChart');
    if (existingChart) existingChart.destroy();

    const ctx = document.getElementById('dailyActivityChart');
    if (ctx && dailyStats.length > 0) {
      const sortedData = dailyStats.sort((a, b) => new Date(a._id) - new Date(b._id));
      
      const newChartInstance = new window.Chart(ctx, {
        type: 'line',
        data: {
          datasets: [{
            label: 'Messages',
            data: sortedData.map(item => ({ x: item._id, y: item.total_msgs })),
            borderColor: '#4facfe',
            backgroundColor: 'rgba(79, 172, 254, 0.1)',
            tension: 0.4,
            fill: true
          }, {
            label: 'Reactions',
            data: sortedData.map(item => ({ x: item._id, y: item.total_reacts })),
            borderColor: '#f093fb',
            backgroundColor: 'rgba(240, 147, 251, 0.1)',
            tension: 0.4,
            fill: true
          }, {
            label: 'DMs Sent',
            data: sortedData.map(item => ({ x: item._id, y: item.total_dms_sent })),
            borderColor: '#43e97b',
            backgroundColor: 'rgba(67, 233, 123, 0.1)',
            tension: 0.4,
            fill: true
          }, {
            label: 'New Players',
            data: sortedData.map(item => ({ x: item._id, y: item.total_became_player })),
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            tension: 0.4,
            fill: true
          }]
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
              text: 'Daily User Activity (Last 30 Days)'
            },
            legend: {
              position: 'top'
            }
          }
        }
      });
      setChartInstance(newChartInstance);
    }
  };

  const refreshIntervals = [
    { label: '10s', value: 10 },
    { label: '30s', value: 30 },
    { label: '60s', value: 60 },
    { label: '5m', value: 300 }
  ];

  if (loading) {
    return React.createElement('div', { style: { padding: '40px', textAlign: 'center', backgroundColor: '#f8f9fa', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}, [
      React.createElement('div', { key: 'loader' }, [
        React.createElement('div', { key: 'spinner', style: { width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #667eea', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }}),
        React.createElement('h2', { key: 'text', style: { color: '#666', margin: 0 }}, 'Loading User Analytics...')
      ])
    ]);
  }

  if (error) {
    return React.createElement('div', { style: { padding: '40px', textAlign: 'center', backgroundColor: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '8px', margin: '20px', color: '#c53030'}}, [
      React.createElement('h2', { key: 'title', style: { marginBottom: '10px' }}, 'Analytics Error'),
      React.createElement('p', { key: 'message', style: { margin: 0 }}, error)
    ]);
  }

  return React.createElement('div', { style: { padding: '20px', backgroundColor: '#f8f9fa', minHeight: '100vh' }}, [
    React.createElement('style', { key: 'styles' }, `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`),

    // Header with auto-refresh controls
    React.createElement('div', { key: 'header', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}, [
      React.createElement('h1', { key: 'title', style: { margin: 0, color: '#333', fontSize: '28px', fontWeight: 'bold' }}, 'User Analytics Dashboard'),
      React.createElement('div', { key: 'controls', style: { display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}, [
        React.createElement('label', { key: 'refresh-label', style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#666' }}, [
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
          onChange: (e) => setRefreshInterval(parseInt(e.target.value)),
          style: { padding: '6px 10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }
        }, refreshIntervals.map(interval =>
          React.createElement('option', { key: interval.value, value: interval.value }, interval.label)
        )),
        React.createElement('button', {
          key: 'manual-refresh',
          onClick: fetchData,
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

    // Key Metrics Grid
    React.createElement('div', { key: 'metrics', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '40px' }}, [
      React.createElement(MetricBox, { 
        key: 'total-users', 
        title: 'Total Users', 
        value: insights?.total_users || 0, 
        color: '#667eea', 
        icon: '👥',
        subtitle: 'Registered users'
      }),
      React.createElement(MetricBox, { 
        key: 'cancel-rate', 
        title: 'Cancel Rate', 
        value: `${((insights?.cancel_rate || 0) * 100).toFixed(1)}%`, 
        color: '#ff6b6b', 
        icon: '🚫',
        subtitle: `${insights?.canceled_users || 0} canceled users`
      }),
      React.createElement(MetricBox, { 
        key: 'avg-messages', 
        title: 'Avg Messages/User', 
        value: insights?.avg_msgs || 0, 
        color: '#4facfe', 
        icon: '💬',
        subtitle: 'Messages per user',
        isDecimal: true
      }),
      React.createElement(MetricBox, { 
        key: 'avg-reactions', 
        title: 'Avg Reactions/User', 
        value: insights?.avg_reacts || 0, 
        color: '#f093fb', 
        icon: '❤️',
        subtitle: 'Reactions per user',
        isDecimal: true
      }),
      React.createElement(MetricBox, { 
        key: 'avg-dms', 
        title: 'Avg DMs Sent/User', 
        value: insights?.avg_dm_sent || 0, 
        color: '#43e97b', 
        icon: '📨',
        subtitle: 'DMs sent per user',
        isDecimal: true
      }),
      React.createElement(MetricBox, { 
        key: 'avg-lost', 
        title: 'Avg Lost DMs/User', 
        value: insights?.avg_lost_due_cancel || 0, 
        color: '#ffa726', 
        icon: '📭',
        subtitle: 'DMs lost to cancellation',
        isDecimal: true
      }),
      React.createElement(MetricBox, { 
        key: 'avg-players', 
        title: 'Avg Player Events/User', 
        value: insights?.avg_player || 0, 
        color: '#9c88ff', 
        icon: '🎮',
        subtitle: 'Player events per user',
        isDecimal: true
      })
    ]),

    // Daily Activity Chart
    React.createElement('div', { key: 'chart-container', style: { backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', marginBottom: '30px' }}, [
      React.createElement('div', { key: 'canvas-container', style: { height: '400px', position: 'relative' }},
        React.createElement('canvas', { id: 'dailyActivityChart', style: { width: '100%', height: '100%' } })
      )
    ]),

    // Engagement Insights
    React.createElement('div', { key: 'insights-grid', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}, [
      React.createElement('div', { key: 'engagement-card', style: { backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}, [
        React.createElement('h3', { key: 'title', style: { marginBottom: '20px', color: '#333', fontSize: '18px', fontWeight: '600' }}, 'User Engagement'),
        React.createElement('div', { key: 'engagement-stats', style: { display: 'flex', flexDirection: 'column', gap: '15px' }}, [
          React.createElement('div', { key: 'msg-react-ratio', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}, [
            React.createElement('span', { key: 'label', style: { fontWeight: '500', color: '#666' }}, 'Message to Reaction Ratio'),
            React.createElement('span', { key: 'value', style: { fontWeight: 'bold', color: '#4facfe' }}, 
              `1:${((insights?.avg_reacts || 0) / (insights?.avg_msgs || 1)).toFixed(2)}`
            )
          ]),
          React.createElement('div', { key: 'dm-success', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}, [
            React.createElement('span', { key: 'label', style: { fontWeight: '500', color: '#666' }}, 'DM Success Rate'),
            React.createElement('span', { key: 'value', style: { fontWeight: 'bold', color: '#43e97b' }}, 
              `${(((insights?.avg_dm_sent || 0) / ((insights?.avg_dm_sent || 0) + (insights?.avg_lost_due_cancel || 0))) * 100 || 0).toFixed(1)}%`
            )
          ]),
          React.createElement('div', { key: 'player-conversion', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}, [
            React.createElement('span', { key: 'label', style: { fontWeight: '500', color: '#666' }}, 'Player Conversion Rate'),
            React.createElement('span', { key: 'value', style: { fontWeight: 'bold', color: '#9c88ff' }}, 
              `${(((insights?.avg_player || 0) / (insights?.avg_msgs || 1)) * 100).toFixed(2)}%`
            )
          ])
        ])
      ]),
      React.createElement('div', { key: 'health-card', style: { backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}, [
        React.createElement('h3', { key: 'title', style: { marginBottom: '20px', color: '#333', fontSize: '18px', fontWeight: '600' }}, 'Platform Health'),
        React.createElement('div', { key: 'health-stats', style: { display: 'flex', flexDirection: 'column', gap: '15px' }}, [
          React.createElement('div', { key: 'active-users', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#f0f9ff', borderRadius: '6px', border: '1px solid #e0f2fe' }}, [
            React.createElement('span', { key: 'label', style: { fontWeight: '500', color: '#0369a1' }}, 'Active Users'),
            React.createElement('span', { key: 'value', style: { fontWeight: 'bold', color: '#0369a1' }}, 
              `${((insights?.total_users || 0) - (insights?.canceled_users || 0)).toLocaleString()}`
            )
          ]),
          React.createElement('div', { key: 'retention', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: insights?.cancel_rate > 0.3 ? '#fef2f2' : '#f0fdf4', borderRadius: '6px', border: `1px solid ${insights?.cancel_rate > 0.3 ? '#fecaca' : '#bbf7d0'}` }}, [
            React.createElement('span', { key: 'label', style: { fontWeight: '500', color: insights?.cancel_rate > 0.3 ? '#dc2626' : '#16a34a' }}, 'User Retention'),
            React.createElement('span', { key: 'value', style: { fontWeight: 'bold', color: insights?.cancel_rate > 0.3 ? '#dc2626' : '#16a34a' }}, 
              `${(((1 - (insights?.cancel_rate || 0)) * 100)).toFixed(1)}%`
            )
          ]),
          React.createElement('div', { key: 'avg-activity', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#fefce8', borderRadius: '6px', border: '1px solid #fef3c7' }}, [
            React.createElement('span', { key: 'label', style: { fontWeight: '500', color: '#a16207' }}, 'Avg Daily Activity'),
            React.createElement('span', { key: 'value', style: { fontWeight: 'bold', color: '#a16207' }}, 
              `${(dailyStats.reduce((sum, day) => sum + (day.total_msgs + day.total_reacts), 0) / Math.max(dailyStats.length, 1)).toFixed(0)} events/day`
            )
          ])
        ])
      ])
    ])
  ]);
};

const MetricBox = ({ title, value, color, icon, subtitle, isDecimal = false }) => {
  const displayValue = isDecimal ? (typeof value === 'number' ? value.toFixed(2) : value) : (typeof value === 'number' ? value.toLocaleString() : value);
  return React.createElement('div', {
    style: {
      backgroundColor: 'white',
      padding: '20px',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      border: '1px solid #e2e8f0',
      borderLeft: `4px solid ${color}`,
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      cursor: 'default'
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
    React.createElement('div', { key: 'header', style: { display: 'flex', alignItems: 'center', marginBottom: '12px' }}, [
      React.createElement('span', { key: 'icon', style: { fontSize: '20px', marginRight: '8px' }}, icon),
      React.createElement('h3', { key: 'title', style: { margin: 0, fontSize: '12px', color: '#666', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}, title)
    ]),
    React.createElement('div', { key: 'value', style: { fontSize: '24px', fontWeight: 'bold', color: color, lineHeight: '1', marginBottom: '4px' }}, displayValue),
    React.createElement('div', { key: 'subtitle', style: { fontSize: '11px', color: '#888', fontWeight: '400' }}, subtitle)
  ]);
};

export default UserAnalyticsDashboard;