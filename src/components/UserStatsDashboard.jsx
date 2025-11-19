import React, { useEffect, useState, useRef } from "react";

const THEME_STORAGE_KEY = "sf-admin-theme";
const LEGACY_THEME_KEYS = ["sf-dashboard-theme", "sf-analytics-theme"];

const LIGHT_THEME = {
  background: "#f8f9fa",
  cardBackground: "#ffffff",
  cardBackgroundActive: "#eef2ff",
  border: "#e2e8f0",
  textPrimary: "#1f2937",
  textSecondary: "#4b5563",
  textMuted: "#6b7280",
  buttonBackground: "#667eea",
  buttonText: "#ffffff",
  buttonBorder: "#5a67d8",
  inputBackground: "#ffffff",
  inputBorder: "#d1d5db",
  cardShadow: "0 4px 6px rgba(0,0,0,0.1)",
  cardShadowStrong: "0 8px 15px rgba(0,0,0,0.15)",
  navText: "#1f2937",
  chipBackground: "rgba(102, 126, 234, 0.12)",
  chipBorder: "rgba(102, 126, 234, 0.3)",
};

const DARK_THEME = {
  background: "#111827",
  cardBackground: "#1f2937",
  cardBackgroundActive: "#374151",
  border: "#374151",
  textPrimary: "#f9fafb",
  textSecondary: "#d1d5db",
  textMuted: "#9ca3af",
  buttonBackground: "#667eea",
  buttonText: "#ffffff",
  buttonBorder: "#5a67d8",
  inputBackground: "#374151",
  inputBorder: "#4b5563",
  cardShadow: "0 4px 6px rgba(0,0,0,0.3)",
  cardShadowStrong: "0 8px 15px rgba(0,0,0,0.4)",
  navText: "#f9fafb",
  chipBackground: "rgba(102, 126, 234, 0.25)",
  chipBorder: "rgba(102, 126, 234, 0.5)",
};

