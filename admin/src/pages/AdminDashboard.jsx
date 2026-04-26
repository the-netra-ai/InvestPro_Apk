import React, { useEffect, useMemo, useState } from "react";
import { req } from "../api";

export default function AdminDashboard({ onLogout }) {
  const getRowId = (row) => row?.id || row?._id;
  const formatDateTime = (value) => {
    const t = Date.parse(value);
    if (!Number.isFinite(t)) return value || "-";
    return new Date(t).toLocaleString();
  };
  const formatDateOnly = (value) => {
    const t = Date.parse(value);
    if (!Number.isFinite(t)) return value || "-";
    return new Date(t).toLocaleDateString();
  };
  const normalizeAdminHistoryRows = (payload) => {
    const root = payload;
    const fromEnvelope = payload?.data;

    const takeArray = (value) => (Array.isArray(value) ? value : null);
    const takeObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : null);

    const direct = takeArray(root) || takeArray(fromEnvelope);
    if (direct) return direct;

    // Common patterns:
    // - { data: { history: [...] } }
    // - { data: { rows/items: [...] } }
    // - { data: { investments: [...], withdrawals: [...] } }
    // - { data: { history: { investments: [...], withdrawals: [...] } } }
    const obj = takeObject(fromEnvelope) || takeObject(root);
    if (!obj) return [];

    const history = takeObject(obj.history) || null;
    const rows =
      takeArray(obj.history)
      || takeArray(obj.rows)
      || takeArray(obj.items)
      || takeArray(history?.rows)
      || takeArray(history?.items)
      || takeArray(history?.history);
    if (rows) return rows;

    const investments =
      takeArray(obj.investments)
      || takeArray(obj.investmentHistory)
      || takeArray(obj.investment_history)
      || takeArray(history?.investments)
      || takeArray(history?.investmentHistory)
      || takeArray(history?.investment_history)
      || [];
    const withdrawals =
      takeArray(obj.withdrawals)
      || takeArray(obj.withdrawHistory)
      || takeArray(obj.withdraw_history)
      || takeArray(obj.withdrawalHistory)
      || takeArray(obj.withdrawal_history)
      || takeArray(history?.withdrawals)
      || takeArray(history?.withdrawHistory)
      || takeArray(history?.withdraw_history)
      || takeArray(history?.withdrawalHistory)
      || takeArray(history?.withdrawal_history)
      || [];

    if (investments.length || withdrawals.length) {
      const taggedInvestments = investments.map((r) => ({ ...r, __kind: r?.__kind || "investment" }));
      const taggedWithdrawals = withdrawals.map((r) => ({ ...r, __kind: r?.__kind || "withdrawal" }));
      return [...taggedInvestments, ...taggedWithdrawals];
    }

    return [];
  };
  const normalizeWithdrawRows = (payload) => {
    const root = payload;
    const data = payload?.data;
    const takeArray = (value) => (Array.isArray(value) ? value : null);

    const direct =
      takeArray(root)
      || takeArray(data)
      || takeArray(data?.withdrawals)
      || takeArray(data?.rows)
      || takeArray(data?.items)
      || takeArray(root?.withdrawals)
      || takeArray(root?.rows)
      || takeArray(root?.items);

    if (!direct) return [];
    return direct.map((row) => ({ ...row, __kind: "withdrawal" }));
  };
  const getStatus = (row) => String(
    row?.status
    || row?.investment_status
    || row?.withdraw_status
    || row?.request_status
    || row?.state
    || ""
  ).trim().toLowerCase();
  const isInvestmentPending = (row) => {
    const status = getStatus(row);
    if (status) return status === "pending";
    return true;
  };
  const isWithdrawalRow = (row) => {
    if (String(row?.__kind || "").toLowerCase() === "withdrawal") return true;
    const type = String(row?.type || row?.withdraw_type || row?.withdrawal_type || "").trim().toLowerCase();
    const hasWithdrawType = type === "profit" || type === "capital";
    const hasWithdrawMarker = Boolean(row?.withdraw_status || row?.withdrawal_status);
    const hasPaymentFields = Boolean(row?.payment_method || row?.paymentMethod || row?.utr);
    return (hasWithdrawType || hasWithdrawMarker) && !hasPaymentFields;
  };
  const formatUsdt = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "$0 USDT";
    if (raw.toLowerCase().includes("usdt")) {
      return raw.startsWith("$") ? raw : `$${raw}`;
    }
    return `$${raw} USDT`;
  };
  const formatUsd = (value) => {
    const n = Number(value);
    if (Number.isFinite(n)) return `$${n}`;
    const raw = String(value ?? "").trim();
    if (!raw) return "$0";
    const cleaned = raw.replace(/\s*usdt\s*/ig, "").replace(/^\$/, "").trim();
    return `$${cleaned || "0"}`;
  };
  const formatPlanShort = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "-";
    return raw.replace(/\s*plan\s*$/i, "").trim();
  };

  const getUserName = (row) => (
    row?.user?.name
    || (typeof row?.user === "string" ? row.user : "")
    || row?.user_name
    || row?.userName
    || row?.name
    || "-"
  );

  const getUserEmail = (row) => (
    row?.user?.email
    || (typeof row?.user === "string" ? row.user : "")
    || row?.user_email
    || row?.userEmail
    || row?.email
    || "-"
  );

  const getPlanLabel = (row) => (
    row?.plan
    || row?.scheme?.name
    || row?.scheme_name
    || row?.plan_name
    || row?.planName
    || row?.plan?.name
    || "—"
  );

  const [pending, setPending] = useState([]);
  const [statsData, setStatsData] = useState({});
  const [adminHistory, setAdminHistory] = useState([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState([]);
  const [allWithdrawals, setAllWithdrawals] = useState([]);
  const [processingIds, setProcessingIds] = useState([]);
  const [view, setView] = useState("dashboard"); // dashboard | earnings | history
  const [earningsPage, setEarningsPage] = useState(0);
  const [adminHistoryPage, setAdminHistoryPage] = useState(0);
  const [pendingInvPage, setPendingInvPage] = useState(0);
  const [pendingWithdrawPage, setPendingWithdrawPage] = useState(0);

  const loadPending = async () => {
    try {
      const data = await req("/api/admin/pending");
      const rows = Array.isArray(data) ? data : data.data || [];
      setPending((Array.isArray(rows) ? rows : []).filter(isInvestmentPending));
    } catch (e) {
      console.error(e);
      setPending([]);
    }
  };

  const loadAdminHistory = async () => {
    try {
      const data = await req("/api/admin/history");
      const rows = normalizeAdminHistoryRows(data);
      setAdminHistory(rows);

      if (import.meta?.env?.DEV) {
        console.info("[admin] /api/admin/history raw response keys", Object.keys(data || {}));
        console.info("[admin] /api/admin/history raw response", data);
        console.info("[admin] /api/admin/history normalized rows length", rows.length);
        const first = rows?.[0];
        if (first) {
          console.info("[admin] /api/admin/history sample row keys", Object.keys(first));
          console.info("[admin] /api/admin/history sample row", first);
        }
      }
    } catch (e) {
      console.error(e);
      setAdminHistory([]);
      setPendingWithdrawals([]);
    }
  };

  const loadAdminWithdrawals = async () => {
    try {
      const data = await req("/api/admin/withdrawals");
      const rows = normalizeWithdrawRows(data);
      setAllWithdrawals(rows);
      setPendingWithdrawals(rows.filter((row) => getStatus(row) === "pending"));
    } catch (e) {
      console.error(e);
      setAllWithdrawals([]);
      setPendingWithdrawals([]);
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
    loadAdminHistory();
    loadAdminWithdrawals();
  }, []);

  const adminHistorySorted = useMemo(() => {
    const pickTs = (row) => {
      const candidates = [
        row?.created_at,
        row?.createdAt,
        row?.date,
        row?.updated_at,
        row?.updatedAt
      ];
      for (const c of candidates) {
        const t = Date.parse(c);
        if (Number.isFinite(t)) return t;
      }
      const idNum = Number(row?.id ?? row?._id);
      return Number.isFinite(idNum) ? idNum : 0;
    };
    return [...(Array.isArray(adminHistory) ? adminHistory : [])].sort((a, b) => pickTs(b) - pickTs(a));
  }, [adminHistory]);

  const stats = useMemo(() => ({
    totalUsers: statsData?.totalUsers ?? statsData?.total_users ?? 0,
    activeInvestments: statsData?.activeInvestments ?? statsData?.active_investments ?? 0,
    pendingRequests: pending.length + pendingWithdrawals.length
  }), [pending.length, pendingWithdrawals.length, statsData]);

  const markProcessing = (id, active) => {
    setProcessingIds((prev) => (
      active ? [...prev, id] : prev.filter((itemId) => itemId !== id)
    ));
  };

  const withdrawalHistory = useMemo(
    () => [...allWithdrawals].sort((a, b) => {
      const ta = Date.parse(a?.created_at || a?.createdAt || a?.date || a?.updated_at || a?.updatedAt);
      const tb = Date.parse(b?.created_at || b?.createdAt || b?.date || b?.updated_at || b?.updatedAt);
      const safeA = Number.isFinite(ta) ? ta : 0;
      const safeB = Number.isFinite(tb) ? tb : 0;
      return safeB - safeA;
    }),
    [allWithdrawals]
  );

  const PAGE_SIZE = 10;
  const PENDING_PAGE_SIZE = 5;
  const pagedWithdrawalHistory = useMemo(() => {
    const start = earningsPage * PAGE_SIZE;
    return withdrawalHistory.slice(start, start + PAGE_SIZE);
  }, [withdrawalHistory, earningsPage]);
  const pagedAdminHistory = useMemo(() => {
    const start = adminHistoryPage * PAGE_SIZE;
    return adminHistorySorted.slice(start, start + PAGE_SIZE);
  }, [adminHistorySorted, adminHistoryPage]);
  const totalEarningsPages = Math.max(1, Math.ceil(withdrawalHistory.length / PAGE_SIZE));
  const totalAdminHistoryPages = Math.max(1, Math.ceil(adminHistorySorted.length / PAGE_SIZE));
  const pagedPendingInvestments = useMemo(() => {
    const start = pendingInvPage * PENDING_PAGE_SIZE;
    return pending.slice(start, start + PENDING_PAGE_SIZE);
  }, [pending, pendingInvPage]);
  const pagedPendingWithdrawals = useMemo(() => {
    const start = pendingWithdrawPage * PENDING_PAGE_SIZE;
    return pendingWithdrawals.slice(start, start + PENDING_PAGE_SIZE);
  }, [pendingWithdrawals, pendingWithdrawPage]);
  const totalPendingInvPages = Math.max(1, Math.ceil(pending.length / PENDING_PAGE_SIZE));
  const totalPendingWithdrawPages = Math.max(1, Math.ceil(pendingWithdrawals.length / PENDING_PAGE_SIZE));

  useEffect(() => {
    setEarningsPage(0);
  }, [withdrawalHistory.length]);

  useEffect(() => {
    setAdminHistoryPage(0);
  }, [adminHistorySorted.length]);

  useEffect(() => {
    setPendingInvPage(0);
  }, [pending.length]);

  useEffect(() => {
    setPendingWithdrawPage(0);
  }, [pendingWithdrawals.length]);

  const handleRequestAction = async (id, action) => {
    const selected = pending.find((p) => getRowId(p) === id);
    // Optimistic UI: action should be visible immediately in table.
    setPending((prev) => prev.filter((p) => getRowId(p) !== id));
    markProcessing(id, true);

    try {
      await req(`/api/admin/${action}/${id}`, { method: "POST" });
      if (action === "approve") alert("Approved successfully");
      else if (action === "reject") alert("Rejected successfully");
      else alert("Updated successfully");
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

  const handleWithdrawalAction = async (id, action) => {
    const selected = pendingWithdrawals.find((w) => getRowId(w) === id);
    setPendingWithdrawals((prev) => prev.filter((w) => getRowId(w) !== id));
    markProcessing(id, true);

    try {
      await req(`/api/admin/withdraw/${action}/${id}`, { method: "POST" });
      if (action === "approve") alert("Approved successfully");
      else if (action === "reject") alert("Rejected successfully");
      else alert("Updated successfully");
      await loadStats();
      await loadAdminWithdrawals();
    } catch (e) {
      console.error(e);
      alert(e.message || "Request failed");
      if (selected) setPendingWithdrawals((prev) => [selected, ...prev]);
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
            <button
              className="icon-btn"
              title="Refresh"
              onClick={() => {
                loadPending();
                loadStats();
                loadAdminHistory();
                loadAdminWithdrawals();
              }}
            >
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

        {view === "dashboard" ? (
          <>
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
                <p className="card-title">Pending Requests</p>
                <h2 className="card-value">{stats.pendingRequests}</h2>
              </div>
            </div>

            <div className="topbar-actions" style={{ justifyContent: "flex-start", gap: 10, marginBottom: 14 }}>
              <button className="btn btn-main" onClick={() => setView("earnings")}>Withdrawal History</button>
              <button className="btn btn-main" onClick={() => setView("history")}>Investment History</button>
            </div>

            <div className="card table-card">
              <h3 className="section-title">Pending Investments</h3>
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedPendingInvestments.map((p) => (
                    <tr key={getRowId(p)}>
                      <td>{getUserEmail(p) !== "-" ? getUserEmail(p) : getUserName(p)}</td>
                      <td>{formatUsdt(p.amount)}</td>
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
                  {pagedPendingInvestments.length === 0 && (
                    <tr>
                      <td colSpan="3" className="empty-state">
                        No pending requests at the moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="topbar-actions" style={{ justifyContent: "center", gap: 10, marginTop: 12 }}>
                <button
                  className="btn btn-main mini-btn"
                  onClick={() => setPendingInvPage((p) => Math.max(0, p - 1))}
                  disabled={pendingInvPage === 0}
                  style={{ width: "auto", minWidth: 90, padding: "6px 14px" }}
                >
                  Back
                </button>
                <span style={{ alignSelf: "center", fontSize: 12, opacity: 0.85 }}>
                  Page {Math.min(pendingInvPage + 1, totalPendingInvPages)} / {totalPendingInvPages}
                </span>
                <button
                  className="btn btn-main mini-btn"
                  onClick={() => setPendingInvPage((p) => (p + 1 < totalPendingInvPages ? p + 1 : p))}
                  disabled={pendingInvPage + 1 >= totalPendingInvPages}
                  style={{ width: "auto", minWidth: 90, padding: "6px 14px" }}
                >
                  Next
                </button>
              </div>
            </div>

            <div className="card table-card">
              <h3 className="section-title">Pending Withdrawals</h3>
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
                  {pagedPendingWithdrawals.map((w) => (
                    <tr key={getRowId(w)}>
                      <td>{getUserEmail(w) !== "-" ? getUserEmail(w) : getUserName(w)}</td>
                      <td>{formatUsdt(w.amount)}</td>
                      <td>{String(w.type || w.withdraw_type || w.withdrawal_type || "—")}</td>
                      <td className="actions-cell">
                        <button
                          className="btn btn-success mini-btn"
                          onClick={() => handleWithdrawalAction(getRowId(w), "approve")}
                          disabled={processingIds.includes(getRowId(w))}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-danger mini-btn"
                          onClick={() => handleWithdrawalAction(getRowId(w), "reject")}
                          disabled={processingIds.includes(getRowId(w))}
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                  {pagedPendingWithdrawals.length === 0 && (
                    <tr>
                      <td colSpan="4" className="empty-state">
                        No pending withdrawals at the moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="topbar-actions" style={{ justifyContent: "center", gap: 10, marginTop: 12 }}>
                <button
                  className="btn btn-main mini-btn"
                  onClick={() => setPendingWithdrawPage((p) => Math.max(0, p - 1))}
                  disabled={pendingWithdrawPage === 0}
                  style={{ width: "auto", minWidth: 90, padding: "6px 14px" }}
                >
                  Back
                </button>
                <span style={{ alignSelf: "center", fontSize: 12, opacity: 0.85 }}>
                  Page {Math.min(pendingWithdrawPage + 1, totalPendingWithdrawPages)} / {totalPendingWithdrawPages}
                </span>
                <button
                  className="btn btn-main mini-btn"
                  onClick={() => setPendingWithdrawPage((p) => (p + 1 < totalPendingWithdrawPages ? p + 1 : p))}
                  disabled={pendingWithdrawPage + 1 >= totalPendingWithdrawPages}
                  style={{ width: "auto", minWidth: 90, padding: "6px 14px" }}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : null}

        {view === "earnings" ? (
          <div className="card table-card">
            <div className="topbar-actions" style={{ justifyContent: "center", marginBottom: 10, position: "relative" }}>
              <h3 className="section-title" style={{ marginBottom: 0, whiteSpace: "nowrap", textAlign: "center" }}>Withdrawal History</h3>
              <button
                className="btn btn-main mini-btn"
                style={{ width: "auto", minWidth: 64, padding: "6px 14px", position: "absolute", right: 0 }}
                onClick={() => setView("dashboard")}
              >
                Back
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>User name</th>
                  <th>User email</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {pagedWithdrawalHistory.map((row, index) => (
                  <tr key={`${getRowId(row) || "withdraw"}-${index}-${earningsPage}`}>
                    <td>{getUserName(row)}</td>
                    <td>{getUserEmail(row)}</td>
                    <td>{formatUsd(row.amount)}</td>
                    <td>{String(row.type || row.withdraw_type || row.withdrawal_type || "-")}</td>
                    <td>{getStatus(row) || "pending"}</td>
                    <td>{formatDateOnly(row.created_at || row.createdAt || row.date || row.updated_at || row.updatedAt)}</td>
                  </tr>
                ))}
                {pagedWithdrawalHistory.length === 0 && (
                  <tr>
                    <td colSpan="6" className="empty-state">
                      No withdrawal history available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="topbar-actions" style={{ justifyContent: "center", gap: 10, marginTop: 12 }}>
              <button
                className="btn btn-main mini-btn"
                onClick={() => setEarningsPage((p) => Math.max(0, p - 1))}
                disabled={earningsPage === 0}
                style={{ width: "auto", minWidth: 90, padding: "6px 14px" }}
              >
                Back
              </button>
              <span style={{ alignSelf: "center", fontSize: 12, opacity: 0.85 }}>
                Page {Math.min(earningsPage + 1, totalEarningsPages)} / {totalEarningsPages}
              </span>
              <button
                className="btn btn-main mini-btn"
                onClick={() => setEarningsPage((p) => (p + 1 < totalEarningsPages ? p + 1 : p))}
                disabled={earningsPage + 1 >= totalEarningsPages}
                style={{ width: "auto", minWidth: 90, padding: "6px 14px" }}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}

        {view === "history" ? (
          <div className="card table-card">
            <div className="topbar-actions" style={{ justifyContent: "center", marginBottom: 10, position: "relative" }}>
              <h3 className="section-title" style={{ marginBottom: 0, whiteSpace: "nowrap", textAlign: "center" }}>Investment History</h3>
              <button
                className="btn btn-main mini-btn"
                style={{ width: "auto", minWidth: 64, padding: "6px 14px", position: "absolute", right: 0 }}
                onClick={() => setView("dashboard")}
              >
                Back
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Plan</th>
                  <th>Amount</th>
                  <th>Profit</th>
                  <th>Payment</th>
                  <th>UTR</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {pagedAdminHistory.map((row, idx) => {
                  const userName = getUserName(row);
                  const userEmail = getUserEmail(row);
                  const planOrType = isWithdrawalRow(row)
                    ? String(row.type || row.withdraw_type || row.withdrawal_type || "withdraw")
                    : String(getPlanLabel(row) || "investment");
                  const payment = String(row.payment_method || row.paymentMethod || "-");
                  const utr = String(row.utr || row.reference || row.txn_ref || "-");
                  const status = getStatus(row) || "pending";
                  const date = formatDateTime(row.created_at || row.createdAt || row.date || row.updated_at || row.updatedAt);

                  return (
                    <tr key={`${getRowId(row) || "row"}-${idx}-${adminHistoryPage}`}>
                      <td>{userName}</td>
                      <td>{userEmail}</td>
                      <td>{formatPlanShort(planOrType)}</td>
                      <td>{formatUsd(row.amount)}</td>
                      <td>{formatUsd(row.expected_profit ?? row.expectedProfit ?? row.profit ?? 0)}</td>
                      <td>{payment}</td>
                      <td>{utr}</td>
                      <td>{status}</td>
                      <td>{formatDateOnly(row.created_at || row.createdAt || row.date || row.updated_at || row.updatedAt)}</td>
                    </tr>
                  );
                })}
                {pagedAdminHistory.length === 0 && (
                  <tr>
                    <td colSpan="9" className="empty-state">
                      No history available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="topbar-actions" style={{ justifyContent: "center", gap: 10, marginTop: 12 }}>
              <button
                className="btn btn-main mini-btn"
                onClick={() => setAdminHistoryPage((p) => Math.max(0, p - 1))}
                disabled={adminHistoryPage === 0}
                style={{ width: "auto", minWidth: 90, padding: "6px 14px" }}
              >
                Back
              </button>
              <span style={{ alignSelf: "center", fontSize: 12, opacity: 0.85 }}>
                Page {Math.min(adminHistoryPage + 1, totalAdminHistoryPages)} / {totalAdminHistoryPages}
              </span>
              <button
                className="btn btn-main mini-btn"
                onClick={() => setAdminHistoryPage((p) => (p + 1 < totalAdminHistoryPages ? p + 1 : p))}
                disabled={adminHistoryPage + 1 >= totalAdminHistoryPages}
                style={{ width: "auto", minWidth: 90, padding: "6px 14px" }}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
