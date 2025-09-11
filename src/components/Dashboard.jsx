import React, { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  zoomPlugin
);

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [messagesChartData, setMessagesChartData] = useState([]);
  const [aiStatusData, setAiStatusData] = useState([]);
  const [timeRange, setTimeRange] = useState('24h');
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(30); // seconds
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const intervalRef = useRef(null);

  const timeRangeOptions = [
    { value: '1h', label: '1 Hour' },
    { value: '3h', label: '3 Hours' },
    { value: '6h', label: '6 Hours' },
    { value: '12h', label: '12 Hours' },
    { value: '24h', label: '24 Hours' },
    { value: '3d', label: '3 Days' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '2mo', label: '2 Months' },
    { value: '3mo', label: '3 Months' },
    { value: '6mo', label: '6 Months' },
    { value: '1y', label: '1 Year' }
  ];

  const autoRefreshOptions = [
    { value: 0, label: 'Off' },
    { value: 5, label: '5s' },
    { value: 10, label: '10s' },
    { value: 30, label: '30s' },
    { value: 60, label: '60s' }
  ];

  const fetchData = async () => {
    try {
      const [statsRes, messagesRes, aiStatusRes] = await Promise.all([
        fetch(`/api/dashboard/stats?timeRange=${timeRange}`),
        fetch(`/api/dashboard/messages-chart?timeframe=${timeRange}`),
        fetch(`/api/dashboard/ai-status-distribution?timeRange=${timeRange}`)
      ]);

      const [statsData, messagesData, aiStatusDataRes] = await Promise.all([
        statsRes.json(),
        messagesRes.json(),
        aiStatusRes.json()
      ]);

      setStats(statsData);
      setMessagesChartData(messagesData);
      setAiStatusData(aiStatusDataRes);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  useEffect(() => {
    if (autoRefresh > 0) {
      intervalRef.current = setInterval(fetchData, autoRefresh * 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, timeRange]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Messages Over Time',
      },
      zoom: {
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true
          },
          mode: 'x',
        },
        pan: {
          enabled: true,
          mode: 'x',
        }
      }
    },
    scales: {
      x: {
        type: 'time',
        time: {
          displayFormats: {
            minute: 'HH:mm',
            hour: 'HH:mm',
            day: 'MMM dd',
            month: 'MMM yyyy'
          }
        }
      },
      y: {
        beginAtZero: true,
      },
    },
  };

  const chartData = {
    datasets: [
      {
        label: 'Total Messages',
        data: messagesChartData.map(item => ({
          x: item.date,
          y: item.totalCount
        })),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1
      },
      {
        label: 'Valid Messages',
        data: messagesChartData.map(item => ({
          x: item.date,
          y: item.validCount
        })),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        tension: 0.1
      },
      {
        label: 'LFG Messages',
        data: messagesChartData.map(item => ({
          x: item.date,
          y: item.lfgCount
        })),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        tension: 0.1
      }
    ]
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading dashboard...</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      {/* Header Controls */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div>
          <h1 style={{ margin: '0 0 10px 0', color: '#333' }}>SquadFinders Dashboard</h1>
          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div>
            <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Time Range:</label>
            <select 
              value={timeRange} 
              onChange={(e) => setTimeRange(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              {timeRangeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Auto Refresh:</label>
            <select 
              value={autoRefresh} 
              onChange={(e) => setAutoRefresh(parseInt(e.target.value))}
              style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              {autoRefreshOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Messages Chart */}
      <div style={{ 
        marginBottom: '30px', 
        padding: '20px', 
        backgroundColor: 'white', 
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ height: '400px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
        <p style={{ 
          textAlign: 'center', 
          marginTop: '10px', 
          fontSize: '12px', 
          color: '#666' 
        }}>
          Use mouse wheel to zoom, drag to pan. Double-click to reset zoom.
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '20px',
        marginBottom: '30px'
      }}>
        
        {/* Activity Stats */}
        <div style={{ 
          padding: '20px', 
          backgroundColor: 'white', 
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '5px' }}>
            Activity ({timeRangeOptions.find(opt => opt.value === timeRange)?.label})
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                {stats?.counts?.messagesToday || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Total Messages</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#17a2b8' }}>
                {stats?.counts?.validMessagesToday || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Valid Messages</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>
                {stats?.counts?.validMessagesPerMinute || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Messages/Min</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>
                {stats?.counts?.deletedToday || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Deleted Today</div>
            </div>
          </div>
        </div>

        {/* AI Processing Stats */}
        <div style={{ 
          padding: '20px', 
          backgroundColor: 'white', 
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#333', borderBottom: '2px solid #6f42c1', paddingBottom: '5px' }}>
            AI Processing
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>
                {stats?.counts?.pendingPrefilterMessages || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Pending Prefilter</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
                {stats?.counts?.pendingMessages || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Pending AI</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                {stats?.counts?.completedMessages || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Completed</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>
                {stats?.counts?.failedMessages || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Failed</div>
            </div>
          </div>
        </div>

        {/* Player Stats */}
        <div style={{ 
          padding: '20px', 
          backgroundColor: 'white', 
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#333', borderBottom: '2px solid #28a745', paddingBottom: '5px' }}>
            Players
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
                {stats?.counts?.players || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Total Players</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                {stats?.counts?.activePlayers || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Active Players</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>
                {stats?.counts?.deletedMessages || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Total Deleted</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#6f42c1' }}>
                {stats?.counts?.lfgMessages || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>LFG Messages</div>
            </div>
          </div>
        </div>

        {/* Platform Stats - Commented out for now */}
        {/*
        <div style={{ 
          padding: '20px', 
          backgroundColor: 'white', 
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#333', borderBottom: '2px solid #fd7e14', paddingBottom: '5px' }}>
            Platform Distribution
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
                {stats?.counts?.pcPlayers || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>PC Players</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                {stats?.counts?.consolePlayers || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Console Players</div>
            </div>
          </div>
        </div>
        */}
      </div>
    </div>
  );
};

export default Dashboard;