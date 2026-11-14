// LOCAL MISSION SHELL FOR CREW HEALTH CHECKS.
import { useEffect, useState } from "react";
import logo from "./assets/health-engine-logo.png";
import "./App.css";
import { api, desktopAvailable } from "./api";
import { DetailPage, HealthCheckPage, HomePage, SettingsPage, TasksPage, WikiPage } from "./pages";
import type { AlertRow, MissionClock, StorageStatus, SyncStatus } from "./types";

type Page = "home" | "check" | "detail" | "tasks" | "wiki" | "settings";

const NAV: Array<{ id: Page; label: string }> = [
  { id: "home", label: "Profile" },
  { id: "check", label: "Camera monitoring" },
  { id: "detail", label: "Detail monitoring" },
  { id: "tasks", label: "Health achieve" },
  { id: "wiki", label: "Health Engine wiki" },
  { id: "settings", label: "Setup & backups" },
];

function browserClock(): MissionClock {
  const now = new Date();
  const doy = Math.floor((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86_400_000);
  const centi = String(Math.floor(now.getUTCMilliseconds() / 10)).padStart(2, "0");
  const stamp = `${now.toISOString().slice(0, 19).replace("T", " | ")}.${centi} UTC`;
  const hour = now.getUTCHours() + now.getUTCMinutes() / 60;
  const day = hour >= 6 && hour < 21.5;
  return {
    utc: stamp,
    doy,
    doy_label: `DOY ${doy}`,
    met: "MET —",
    circadian: day ? "06:00–21:30 UTC • DAY SHIFT" : "21:30–06:00 UTC • SLEEP CYCLE",
    mission_state: "idle",
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
  const [metHover, setMetHover] = useState(false);
  const [missionPrompt, setMissionPrompt] = useState<"start" | "resume" | null>(null);
  const [missionError, setMissionError] = useState("");
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
    const shellTimer = window.setInterval(() => void refreshShell(), 1000);
    const clockTimer = window.setInterval(() => {
      if (!desktop) {
        setClock(browserClock());
        return;
      }
      void api.clock().then(setClock).catch(() => undefined);
    }, 100);
    return () => {
      window.clearInterval(shellTimer);
      window.clearInterval(clockTimer);
    };
  }, [desktop]);

  const missionState = clock?.mission_state ?? "idle";
  const metCaption = missionState === "running"
    ? "Running. Pause freezes it."
    : missionState === "paused"
      ? "Frozen. Play to continue."
      : "Not started. Hover to start.";

  async function confirmMission(kind: "start" | "resume") {
    setMissionError("");
    try {
      if (kind === "start") await api.startMission();
      else await api.resumeMission();
      setClock(await api.clock());
      setMissionPrompt(null);
    } catch (reason) {
      setMissionError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <ClockCell label="UTC" value={clock?.utc ?? "—"} hint="Zulu time. Main clock." />
        <ClockCell label="DOY" value={clock?.doy_label ?? "—"} hint="Day of the year for logs." />
        <div
          className={metHover && missionState === "idle" ? "clock-cell met armed" : "clock-cell met"}
          onMouseEnter={() => setMetHover(true)}
          onMouseLeave={() => setMetHover(false)}
        >
          <span>MET</span>
          <strong>{clock?.met ?? "—"}</strong>
          <em className="hint warn">{metCaption}</em>
          {metHover && missionState === "idle" && (
            <button
              type="button"
              className="mission-start"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setMissionError("");
                setMissionPrompt("start");
              }}
            >
              Start mission
            </button>
          )}
          {missionState === "running" && (
            <button type="button" className="mission-hold" aria-label="Pause mission timer" onClick={() => void api.pauseMission().then(() => api.clock().then(setClock)).catch((reason: unknown) => setMissionError(String(reason)))}>
              ⏸
            </button>
          )}
          {missionState === "paused" && (
            <button type="button" className="mission-hold" aria-label="Resume mission timer" onClick={() => { setMissionError(""); setMissionPrompt("resume"); }}>
              ▶
            </button>
          )}
        </div>
        <ClockCell label="Circadian" value={clock?.circadian ?? "—"} hint="Onboard day shift or sleep." />
      </header>
      {missionError && <p className="error clock-error">{missionError}</p>}
      {missionPrompt && (
        <div className="mission-popup" role="dialog" aria-modal="true" aria-labelledby="mission-title">
          <div className="mission-card">
            <h2 id="mission-title">{missionPrompt === "start" ? "Start mission clock" : "Resume mission clock"}</h2>
            <p>
              {missionPrompt === "start"
                ? "This clock times every crew health event from mission start. Press again to start."
                : "The frozen clock will run again from the paused time. Press again to resume."}
            </p>
            <div className="row">
              <button
                type="button"
                onClick={() => void confirmMission(missionPrompt)}
              >
                {missionPrompt === "start" ? "Start" : "Resume"}
              </button>
              <button type="button" onClick={() => setMissionPrompt(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
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

function ClockCell({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="clock-cell">
      <span>{label}</span>
      <strong>{value}</strong>
      <em className="hint">{hint}</em>
    </div>
  );
}
