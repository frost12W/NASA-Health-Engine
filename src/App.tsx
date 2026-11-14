// LOCAL MISSION SHELL FOR CREW HEALTH CHECKS.
import { useEffect, useState } from "react";
import logo from "./assets/health-engine-logo.png";
import "./App.css";
import { api, desktopAvailable } from "./api";
import { DetailPage, HealthCheckPage, HomePage, SettingsPage, TasksPage, WikiPage } from "./pages";
import type { AlertRow, MissionClock, StorageStatus, SyncStatus } from "./types";

type Page = "home" | "check" | "detail" | "tasks" | "wiki" | "settings";

const NAV: Array<{ id: Page; label: string }> = [
  { id: "home", label: "Home" },
  { id: "check", label: "Health check" },
  { id: "detail", label: "Detail monitoring" },
  { id: "tasks", label: "Health achieve" },
  { id: "wiki", label: "Health Engine wiki" },
  { id: "settings", label: "Settings" },
];

function browserClock(): MissionClock {
  const now = new Date();
  const doy = Math.floor((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86_400_000);
  const stamp = now.toISOString().slice(0, 19).replace("T", " | ") + " UTC";
  return {
    utc: stamp,
    doy,
    doy_label: `DOY ${doy}`,
    met: "MET not configured",
    circadian: "Schedule not configured",
    clock_sync: "browser-preview",
    clock_note: "This browser preview is not the application clock and cannot save records.",
  };
}

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [clock, setClock] = useState<MissionClock | null>(null);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const desktop = desktopAvailable();

  async function refreshShell() {
    if (!desktop) {
      setClock(browserClock());
      return;
    }
    const [nextClock, nextStorage, nextAlerts, nextSync] = await Promise.all([
      api.clock(),
      api.storage(),
      api.alerts(),
      api.sync(),
    ]);
    setClock(nextClock);
    setStorage(nextStorage);
    setAlerts(nextAlerts);
    setSync(nextSync);
  }

  useEffect(() => {
    void refreshShell();
    const timer = window.setInterval(() => void refreshShell(), 1000);
    return () => window.clearInterval(timer);
  }, [desktop]);

  return (
    <div className="shell">
      <header className="topbar">
        <ClockCell label="UTC" value={clock?.utc ?? "—"} />
        <ClockCell label="DOY" value={clock?.doy_label ?? "—"} />
        <ClockCell label="MET" value={clock?.met ?? "—"} />
        <ClockCell label="Circadian" value={clock?.circadian ?? "—"} />
      </header>
      <p className="clock-note">{clock?.clock_note ?? "Clock synchronization: unknown."}</p>
      {!desktop && (
        <p className="banner">
          Desktop shell is not connected. This window can explain the program, but it cannot open a camera or save records.
        </p>
      )}
      {storage?.warning && <p className="banner warn">{storage.warning}</p>}
      {alerts.map((alert) => (
        <div className="banner warn" key={alert.alert_id}>
          <span>
            System alert: {alert.rule_id}. Status {alert.status}. This is not a health diagnosis.
          </span>
          {alert.status === "OPEN" && (
            <button type="button" onClick={() => void api.acknowledge(alert.alert_id).then(refreshShell)}>
              Acknowledge
            </button>
          )}
        </div>
      ))}
      <div className="body">
        <nav>
          <img className="brand" src={logo} alt="Health Engine" />
          {NAV.map((item) => (
            <button key={item.id} type="button" className={page === item.id ? "nav active" : "nav"} onClick={() => setPage(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
        <main>
          <div className="page" key={page}>
          {page === "home" && <HomePage sync={sync} onChanged={refreshShell} />}
          {page === "check" && <HealthCheckPage />}
          {page === "detail" && <DetailPage />}
          {page === "tasks" && <TasksPage />}
          {page === "wiki" && <WikiPage />}
          {page === "settings" && <SettingsPage storage={storage} onChanged={refreshShell} />}
          </div>
          <p className="disclaimer">
            Health Engine supports health checks. It does not diagnose, treat, or decide fitness for duty. A camera pulse
            number appears only after the signal-quality checks pass, and it remains an estimate.
          </p>
        </main>
      </div>
    </div>
  );
}

function ClockCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
