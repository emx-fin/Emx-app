import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────
// 1. CONFIGURATION
// ─────────────────────────────────────────────
const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbw0yDOYaMKAnliUPspGuw4EuOJC1ZCUjFynGy7p6huzu9VigEhedtZkWFiPN3IcLiPd/exec";
const SHEET_ID = "1a7us6s775zvUGyUmRI01qPF05kNcISWQUweCW7UcgJQ";

// ─────────────────────────────────────────────
// 2. MANAGERS LIST (Danh sách Manager bắt buộc chọn)
// ─────────────────────────────────────────────
const MANAGERS = ["LiLy", "Kelly", "Tinh", "Max", "Giap", "Trung"];

// ─────────────────────────────────────────────
// 3. CATEGORIES (English Only)
// ─────────────────────────────────────────────
const CATS = [
  {
    id: "bar",
    label: "::Bar Inventory",
    icon: "🍾",
    color: "#f59e0b",
    subs: [
      "Buy Liquor",
      "Buy Beer",
      "Buy Soft Drinks / Juice",
      "Buy Glassware & Tools",
      "Other",
    ],
  },
  {
    id: "staff",
    label: ":: Pay Staffs",
    icon: "👤",
    color: "#60a5fa",
    subs: [
      "Pay Waitress",
      "Pay BellBoys",
      "Pay Dancer",
      "Pay Security",
      "Pay Cashier",
      "Other",
    ],
  },
  {
    id: "ops",
    label: "::Pay Operations",
    icon: "⚡",
    color: "#34d399",
    subs: [
      "Sound & Lighting Eq",
      "Electricity",
      "Water",
      "Rent",
      "Repair & Maintenance",
      "Cleaning",
      "Other",
    ],
  },
  {
    id: "mkt",
    label: "::Pay Marketing & Events",
    icon: "🎵",
    color: "#f472b6",
    subs: [
      "DJ / Live Band",
      "Social Media Ads",
      "Event Decoration",
      "Print / Flyer",
      "Special Event",
      "Other",
    ],
  },
];

// ─────────────────────────────────────────────
// HELPERS & API
// ─────────────────────────────────────────────
const fmtVND = (n: any) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    n || 0
  );
const isoToday = () => new Date().toISOString().slice(0, 10);
const fmtDisp = () =>
  new Date().toLocaleDateString("en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const sendDataWithFetch = async (payload: any) => {
  const formData = new FormData();
  formData.append("sheetId", SHEET_ID);
  formData.append("date", payload.date || "");
  formData.append("time", payload.time || "");
  formData.append("catEN", payload.cat || "");
  formData.append("subEN", payload.sub || "");
  formData.append("amount", String(payload.amount || 0));
  formData.append("staff", (payload.staff || "").replace(/[^\w\s]/g, ""));
  formData.append("notes", (payload.notes || "").substring(0, 200));
  formData.append("source", "EmpirexFinanceApp");

  await fetch(SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    body: formData,
  });
};