const UserStatsDashboard = () => {
  const [stats, setStats] = useState(null);
  const [topUsers, setTopUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const refreshIntervalRef = useRef(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const themeManager = window.__squadfindersAdminTheme;
    const storedPreference = themeManager?.getStoredTheme?.();
    let usingSystemPreference = false;

    if (storedPreference === "dark" || storedPreference === "light") {
      setIsDarkMode(storedPreference === "dark");
    } else {
      const prefersDark =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      setIsDarkMode(Boolean(prefersDark));
      usingSystemPreference = true;
    }

    const handleThemeChange = (event) => {
      const themeValue = event?.detail?.theme;
      if (themeValue === "dark" || themeValue === "light") {
        setIsDarkMode(themeValue === "dark");
      }
    };

    const handleStorage = (event) => {
      if (
        event.key === THEME_STORAGE_KEY &&
        (event.newValue === "dark" || event.newValue === "light")
      ) {
        setIsDarkMode(event.newValue === "dark");
      }

      if (
        LEGACY_THEME_KEYS.includes(event.key) &&
        (event.newValue === "dark" || event.newValue === "light")
      ) {
        setIsDarkMode(event.newValue === "dark");
      }
    };

    window.addEventListener("sf-admin-theme-change", handleThemeChange);
    window.addEventListener("storage", handleStorage);

    const mediaQuery =
      usingSystemPreference && window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;

    let handlePreferenceChange;

    if (mediaQuery) {
      handlePreferenceChange = (event) => {
        setIsDarkMode(event.matches);
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handlePreferenceChange);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handlePreferenceChange);
      }
    }

    return () => {
      window.removeEventListener("sf-admin-theme-change", handleThemeChange);
      window.removeEventListener("storage", handleStorage);

      if (mediaQuery && handlePreferenceChange) {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener("change", handlePreferenceChange);
        } else if (mediaQuery.removeListener) {
          mediaQuery.removeListener(handlePreferenceChange);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const themeValue = isDarkMode ? "dark" : "light";
    const themeManager = window.__squadfindersAdminTheme;

    if (themeManager?.applyTheme) {
      themeManager.applyTheme(themeValue);
    } else {
      const root = document.documentElement;
      if (root) {
        root.setAttribute("data-admin-theme", themeValue);
        root.classList.toggle("sf-dark-theme", isDarkMode);
      }

      if (document.body) {
        document.body.setAttribute("data-admin-theme", themeValue);
        document.body.classList.toggle("sf-dark-theme", isDarkMode);
      }

      try {
        window.localStorage?.setItem(THEME_STORAGE_KEY, themeValue);
        LEGACY_THEME_KEYS.forEach((key) =>
          window.localStorage?.removeItem(key)
        );
      } catch (error) {
        // Ignore storage errors
      }
    }
  }, [isDarkMode]);

  const fetchData = async () => {
    try {
      setError(null);

      const fetchOptions = {
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
      };

      const response = await fetch(
        "/api/user-stats/aggregated?limit=20",
        fetchOptions
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch user stats: ${response.status}`);
      }

      const data = await response.json();
      setStats(data.summary);
      setTopUsers(data.top_users || []);
    } catch (fetchError) {
      console.error("Error fetching user stats data:", fetchError);
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialFetch = async () => {
      setLoading(true);
      await fetchData();
    };
    initialFetch();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const intervalId = setInterval(() => fetchData(), refreshInterval * 1000);
      refreshIntervalRef.current = intervalId;
      return () => clearInterval(intervalId);
    }

    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  }, [autoRefresh, refreshInterval]);

  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;

  const buttonLabels = {
    find_player: "Find Player",
    dont_want_to_play: "I Don't Want to Play Anymore",
    about_us: "About Us",
    channel_and_group: "Our Channel and Group",
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return "0";
    return num.toLocaleString();
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div
        style={{
          padding: "2rem",
          background: theme.background,
          minHeight: "100vh",
          color: theme.textPrimary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
            Loading user stats...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "2rem",
          background: theme.background,
          minHeight: "100vh",
          color: theme.textPrimary,
        }}
      >
        <div
          style={{
            background: theme.cardBackground,
            border: `1px solid ${theme.border}`,
            borderRadius: "8px",
            padding: "1.5rem",
            boxShadow: theme.cardShadow,
          }}
        >
          <h2 style={{ color: "#ef4444", marginBottom: "1rem" }}>Error</h2>
          <p style={{ color: theme.textSecondary }}>{error}</p>
          <button
            onClick={fetchData}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              background: theme.buttonBackground,
              color: theme.buttonText,
              border: `1px solid ${theme.buttonBorder}`,
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "2rem",
        background: theme.background,
        minHeight: "100vh",
        color: theme.textPrimary,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: "bold" }}>
          User Button Stats
        </h1>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.875rem",
            }}
          >
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            Auto-refresh
          </label>
          {autoRefresh && (
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              style={{
                padding: "0.25rem 0.5rem",
                background: theme.inputBackground,
                border: `1px solid ${theme.inputBorder}`,
                borderRadius: "4px",
                color: theme.textPrimary,
                cursor: "pointer",
              }}
            >
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
              <option value={300}>5m</option>
            </select>
          )}
          <button
            onClick={fetchData}
            style={{
              padding: "0.5rem 1rem",
              background: theme.buttonBackground,
              color: theme.buttonText,
              border: `1px solid ${theme.buttonBorder}`,
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        <div
          style={{
            background: theme.cardBackground,
            border: `1px solid ${theme.border}`,
            borderRadius: "8px",
            padding: "1.5rem",
            boxShadow: theme.cardShadow,
          }}
        >
          <div
            style={{
              color: theme.textMuted,
              fontSize: "0.875rem",
              marginBottom: "0.5rem",
            }}
          >
            Total Users
          </div>
          <div
            style={{
              fontSize: "2rem",
              fontWeight: "bold",
              color: theme.textPrimary,
            }}
          >
            {formatNumber(stats?.total_users || 0)}
          </div>
        </div>

        <div
          style={{
            background: theme.cardBackground,
            border: `1px solid ${theme.border}`,
            borderRadius: "8px",
            padding: "1.5rem",
            boxShadow: theme.cardShadow,
          }}
        >
          <div
            style={{
              color: theme.textMuted,
              fontSize: "0.875rem",
              marginBottom: "0.5rem",
            }}
          >
            Total Clicks
          </div>
          <div
            style={{
              fontSize: "2rem",
              fontWeight: "bold",
              color: theme.textPrimary,
            }}
          >
            {formatNumber(stats?.total_clicks || 0)}
          </div>
        </div>
      </div>

      {/* Button Click Statistics */}
      <div
        style={{
          background: theme.cardBackground,
          border: `1px solid ${theme.border}`,
          borderRadius: "8px",
          padding: "1.5rem",
          boxShadow: theme.cardShadow,
          marginBottom: "2rem",
        }}
      >
        <h2
          style={{ marginTop: 0, marginBottom: "1.5rem", fontSize: "1.5rem" }}
        >
          Button Click Statistics
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
          }}
        >
          <div
            style={{
              padding: "1rem",
              background: theme.cardBackgroundActive,
              borderRadius: "6px",
              border: `1px solid ${theme.border}`,
            }}
          >
            <div
              style={{
                color: theme.textMuted,
                fontSize: "0.875rem",
                marginBottom: "0.5rem",
              }}
            >
              {buttonLabels.find_player}
            </div>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: "bold",
                color: theme.textPrimary,
              }}
            >
              {formatNumber(stats?.find_player_clicks || 0)}
            </div>
          </div>

          <div
            style={{
              padding: "1rem",
              background: theme.cardBackgroundActive,
              borderRadius: "6px",
              border: `1px solid ${theme.border}`,
            }}
          >
            <div
              style={{
                color: theme.textMuted,
                fontSize: "0.875rem",
                marginBottom: "0.5rem",
              }}
            >
              {buttonLabels.dont_want_to_play}
            </div>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: "bold",
                color: theme.textPrimary,
              }}
            >
              {formatNumber(stats?.dont_want_to_play_clicks || 0)}
            </div>
          </div>

          <div
            style={{
              padding: "1rem",
              background: theme.cardBackgroundActive,
              borderRadius: "6px",
              border: `1px solid ${theme.border}`,
            }}
          >
            <div
              style={{
                color: theme.textMuted,
                fontSize: "0.875rem",
                marginBottom: "0.5rem",
              }}
            >
              {buttonLabels.about_us}
            </div>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: "bold",
                color: theme.textPrimary,
              }}
            >
              {formatNumber(stats?.about_us_clicks || 0)}
            </div>
          </div>

          <div
            style={{
              padding: "1rem",
              background: theme.cardBackgroundActive,
              borderRadius: "6px",
              border: `1px solid ${theme.border}`,
            }}
          >
            <div
              style={{
                color: theme.textMuted,
                fontSize: "0.875rem",
                marginBottom: "0.5rem",
              }}
            >
              {buttonLabels.channel_and_group}
            </div>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: "bold",
                color: theme.textPrimary,
              }}
            >
              {formatNumber(stats?.channel_and_group_clicks || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Top Users Table */}
      <div
        style={{
          background: theme.cardBackground,
          border: `1px solid ${theme.border}`,
          borderRadius: "8px",
          padding: "1.5rem",
          boxShadow: theme.cardShadow,
        }}
      >
        <h2
          style={{ marginTop: 0, marginBottom: "1.5rem", fontSize: "1.5rem" }}
        >
          Top Users by Total Clicks
        </h2>
        {topUsers.length === 0 ? (
          <p style={{ color: theme.textMuted }}>No user stats available yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
                  <th
                    style={{
                      padding: "0.75rem",
                      textAlign: "left",
                      color: theme.textSecondary,
                      fontWeight: "600",
                    }}
                  >
                    User ID
                  </th>
                  <th
                    style={{
                      padding: "0.75rem",
                      textAlign: "left",
                      color: theme.textSecondary,
                      fontWeight: "600",
                    }}
                  >
                    Username
                  </th>
                  <th
                    style={{
                      padding: "0.75rem",
                      textAlign: "right",
                      color: theme.textSecondary,
                      fontWeight: "600",
                    }}
                  >
                    Total Clicks
                  </th>
                  <th
                    style={{
                      padding: "0.75rem",
                      textAlign: "right",
                      color: theme.textSecondary,
                      fontWeight: "600",
                    }}
                  >
                    Find Player
                  </th>
                  <th
                    style={{
                      padding: "0.75rem",
                      textAlign: "right",
                      color: theme.textSecondary,
                      fontWeight: "600",
                    }}
                  >
                    Don't Want to Play
                  </th>
                  <th
                    style={{
                      padding: "0.75rem",
                      textAlign: "right",
                      color: theme.textSecondary,
                      fontWeight: "600",
                    }}
                  >
                    About Us
                  </th>
                  <th
                    style={{
                      padding: "0.75rem",
                      textAlign: "right",
                      color: theme.textSecondary,
                      fontWeight: "600",
                    }}
                  >
                    Channel & Group
                  </th>
                </tr>
              </thead>
              <tbody>
                {topUsers.map((user, index) => (
                  <tr
                    key={user._id || user.user_id}
                    style={{
                      borderBottom: `1px solid ${theme.border}`,
                      "&:hover": { background: theme.cardBackgroundActive },
                    }}
                  >
                    <td
                      style={{ padding: "0.75rem", color: theme.textPrimary }}
                    >
                      {user.user_id}
                    </td>
                    <td
                      style={{ padding: "0.75rem", color: theme.textPrimary }}
                    >
                      {user.username || "-"}
                    </td>
                    <td
                      style={{
                        padding: "0.75rem",
                        textAlign: "right",
                        fontWeight: "bold",
                        color: theme.textPrimary,
                      }}
                    >
                      {formatNumber(user.total_clicks || 0)}
                    </td>
                    <td
                      style={{
                        padding: "0.75rem",
                        textAlign: "right",
                        color: theme.textSecondary,
                      }}
                    >
                      {formatNumber(
                        user.button_clicks?.find_player?.count || 0
                      )}
                    </td>
                    <td
                      style={{
                        padding: "0.75rem",
                        textAlign: "right",
                        color: theme.textSecondary,
                      }}
                    >
                      {formatNumber(
                        user.button_clicks?.dont_want_to_play?.count || 0
                      )}
                    </td>
                    <td
                      style={{
                        padding: "0.75rem",
                        textAlign: "right",
                        color: theme.textSecondary,
                      }}
                    >
                      {formatNumber(user.button_clicks?.about_us?.count || 0)}
                    </td>
                    <td
                      style={{
                        padding: "0.75rem",
                        textAlign: "right",
                        color: theme.textSecondary,
                      }}
                    >
                      {formatNumber(
                        user.button_clicks?.channel_and_group?.count || 0
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserStatsDashboard;
