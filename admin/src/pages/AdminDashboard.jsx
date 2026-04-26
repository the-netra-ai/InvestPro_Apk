import React, { useEffect, useMemo, useState } from "react";
import { req } from "../api";

export default function AdminDashboard({ onLogout }) {
  const getRowId = (row) => row?.id || row?._id;
  const formatTypeLabel = (typeValue) => {
    const normalized = String(typeValue || "").trim().toLowerCase();
    if (normalized === "profit") return "Profit";
    if (normalized === "capital") return "Capital";
    return "Capital";
  };
  const formatUsdt = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "$0 USDT";
    if (raw.toLowerCase().includes("usdt")) {
      return raw.startsWith("$") ? raw : `$${raw}`;
    }
    return `$${raw} USDT`;
  };

  const [pending, setPending] = useState([]);
  const [statsData, setStatsData] = useState({});
  const [processingIds, setProcessingIds] = useState([]);

  const loadPending = async () => {
    try {
      const data = await req("/api/admin/pending");
      const rows = Array.isArray(data) ? data : data.data || [];
      setPending(rows);
    } catch (e) {
      console.error(e);
      setPending([]);
    }
  };

  const loadStats = async () => {
    try {
      const data = await req("/api/admin/stats");
      setStatsData(data?.data || {});
    } catch (e) {
      console.error(e);
      setStatsData({});
    }
  };

  useEffect(() => {
    loadPending();
    loadStats();
  }, []);

  const stats = useMemo(() => ({
    totalUsers: statsData?.totalUsers ?? statsData?.total_users ?? 0,
    activeInvestments: statsData?.activeInvestments ?? statsData?.active_investments ?? 0,
    pendingWithdrawals: statsData?.pendingWithdrawals ?? statsData?.pending_withdrawals ?? pending.length
  }), [pending.length, statsData]);

  const markProcessing = (id, active) => {
    setProcessingIds((prev) => (
      active ? [...prev, id] : prev.filter((itemId) => itemId !== id)
    ));
  };

  const earningsHistory = useMemo(() => {
    const raw = statsData?.earningsHistory || statsData?.earnings_history || [];
    if (!Array.isArray(raw)) return [];
    return raw;
  }, [statsData]);

  const handleRequestAction = async (id, action) => {
    const selected = pending.find((p) => getRowId(p) === id);
    // Optimistic UI: action should be visible immediately in table.
    setPending((prev) => prev.filter((p) => getRowId(p) !== id));
    markProcessing(id, true);

    try {
      await req(`/api/admin/${action}/${id}`, { method: "POST" });
      alert(`${action === "approve" ? "Approved" : "Rejected"} successfully`);
      await loadStats();
    } catch (e) {
      console.error(e);
      alert(e.message || "Request failed");
      if (selected) {
        setPending((prev) => [selected, ...prev]);
      }
    } finally {
      markProcessing(id, false);
    }
  };

  return (
    <div className="app-shell">
      <div className="admin-wrap">
        <div className="admin-topbar">
          <h1 className="title title-with-icon">
            <span className="dash-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="topbar-icon-svg">
                <rect x="3" y="10" width="4" height="9" rx="1.2" fill="currentColor" />
                <rect x="10" y="6" width="4" height="13" rx="1.2" fill="currentColor" />
                <rect x="17" y="3" width="4" height="16" rx="1.2" fill="currentColor" />
              </svg>
            </span>
            Admin Dashboard
          </h1>
          <div className="topbar-actions">
            <button className="icon-btn" title="Refresh" onClick={loadPending}>
              <svg viewBox="0 0 24 24" className="topbar-icon-svg">
                <path d="M20 12a8 8 0 1 1-2.35-5.66" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M20 4v6h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button className="icon-btn" title="Logout" onClick={onLogout}>
              <svg viewBox="0 0 24 24" className="topbar-icon-svg">
                <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.2 1.2 0 0 1 0 1.7l-.1.1a1.2 1.2 0 0 1-1.7 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V19a1.2 1.2 0 0 1-1.2 1.2h-.2a1.2 1.2 0 0 1-1.2-1.2v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.2 1.2 0 0 1-1.7 0l-.1-.1a1.2 1.2 0 0 1 0-1.7l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H5a1.2 1.2 0 0 1-1.2-1.2v-.2A1.2 1.2 0 0 1 5 11.8h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.2 1.2 0 0 1 0-1.7l.1-.1a1.2 1.2 0 0 1 1.7 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V5a1.2 1.2 0 0 1 1.2-1.2h.2A1.2 1.2 0 0 1 14 5v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.2 1.2 0 0 1 1.7 0l.1.1a1.2 1.2 0 0 1 0 1.7l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H19a1.2 1.2 0 0 1 1.2 1.2v.2A1.2 1.2 0 0 1 19 14h-.2a1 1 0 0 0-.9.6Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="stats-grid">
          <div className="card stat-card">
            <p className="card-title">Total Users</p>
            <h2 className="card-value">{stats.totalUsers}</h2>
          </div>
          <div className="card stat-card">
            <p className="card-title">Active Investments</p>
            <h2 className="card-value">{stats.activeInvestments}</h2>
          </div>
          <div className="card stat-card">
            <p className="card-title">Pending Withdrawals</p>
            <h2 className="card-value">{stats.pendingWithdrawals}</h2>
          </div>
        </div>

        <div className="card table-card">
          <h3 className="section-title">Earnings History</h3>
          <table>
            <thead>
              <tr>
                <th>Cycle</th>
                <th>Amount</th>
                <th>Profit</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {earningsHistory.map((row, index) => (
                <tr key={`${row.cycle || "cycle"}-${index}`}>
                  <td>{row.cycle || `Cycle ${index + 1}`}</td>
                  <td>{formatUsdt(row.amount)}</td>
                  <td>{formatUsdt(row.profit)}</td>
                  <td>{row.date}</td>
                </tr>
              ))}
              {earningsHistory.length === 0 && (
                <tr>
                  <td colSpan="4" className="empty-state">
                    No earnings history available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card table-card">
          <h3 className="section-title">Pending Requests</h3>
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => (
                <tr key={getRowId(p)}>
                  <td>{p.user?.name || p.user?.email || p.user || p.email}</td>
                  <td>${p.amount} USDT</td>
                  <td>
                    <span className={`badge ${String(p.type || "").toLowerCase() === "profit" ? "badge-profit" : "badge-capital"}`}>
                      {formatTypeLabel(p.type)}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <button
                      className="btn btn-success mini-btn"
                      onClick={() => handleRequestAction(getRowId(p), "approve")}
                      disabled={processingIds.includes(getRowId(p))}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-danger mini-btn"
                      onClick={() => handleRequestAction(getRowId(p), "reject")}
                      disabled={processingIds.includes(getRowId(p))}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr>
                  <td colSpan="4" className="empty-state">
                    No pending requests at the moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
