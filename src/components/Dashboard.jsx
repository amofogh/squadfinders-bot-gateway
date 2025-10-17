import React, { useState, useEffect } from 'react';

const MAIN_DASHBOARD_PATH = '/admin';
const USER_ANALYTICS_PATH = '/admin/pages/user-analytics';
const THEME_STORAGE_KEY = 'sf-admin-theme';
const LEGACY_THEME_KEYS = ['sf-dashboard-theme', 'sf-analytics-theme'];

const LIGHT_THEME = {
  background: '#f8f9fa',
  cardBackground: '#ffffff',
  cardBackgroundActive: '#eef2ff',
  border: '#e2e8f0',
  textPrimary: '#1f2937',
  textSecondary: '#4b5563',
  textMuted: '#6b7280',
  buttonBackground: '#667eea',
  buttonText: '#ffffff',
  buttonBorder: '#5a67d8',
  inputBackground: '#ffffff',
  inputBorder: '#d1d5db',
  cardShadow: '0 4px 6px rgba(0,0,0,0.1)',
  cardShadowStrong: '0 8px 15px rgba(0,0,0,0.15)',
  navText: '#1f2937',
  chipBackground: 'rgba(102, 126, 234, 0.12)',
  chipBorder: 'rgba(102, 126, 234, 0.3)'
};