// ─────────────────────────────────────────────
// MAIN APP COMPONENT
// ─────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("enter");
  const [loaded, setLoaded] = useState(false);

  const [entries, setEntries] = useState(() => {
    try {
      const saved = localStorage.getItem("emp_finance_data");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selCat, setSelCat] = useState(null);
  const [form, setForm] = useState({
    subIdx: "",
    amount: "",
    notes: "",
    staff: "",
    date: isoToday(),
  });

  const [syncing, setSyncing] = useState(false);
  const [syncPct, setSyncPct] = useState(0);
  const [toast, setToast] = useState<any>(null);
  const syncTimer = useRef<any>(null);

  const isConnected = SCRIPT_URL.startsWith("http") && SHEET_ID.length > 10;

  useEffect(() => {
    localStorage.setItem("emp_finance_data", JSON.stringify(entries));
    if (!loaded) setTimeout(() => setLoaded(true), 300);
  }, [entries, loaded]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type } as any);
    setTimeout(() => setToast(null), 3200);
  };

  const resetForm = () => {
    setSelCat(null);
    setForm({ subIdx: "", amount: "", notes: "", staff: "", date: isoToday() });
  };

  const startSyncAnim = () => {
    setSyncPct(0);
    let p = 0;
    syncTimer.current = setInterval(() => {
      p = Math.min(p + (p < 80 ? 5 : p < 95 ? 1 : 0.2), 98);
      setSyncPct(p);
    }, 100);
  };

  const endSyncAnim = (success) => {
    clearInterval(syncTimer.current);
    setSyncPct(success ? 100 : 0);
    setTimeout(() => setSyncPct(0), 800);
  };

  const handleSubmit = async () => {
    // Bắt buộc phải có cả amount và staff mới được gửi
    if (!selCat || !form.amount || !form.staff) return;
    setSyncing(true);

    const cat = CATS.find((c) => c.id === selCat) as any;
    const sub = form.subIdx !== "" ? cat?.subs[parseInt(form.subIdx)] : null;
    const entry = {
      id: Date.now(),
      date: form.date,
      time: new Date().toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }),
      catId: selCat,
      cat: cat.label,
      sub: sub || cat.label,
      amount: parseFloat(form.amount) || 0,
      notes: form.notes || "",
      staff: form.staff || "",
    };

    setEntries([entry, ...entries]);

    if (isConnected) {
      startSyncAnim();
      try {
        await sendDataWithFetch(entry);
        endSyncAnim(true);
        showToast("✓ Saved & synced to Sheets!", "success");
      } catch (err) {
        endSyncAnim(false);
        showToast("No internet — Saved locally", "error");
      }
    } else {
      showToast("✓ Saved locally", "info");
    }

    setSyncing(false);
    setTimeout(resetForm, 600);
  };

  const todayStr = isoToday();
  const monthStr = todayStr.slice(0, 7);
  const todayList = entries.filter((e) => e.date === todayStr);
  const monthList = entries.filter((e) => e.date.startsWith(monthStr));
  const totalAll = entries.reduce((s, e) => s + e.amount, 0);

  const S = {
    card: {
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14,
      padding: "14px 16px",
      marginBottom: 10,
    },
    lbl: {
      fontSize: 11,
      color: "rgba(255,255,255,0.4)",
      display: "block",
      marginBottom: 6,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    input: {
      width: "100%",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 10,
      padding: "12px 14px",
      color: "#fff",
      fontSize: 14,
      outline: "none",
      fontFamily: "inherit",
    },
    sel: {
      width: "100%",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 10,
      padding: "12px 14px",
      color: "#fff",
      fontSize: 14,
      outline: "none",
      appearance: "none",
      WebkitAppearance: "none",
      fontFamily: "inherit",
    },
    btn: {
      border: "none",
      borderRadius: 11,
      padding: "13px 16px",
      color: "#fff",
      fontWeight: 700,
      fontSize: 14,
      cursor: "pointer",
      fontFamily: "inherit",
    },
  };

  // Nút submit sẽ bị mờ và khóa nếu chưa nhập tiền hoặc chưa chọn Manager
  const isSubmitDisabled = !form.amount || !form.staff || syncing;

  if (!loaded)
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#07070f",
          color: "#fff",
          gap: 14,
        }}
      >
        <div style={{ fontSize: 52 }}>⚡</div>
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: 3,
            color: "rgba(255,255,255,0.9)",
          }}
        >
          EMPIREX
        </div>
      </div>
    );

  return (
    <div
      style={{
        background: "#07070f",
        minHeight: "100vh",
        color: "#fff",
        fontFamily: "'Segoe UI',system-ui,sans-serif",
        maxWidth: 430,
        margin: "0 auto",
        paddingBottom: 86,
      }}
    >
      <style>{`
        *{-webkit-tap-highlight-color:transparent;box-sizing:border-box;}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(.5);}
        select option{background:#14142a;color:#fff;}
        .tab{animation:up .2s ease;}
        .press:active{transform:scale(.96);}
        @keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px;}
        textarea{resize:none;}
      `}</style>

      {/* HEADER */}
      <div
        style={{
          background: "linear-gradient(135deg,#100520,#081828)",
          padding: "16px 20px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          position: "sticky",
          top: 0,
          zIndex: 90,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "linear-gradient(135deg,#f59e0b,#ef4444)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              ⚡
            </div>
            <div>
              <div
                style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.5 }}
              >
                EMPIREX
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)" }}>
                {fmtDisp()}
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: 10,
              padding: "3px 9px",
              borderRadius: 20,
              fontWeight: 600,
              background: isConnected
                ? "rgba(52,211,153,0.15)"
                : "rgba(255,255,255,0.07)",
              color: isConnected ? "#34d399" : "rgba(255,255,255,0.3)",
              border: `1px solid ${
                isConnected ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.1)"
              }`,
            }}
          >
            {isConnected ? "● LIVE" : "○ LOCAL"}
          </div>
        </div>
        {syncPct > 0 && (
          <div
            style={{
              height: 2,
              background: "rgba(255,255,255,0.07)",
              borderRadius: 2,
              marginTop: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${syncPct}%`,
                background: "linear-gradient(90deg,#f59e0b,#34d399)",
                borderRadius: 2,
                transition: "width .1s linear",
              }}
            />
          </div>
        )}
      </div>

      {/* TOAST */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 68,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 200,
            maxWidth: 390,
            width: "calc(100% - 32px)",
            background:
              toast.type === "success"
                ? "rgba(52,211,153,0.14)"
                : toast.type === "error"
                ? "rgba(239,68,68,0.14)"
                : "rgba(245,158,11,0.14)",
            border: `1px solid ${
              toast.type === "success"
                ? "rgba(52,211,153,0.4)"
                : toast.type === "error"
                ? "rgba(239,68,68,0.4)"
                : "rgba(245,158,11,0.4)"
            }`,
            borderRadius: 12,
            padding: "11px 18px",
            color:
              toast.type === "success"
                ? "#34d399"
                : toast.type === "error"
                ? "#f87171"
                : "#fbbf24",
            fontSize: 13,
            fontWeight: 600,
            textAlign: "center",
            animation: "up .25s ease",
          }}
        >
          {toast.msg}
        </div>
      )}

      <div style={{ padding: "0 16px" }}>
        {/* TAB: ENTER */}
        {tab === "enter" && (
          <div className="tab" style={{ paddingTop: 18 }}>
            {!selCat ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    marginBottom: 18,
                  }}
                >
                  {[
                    {
                      label: "Today",
                      val: todayList.reduce((s, e) => s + e.amount, 0),
                      sub: `${todayList.length} items`,
                      color: "#f59e0b",
                      bg: "rgba(245,158,11,0.08)",
                      bd: "rgba(245,158,11,0.2)",
                    },
                    {
                      label: "This Month",
                      val: monthList.reduce((s, e) => s + e.amount, 0),
                      sub: `${monthList.length} items`,
                      color: "#60a5fa",
                      bg: "rgba(96,165,250,0.08)",
                      bd: "rgba(96,165,250,0.2)",
                    },
                  ].map((d) => (
                    <div
                      key={d.label}
                      style={{
                        background: d.bg,
                        border: `1px solid ${d.bd}`,
                        borderRadius: 13,
                        padding: "13px 15px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.38)",
                          marginBottom: 5,
                          textTransform: "uppercase",
                          letterSpacing: 0.6,
                        }}
                      >
                        {d.label}
                      </div>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: d.color,
                        }}
                      >
                        {fmtVND(d.val)}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.28)",
                          marginTop: 2,
                        }}
                      >
                        {d.sub}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.35)",
                    marginBottom: 11,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Select Category
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  {CATS.map((cat) => {
                    const count = entries.filter(
                      (e) => e.catId === cat.id
                    ).length;
                    return (
                      <button
                        key={cat.id}
                        className="press"
                        onClick={() => setSelCat(cat.id)}
                        style={{
                          background: `${cat.color}0e`,
                          border: `1.5px solid ${cat.color}28`,
                          borderRadius: 15,
                          padding: "20px 13px 16px",
                          cursor: "pointer",
                          textAlign: "left",
                          color: "#fff",
                          transition: "all .14s",
                        }}
                      >
                        <div style={{ fontSize: 30, marginBottom: 9 }}>
                          {cat.icon}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: cat.color,
                            lineHeight: 1.3,
                          }}
                        >
                          {cat.label}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "rgba(255,255,255,0.28)",
                            marginTop: 3,
                          }}
                        >
                          {count} logs
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={resetForm}
                  style={{
                    background: "none",
                    border: "none",
                    color: "rgba(255,255,255,0.45)",
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "0 0 14px",
                    marginLeft: -2,
                  }}
                >
                  ← Back
                </button>

                {(() => {
                  const cat = CATS.find((c) => c.id === selCat);
                  return (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 11,
                        marginBottom: 18,
                        background: `${cat.color}10`,
                        borderRadius: 13,
                        padding: "13px 16px",
                        border: `1px solid ${cat.color}28`,
                      }}
                    >
                      <span style={{ fontSize: 26 }}>{cat.icon}</span>
                      <div
                        style={{
                          fontWeight: 700,
                          color: cat.color,
                          fontSize: 16,
                        }}
                      >
                        {cat.label}
                      </div>
                    </div>
                  );
                })()}

                <div
                  style={{ display: "flex", flexDirection: "column", gap: 13 }}
                >
                  <div>
                    <label style={S.lbl}>Sub-category</label>
                    <div style={{ position: "relative" }}>
                      <select
                        value={form.subIdx}
                        onChange={(e) =>
                          setForm({ ...form, subIdx: e.target.value })
                        }
                        style={S.sel}
                      >
                        <option value="">— Select item —</option>
                        {CATS.find((c) => c.id === selCat)?.subs.map((s, i) => (
                          <option key={i} value={i}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <span
                        style={{
                          position: "absolute",
                          right: 13,
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "rgba(255,255,255,0.3)",
                          pointerEvents: "none",
                          fontSize: 11,
                        }}
                      >
                        ▼
                      </span>
                    </div>
                  </div>

                  <div>
                    <label style={S.lbl}>Amount (VNĐ) *</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={form.amount}
                      onChange={(e) =>
                        setForm({ ...form, amount: e.target.value })
                      }
                      placeholder="0"
                      style={{
                        ...S.input,
                        fontSize: 26,
                        fontWeight: 700,
                        padding: "14px",
                      }}
                    />
                    {form.amount && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.35)",
                          marginTop: 4,
                          paddingLeft: 2,
                        }}
                      >
                        {fmtVND(parseFloat(form.amount) || 0)}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {[500000, 1000000, 2000000, 5000000, 10000000].map((n) => {
                      const active = form.amount === String(n);
                      return (
                        <button
                          key={n}
                          onClick={() =>
                            setForm({ ...form, amount: String(n) })
                          }
                          style={{
                            ...S.btn,
                            padding: "6px 11px",
                            fontSize: 11,
                            background: active
                              ? "rgba(245,158,11,0.2)"
                              : "rgba(255,255,255,0.05)",
                            border: `1px solid ${
                              active
                                ? "rgba(245,158,11,0.5)"
                                : "rgba(255,255,255,0.1)"
                            }`,
                            color: active
                              ? "#f59e0b"
                              : "rgba(255,255,255,0.55)",
                          }}
                        >
                          {n >= 1000000 ? `${n / 1000000}M` : `${n / 1000}K`}
                        </button>
                      );
                    })}
                  </div>

                  {/* DROP DOWN CHO MANAGER NAME (THAY THẾ CHO STAFF TEXT INPUT) */}
                  <div>
                    <label style={S.lbl}>Manager Name *</label>
                    <div style={{ position: "relative" }}>
                      <select
                        value={form.staff}
                        onChange={(e) =>
                          setForm({ ...form, staff: e.target.value })
                        }
                        style={S.sel}
                      >
                        <option value="">— Select Manager —</option>
                        {MANAGERS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <span
                        style={{
                          position: "absolute",
                          right: 13,
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "rgba(255,255,255,0.3)",
                          pointerEvents: "none",
                          fontSize: 11,
                        }}
                      >
                        ▼
                      </span>
                    </div>
                  </div>

                  <div>
                    <label style={S.lbl}>Date</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) =>
                        setForm({ ...form, date: e.target.value })
                      }
                      style={S.input}
                    />
                  </div>

                  <div>
                    <label style={S.lbl}>Notes</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) =>
                        setForm({ ...form, notes: e.target.value })
                      }
                      placeholder="Add remarks..."
                      rows={2}
                      style={{ ...S.input, lineHeight: 1.6 }}
                    />
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitDisabled}
                    className="press"
                    style={{
                      ...S.btn,
                      width: "100%",
                      padding: "15px",
                      fontSize: 15,
                      marginTop: 2,
                      background: isSubmitDisabled
                        ? "rgba(255,255,255,0.06)"
                        : "linear-gradient(135deg,#f59e0b,#ef4444)",
                      opacity: isSubmitDisabled ? 0.5 : 1,
                      cursor: isSubmitDisabled ? "not-allowed" : "pointer",
                    }}
                  >
                    {syncing ? "⏳ Syncing..." : "💾 Save Expense"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB: DASHBOARD */}
        {tab === "dash" && (
          <div className="tab" style={{ paddingTop: 18 }}>
            <div
              style={{
                background: "linear-gradient(135deg,#150828,#091820)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 17,
                padding: "20px",
                marginBottom: 14,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.35)",
                  textTransform: "uppercase",
                  letterSpacing: 1.2,
                  marginBottom: 8,
                }}
              >
                Total — {monthStr.slice(5)}/{monthStr.slice(0, 4)}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b" }}>
                {fmtVND(monthList.reduce((s, e) => s + e.amount, 0))}
              </div>
            </div>

            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.35)",
                marginBottom: 11,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Breakdown
            </div>
            {CATS.map((cat) => {
              const total = entries
                .filter((e) => e.catId === cat.id)
                .reduce((s, e) => s + e.amount, 0);
              const count = entries.filter((e) => e.catId === cat.id).length;
              const pct =
                totalAll > 0 ? Math.round((total / totalAll) * 100) : 0;
              return (
                <div
                  key={cat.id}
                  style={{ ...S.card, borderLeft: `3px solid ${cat.color}` }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 9,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span style={{ fontSize: 19 }}>{cat.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {cat.label}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "rgba(255,255,255,0.28)",
                          }}
                        >
                          {count} logs
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: cat.color,
                        }}
                      >
                        {fmtVND(total)}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.28)",
                        }}
                      >
                        {pct}%
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      height: 4,
                      background: "rgba(255,255,255,0.07)",
                      borderRadius: 4,
                    }}
                  >
                    <div
                      style={{
                        height: 4,
                        background: cat.color,
                        borderRadius: 4,
                        width: `${pct}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB: HISTORY */}
        {tab === "history" && (
          <div className="tab" style={{ paddingTop: 18 }}>
            {entries.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "rgba(255,255,255,0.2)",
                  paddingTop: 40,
                }}
              >
                <div style={{ fontSize: 44, marginBottom: 12 }}>📝</div>
                <div style={{ fontSize: 13 }}>No records found</div>
              </div>
            ) : (
              entries.map((e) => {
                const cat = CATS.find((c) => c.id === e.catId);
                return (
                  <div
                    key={e.id}
                    style={{
                      ...S.card,
                      borderLeft: `3px solid ${cat?.color || "#666"}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 13,
                            color: cat?.color,
                          }}
                        >
                          {cat?.icon} {e.sub}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "rgba(255,255,255,0.3)",
                            marginTop: 2,
                          }}
                        >
                          {e.date} · {e.time}{" "}
                          {e.staff ? `· Mgr: ${e.staff}` : ""}
                        </div>
                        {e.notes && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "rgba(255,255,255,0.32)",
                              marginTop: 4,
                              fontStyle: "italic",
                            }}
                          >
                            💬 {e.notes}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 13,
                          color: "#fff",
                          flexShrink: 0,
                          marginLeft: 12,
                        }}
                      >
                        {fmtVND(e.amount)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB: SETTINGS (Simplified) */}
        {tab === "settings" && (
          <div className="tab" style={{ paddingTop: 18 }}>
            <div
              style={{
                ...S.card,
                borderColor: isConnected
                  ? "rgba(52,211,153,0.25)"
                  : "rgba(255,255,255,0.08)",
                background: isConnected
                  ? "rgba(52,211,153,0.05)"
                  : "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: isConnected
                      ? "#34d399"
                      : "rgba(255,255,255,0.18)",
                    flexShrink: 0,
                  }}
                />
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {isConnected ? "Sheets Connected" : "Not Configured"}
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.3)",
                  marginTop: 8,
                  lineHeight: 1.5,
                }}
              >
                Config values are securely hardcoded in the App.js file on your
                CodeSandbox.
              </div>
            </div>

            <div style={S.card}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                ⚠️ Reset Data
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.3)",
                  marginBottom: 14,
                  lineHeight: 1.4,
                }}
              >
                This will clear the local app history. Data already synced to
                Google Sheets will remain safe.
              </div>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "Are you sure you want to clear local history?"
                    )
                  ) {
                    setEntries([]);
                    localStorage.removeItem("emp_finance_data");
                    showToast("Local data cleared", "info");
                  }
                }}
                style={{
                  ...S.btn,
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#f87171",
                  width: "100%",
                }}
              >
                Clear Local History
              </button>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 430,
          background: "rgba(7,7,15,0.97)",
          backdropFilter: "blur(14px)",
          borderTop: "1px solid rgba(255,255,255,0.09)",
          display: "flex",
          padding: "7px 0 12px",
          zIndex: 100,
        }}
      >
        {[
          { id: "enter", icon: "➕", label: "Home" },
          { id: "dash", icon: "📊", label: "Stats" },
          { id: "history", icon: "📋", label: "History" },
          { id: "settings", icon: "⚙️", label: "Setup" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "3px 0",
              fontFamily: "inherit",
              color: tab === t.id ? "#f59e0b" : "rgba(255,255,255,0.32)",
              fontWeight: tab === t.id ? 600 : 400,
            }}
          >
            <span style={{ fontSize: 21, lineHeight: 1 }}>{t.icon}</span>
            <span style={{ fontSize: 9 }}>{t.label}</span>
            {tab === t.id && (
              <div
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: "50%",
                  background: "#f59e0b",
                }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