const Dashboard = (props) => {
  const [stats, setStats] = useState(null);
  const [aiStatusDistribution, setAIStatusDistribution] = useState([]);
  const [messagesChartData, setMessagesChartData] = useState([]);
  const [timeRange, setTimeRange] = useState('24h');
  const [messagesChartInstance, setMessagesChartInstance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds
  const [refreshIntervalId, setRefreshIntervalId] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const themeManager = window.__squadfindersAdminTheme;
    const storedPreference = themeManager?.getStoredTheme?.();
    let usingSystemPreference = false;

    if (storedPreference === 'dark' || storedPreference === 'light') {
      setIsDarkMode(storedPreference === 'dark');
    } else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(Boolean(prefersDark));
      usingSystemPreference = true;
    }

    const handleThemeChange = (event) => {
      const themeValue = event?.detail?.theme;
      if (themeValue === 'dark' || themeValue === 'light') {
        setIsDarkMode(themeValue === 'dark');
      }
    };

    const handleStorage = (event) => {
      if (event.key === THEME_STORAGE_KEY && (event.newValue === 'dark' || event.newValue === 'light')) {
        setIsDarkMode(event.newValue === 'dark');
      }

      if (LEGACY_THEME_KEYS.includes(event.key) && (event.newValue === 'dark' || event.newValue === 'light')) {
        setIsDarkMode(event.newValue === 'dark');
      }
    };

    window.addEventListener('sf-admin-theme-change', handleThemeChange);
    window.addEventListener('storage', handleStorage);

    const mediaQuery = usingSystemPreference && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

    let handlePreferenceChange;

    if (mediaQuery) {
      handlePreferenceChange = (event) => {
        setIsDarkMode(event.matches);
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handlePreferenceChange);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handlePreferenceChange);
      }
    }

    return () => {
      window.removeEventListener('sf-admin-theme-change', handleThemeChange);
      window.removeEventListener('storage', handleStorage);

      if (mediaQuery && handlePreferenceChange) {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', handlePreferenceChange);
        } else if (mediaQuery.removeListener) {
          mediaQuery.removeListener(handlePreferenceChange);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const themeValue = isDarkMode ? 'dark' : 'light';
    const themeManager = window.__squadfindersAdminTheme;

    if (themeManager?.applyTheme) {
      themeManager.applyTheme(themeValue);
    } else {
      const root = document.documentElement;
      if (root) {
        root.setAttribute('data-admin-theme', themeValue);
        root.classList.toggle('sf-dark-theme', isDarkMode);
      }

      if (document.body) {
        document.body.setAttribute('data-admin-theme', themeValue);
        document.body.classList.toggle('sf-dark-theme', isDarkMode);
      }

      try {
        window.localStorage?.setItem(THEME_STORAGE_KEY, themeValue);
        LEGACY_THEME_KEYS.forEach((key) => window.localStorage?.removeItem(key));
      } catch (error) {
        // Ignore storage errors (e.g., private browsing)
      }
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const nextValue = !prev;

      if (typeof window !== 'undefined') {
        const themeValue = nextValue ? 'dark' : 'light';
        const themeManager = window.__squadfindersAdminTheme;

        if (themeManager?.setTheme) {
          themeManager.setTheme(themeValue);
        } else {
          try {
            window.localStorage?.setItem(THEME_STORAGE_KEY, themeValue);
            LEGACY_THEME_KEYS.forEach((key) => window.localStorage?.removeItem(key));
          } catch (error) {
            // Ignore storage errors
          }

          const root = document.documentElement;
          if (root) {
            root.setAttribute('data-admin-theme', themeValue);
            root.classList.toggle('sf-dark-theme', nextValue);
          }

          if (document.body) {
            document.body.setAttribute('data-admin-theme', themeValue);
            document.body.classList.toggle('sf-dark-theme', nextValue);
          }
        }
      }

      return nextValue;
    });
  };

  const fetchData = async () => {
    try {
      setError(null);

      const fetchOptions = {
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      // Fetch all data in parallel
      const [
        statsResponse,
        aiStatusResponse,
        messagesChartResponse
      ] = await Promise.all([
        fetch('/api/dashboard/stats', fetchOptions),
        fetch('/api/dashboard/ai-status-distribution', fetchOptions),
        fetch(`/api/dashboard/messages-chart?timeframe=${timeRange}`, fetchOptions)
      ]);

      if (!statsResponse.ok) {
        throw new Error(`Failed to fetch stats: ${statsResponse.status}`);
      }
      const statsData = await statsResponse.json();
      setStats(statsData.counts);


      if (!aiStatusResponse.ok) throw new Error('Failed to fetch AI status data');
      const aiStatusData = await aiStatusResponse.json();
      const aiStatusDataArray = Array.isArray(aiStatusData)
        ? aiStatusData
        : [];
      setAIStatusDistribution(aiStatusDataArray);

      if (!messagesChartResponse.ok) throw new Error('Failed to fetch messages chart data');
      const chartData = await messagesChartResponse.json();
      setMessagesChartData(chartData);


    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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
  }, [timeRange]);

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
    if (!loading && !error) {
      const loadScript = (src, onLoad) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = onLoad;
        script.onerror = () => setError(`Failed to load script: ${src}`);
        document.head.appendChild(script);
        return script;
      };

      const loadChartScripts = () => {
        if (window.Chart && window.Chart.Zoom && window.Chart._adapters) {
          createCharts();
          return;
        }

        loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js', () => {
          loadScript('https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.min.js', () => {
            loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js', () => {
              if (window.Chart && window.ChartZoom) {
                window.Chart.register(window.ChartZoom);
              }
              setTimeout(createCharts, 100);
            });
          });
        });
      };

      loadChartScripts();
    }
  }, [loading, error, messagesChartData, aiStatusDistribution]);

  const createCharts = () => {
    if (!window.Chart) return;

    ['aiStatusChart', 'messagesChart'].forEach(chartId => {
        const chart = window.Chart.getChart(chartId);
        if (chart) chart.destroy();
    });

    // AI Status Distribution Chart with static colors including unknown
    const aiStatusCtx = document.getElementById('aiStatusChart');
    if (aiStatusCtx && aiStatusDistribution.length > 0) {
        const statusConfig = {
          'pending': { label: 'Pending', color: '#ffd93d' },
          'processing': { label: 'Processing', color: '#6bcf7f' },
          'completed': { label: 'Completed', color: '#4d96ff' },
          'failed': { label: 'Failed', color: '#ff6b6b' },
          'expired': { label: 'Expired', color: '#a8a8a8' },
          'canceled_by_user': { label: 'Canceled by User', color: '#ffa94d' },
          'unknown': { label: 'Unknown', color: '#cccccc' }
        };

        const statusOrder = [
          'pending',
          'processing',
          'completed',
          'failed',
          'expired',
          'canceled_by_user',
          'unknown'
        ];

        const distributionByStatus = aiStatusDistribution.reduce((acc, item) => {
          const status = item._id || 'unknown';
          acc[status] = (acc[status] || 0) + item.count;
          return acc;
        }, {});

        const labels = [];
        const colors = [];
        const data = [];

        statusOrder.forEach(status => {
          const count = distributionByStatus[status];

          if (count) {
            const config = statusConfig[status] || { label: 'Other', color: '#999999' };
            labels.push(config.label);
            colors.push(config.color);
            data.push(count);
            delete distributionByStatus[status];
          }
        });

        Object.entries(distributionByStatus).forEach(([status, count]) => {
          if (!count) {
            return;
          }

          const config = statusConfig[status] || { label: 'Other', color: '#999999' };
          labels.push(config.label);
          colors.push(config.color);
          data.push(count);
        });

        new window.Chart(aiStatusCtx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors
                }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: 'AI Processing Status' }
              }
            }
        });
    }

    // Messages Over Time Chart
    const messagesCtx = document.getElementById('messagesChart');
    if (messagesCtx && messagesChartData) {
      const newChartInstance = new window.Chart(messagesCtx, {
        type: 'line',
        data: {
          datasets: [{
            label: 'Total Messages',
            data: messagesChartData.map(item => ({ x: new Date(item.date), y: item.totalCount })),
            borderColor: '#4facfe',
            backgroundColor: 'rgba(79, 172, 254, 0.1)',
            tension: 0.4,
            fill: true
          }, {
            label: 'LFG Messages',
            data: messagesChartData.map(item => ({ x: new Date(item.date), y: item.lfgCount })),
            borderColor: '#43e97b',
            backgroundColor: 'rgba(67, 233, 123, 0.1)',
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
                tooltipFormat: 'PP pp'
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
            zoom: {
              pan: {
                enabled: true,
                mode: 'x',
              },
              zoom: {
                wheel: { enabled: true },
                pinch: { enabled: true },
                mode: 'x',
                drag: {
                  enabled: true,
                  backgroundColor: 'rgba(102, 126, 234, 0.2)',
                  borderColor: '#667eea',
                  borderWidth: 1
                }
              }
            },
            title: {
              display: true,
              text: 'Messages Over Time'
            }
          }
        }
      });
      setMessagesChartInstance(newChartInstance);
    }

  };

  const timeButtons = [
    { label: '5m', value: '5m' }, { label: '10m', value: '10m' }, { label: '15m', value: '15m' },
    { label: '30m', value: '30m' }, { label: '60m', value: '60m' },
    { label: '3h', value: '3h' }, { label: '6h', value: '6h' },
    { label: '12h', value: '12h' }, { label: '24h', value: '24h' },
    { label: '3d', value: '3d' }, { label: '7d', value: '7d' },
    { label: '1mo', value: '1mo' }, { label: '3mo', value: '3mo' },
    { label: '6mo', value: '6mo' }, { label: '1y', value: '1y' }
  ];


  const refreshIntervals = [
    { label: '5s', value: 5 },
    { label: '10s', value: 10 },
    { label: '30s', value: 30 },
    { label: '60s', value: 60 }
  ];

  const styleElement = React.createElement('style', {
    key: 'styles'
  }, '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }');

  if (loading) {
    return React.createElement('div', {
      style: {
        padding: '40px',
        textAlign: 'center',
        backgroundColor: LIGHT_THEME.background,
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, [
      styleElement,
      React.createElement('div', { key: 'loader' }, [
        React.createElement('div', {
          key: 'spinner',
          style: {
            width: '40px',
            height: '40px',
            border: '4px solid rgba(148, 163, 184, 0.3)',
            borderTop: `4px solid ${LIGHT_THEME.buttonBackground}`,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }
        }),
        React.createElement('h2', { key: 'text', style: { color: LIGHT_THEME.textSecondary, margin: 0 }}, 'Loading Dashboard...')
      ])
    ]);
  }

  if (error) {
    return React.createElement('div', {
      style: {
        padding: '40px',
        textAlign: 'center',
        backgroundColor: LIGHT_THEME.background,
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, [
      styleElement,
      React.createElement('div', {
        key: 'error-card',
        style: {
          backgroundColor: LIGHT_THEME.cardBackground,
          border: `1px solid ${LIGHT_THEME.border}`,
          borderRadius: '12px',
          padding: '30px',
          boxShadow: LIGHT_THEME.cardShadow,
          maxWidth: '420px'
        }
      }, [
        React.createElement('h2', { key: 'title', style: { marginBottom: '10px', color: LIGHT_THEME.textPrimary }}, 'Dashboard Error'),
        React.createElement('p', { key: 'message', style: { margin: 0, color: LIGHT_THEME.textSecondary }}, error)
      ])
    ]);
  }

  return React.createElement('div', {
    style: { padding: '20px', backgroundColor: LIGHT_THEME.background, minHeight: '100vh', color: LIGHT_THEME.textPrimary }
  }, [
    styleElement,

    // Header with auto-refresh controls
    React.createElement('div', { key: 'header', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}, [
      React.createElement('h1', { key: 'title', style: { margin: 0, color: LIGHT_THEME.textPrimary, fontSize: '28px', fontWeight: 'bold' }}, 'SquadFinders Dashboard'),
      React.createElement('div', { key: 'controls', style: { display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}, [
        React.createElement('label', { key: 'refresh-label', style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: LIGHT_THEME.textSecondary }}, [
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
          style: { padding: '6px 10px', borderRadius: '4px', border: `1px solid ${LIGHT_THEME.inputBorder}`, background: LIGHT_THEME.inputBackground, color: LIGHT_THEME.textPrimary, fontSize: '14px' }
        }, refreshIntervals.map(interval =>
          React.createElement('option', { key: interval.value, value: interval.value }, interval.label)
        )),
        React.createElement('button', {
          key: 'manual-refresh',
          onClick: fetchData,
          style: {
            background: LIGHT_THEME.buttonBackground,
            color: LIGHT_THEME.buttonText,
            border: `1px solid ${LIGHT_THEME.buttonBorder}`,
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }
        }, '🔄 Refresh')
      ])
    ]),

    React.createElement('div', { key: 'nav-cards', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}, [
      React.createElement(NavCard, {
        key: 'main-dashboard',
        href: MAIN_DASHBOARD_PATH,
        label: 'Main Dashboard',
        description: 'Monitor live message processing and AI status.',
        icon: '📈',
        active: true
      }),
      React.createElement(NavCard, {
        key: 'user-analytics',
        href: USER_ANALYTICS_PATH,
        label: 'User Analytics',
        description: 'Explore user engagement and retention trends.',
        icon: '📊'
      })
    ]),

    // Statistics Grid
    React.createElement('div', { key: 'stats', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}, [
      React.createElement(StatBox, { key: 'messages', title: 'Total Messages', value: stats?.messages || 0, color: '#764ba2', icon: '💬' }),
      React.createElement(StatBox, { key: 'lfgMessages', title: 'LFG Messages', value: stats?.lfgMessages || 0, color: '#f093fb', icon: '🎮' }),
      React.createElement(StatBox, { key: 'activePlayers', title: 'Active Players', value: stats?.activePlayers || 0, color: '#00f2fe', icon: '🟢' }),
      React.createElement(StatBox, { key: 'pendingMessages', title: 'Pending Messages', value: stats?.pendingMessages || 0, color: '#ffd93d', icon: '⏳' }),
      React.createElement(StatBox, { key: 'processingMessages', title: 'Processing Messages', value: stats?.processingMessages || 0, color: '#6bcf7f', icon: '⚙️' }),
      React.createElement(StatBox, { key: 'completedMessages', title: 'Completed Messages', value: stats?.completedMessages || 0, color: '#4d96ff', icon: '✅' }),
      React.createElement(StatBox, { key: 'failedMessages', title: 'Failed Messages', value: stats?.failedMessages || 0, color: '#ff6b6b', icon: '❌' }),
      React.createElement(StatBox, { key: 'expiredMessages', title: 'Expired Messages', value: stats?.expiredMessages || 0, color: '#a8a8a8', icon: '⏰' }),
      React.createElement(StatBox, { key: 'canceledByUserMessages', title: 'Canceled by User', value: stats?.canceledByUserMessages || 0, color: '#ffa94d', icon: '🚫' }),
      React.createElement(StatBox, { key: 'messagesToday', title: 'Messages Today', value: stats?.messagesToday || 0, color: '#38ef7d', icon: '📅' }),
    ]),

    // Charts Grid
    React.createElement('div', { key: 'charts', style: { display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}, [
      // Messages Over Time Chart
      React.createElement('div', { key: 'messagesChartContainer', style: { backgroundColor: LIGHT_THEME.cardBackground, padding: '25px', borderRadius: '12px', boxShadow: LIGHT_THEME.cardShadow, border: `1px solid ${LIGHT_THEME.border}` }}, [
        React.createElement('div', { key: 'chart-header', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}, [
          React.createElement('h3', { key: 'title', style: { color: LIGHT_THEME.textPrimary, fontSize: '18px', fontWeight: '600', margin: 0 }}, 'Messages Over Time'),
          React.createElement('div', { key: 'buttons' },
            timeButtons.map(btn => React.createElement('button', {
              key: btn.value,
              onClick: () => setTimeRange(btn.value),
              style: {
                background: timeRange === btn.value ? LIGHT_THEME.buttonBackground : LIGHT_THEME.cardBackground,
                color: timeRange === btn.value ? LIGHT_THEME.buttonText : LIGHT_THEME.textPrimary,
                border: `1px solid ${LIGHT_THEME.border}`,
                padding: '8px 12px',
                marginLeft: '5px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }
            }, btn.label)),
            React.createElement('button', {
              key: 'reset-zoom',
              onClick: () => messagesChartInstance && messagesChartInstance.resetZoom(),
              style: {
                background: LIGHT_THEME.cardBackground,
                color: LIGHT_THEME.textPrimary,
                border: `1px solid ${LIGHT_THEME.border}`,
                padding: '8px 12px',
                marginLeft: '10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }
            }, 'Reset Zoom')
          )
        ]),
        React.createElement('div', { key: 'canvas-container', style: { height: '350px', position: 'relative' }},
          React.createElement('canvas', { id: 'messagesChart', style: { width: '100%', height: '100%' } })
        )
      ]),


      // Charts Row

      React.createElement('div', { key: 'chartsRow', style: { display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}, [
        // AI Status Distribution Chart
        React.createElement('div', { key: 'aiStatusChartContainer', style: { backgroundColor: LIGHT_THEME.cardBackground, padding: '25px', borderRadius: '12px', boxShadow: LIGHT_THEME.cardShadow, border: `1px solid ${LIGHT_THEME.border}` }}, [
          React.createElement('h3', { key: 'title', style: { marginBottom: '20px', color: LIGHT_THEME.textPrimary, fontSize: '18px', fontWeight: '600' }}, 'AI Processing Status'),
          React.createElement('div', { key: 'canvas-container', style: { height: '300px', position: 'relative' }},
            React.createElement('canvas', { id: 'aiStatusChart', style: { width: '100%', height: '100%' } })
          )
        ])
      ])
    ])
  ]);
};

const NavCard = ({ href, label, description, icon, active = false }) => {
  const baseStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '20px',
    borderRadius: '12px',
    border: `1px solid ${LIGHT_THEME.border}`,
    backgroundColor: active ? LIGHT_THEME.cardBackgroundActive : LIGHT_THEME.cardBackground,
    boxShadow: active ? LIGHT_THEME.cardShadowStrong : LIGHT_THEME.cardShadow,
    color: LIGHT_THEME.navText,
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
      target.style.boxShadow = LIGHT_THEME.cardShadowStrong;
    },
    onMouseLeave: (e) => {
      const target = e.currentTarget;
      target.style.transform = 'translateY(0)';
      target.style.boxShadow = active ? LIGHT_THEME.cardShadowStrong : LIGHT_THEME.cardShadow;
    }
  }, [
    React.createElement('div', { key: 'icon', style: { fontSize: '24px' } }, icon),
    React.createElement('div', { key: 'label', style: { fontWeight: '600', fontSize: '16px' } }, label),
    React.createElement('div', { key: 'description', style: { fontSize: '13px', color: LIGHT_THEME.textSecondary } }, description)
  ]);
};

const StatBox = ({ title, value, color, icon, isDecimal = false }) => {
  const displayValue = isDecimal ? (typeof value === 'number' ? value.toFixed(2) : value) : (typeof value === 'number' ? value.toLocaleString() : value);
  return React.createElement('div', {
    style: {
      backgroundColor: LIGHT_THEME.cardBackground,
      padding: '20px',
      borderRadius: '12px',
      boxShadow: LIGHT_THEME.cardShadow,
      border: `1px solid ${LIGHT_THEME.border}`,
      borderLeft: `4px solid ${color}`,
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      cursor: 'default'
    },
    onMouseEnter: (e) => {
      const target = e.currentTarget;
      target.style.transform = 'translateY(-2px)';
      target.style.boxShadow = LIGHT_THEME.cardShadowStrong;
    },
    onMouseLeave: (e) => {
      const target = e.currentTarget;
      target.style.transform = 'translateY(0)';
      target.style.boxShadow = LIGHT_THEME.cardShadow;
    }
  }, [
    React.createElement('div', { key: 'header', style: { display: 'flex', alignItems: 'center', marginBottom: '12px' }}, [
      React.createElement('span', { key: 'icon', style: { fontSize: '20px', marginRight: '8px' }}, icon),
      React.createElement('h3', { key: 'title', style: { margin: 0, fontSize: '12px', color: LIGHT_THEME.textMuted, textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}, title)
    ]),
    React.createElement('div', { key: 'value', style: { fontSize: '24px', fontWeight: 'bold', color: color, lineHeight: '1' }}, displayValue)
  ]);
};

export default Dashboard;
