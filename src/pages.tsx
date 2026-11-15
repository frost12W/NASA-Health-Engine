// CREW PAGES FOR CHECKS, RECORDS, TASKS, HELP, AND SETTINGS.
import { listen } from "@tauri-apps/api/event";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import profileMark from "./assets/profile-mark.png";
import { api, desktopAvailable } from "./api";
import type { HomeCard, JournalRow, MetricRow, PersonSession, StorageStatus, SyncStatus, TaskView, WorkerEvent } from "./types";

export type CheckReason = "schedule" | "feel";

export function reasonLabel(reason: CheckReason): string {
  return reason === "schedule" ? "Scheduled check" : "Check on how you feel";
}

// The local core still answers two profile errors in Russian. The interface is English, so those
// replies are replaced here by origin instead of being shown as they arrive.
export const CORE_PROFILE_ERRORS = {
  noProfile: "There is no profile on this computer yet.",
  loginMismatch: "This login does not match the profile on this computer. Someone else's records stay closed.",
} as const;

function hasNonAscii(text: string): boolean {
  return /[^\x00-\x7F]/.test(text);
}

export function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export function coreError(reason: unknown, fallback: string): string {
  const text = errorText(reason);
  return hasNonAscii(text) ? fallback : text;
}

export function HomePage({ session, sync, onLeave, onStart, onOpenHistory }: {
  session: PersonSession;
  sync: SyncStatus | null;
  onLeave: () => void;
  onStart: (reason: CheckReason) => void;
  onOpenHistory: () => void;
}) {
  const [card, setCard] = useState<HomeCard | null>(null);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [journal, setJournal] = useState<JournalRow[]>([]);
  const [error, setError] = useState("");

  async function load() {
    if (!desktopAvailable()) return;
    const [cards, nextMetrics, nextJournal] = await Promise.all([
      api.home(),
      api.metrics(session.astronautId),
      api.journal(session.astronautId),
    ]);
    setCard(cards.find((item) => item.astronaut_id === session.astronautId) ?? null);
    setMetrics(nextMetrics);
    setJournal(nextJournal);
  }

  useEffect(() => {
    void load().catch((reason: unknown) => setError(String(reason)));
    const timer = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [session.astronautId]);

  const today = new Date().toISOString().slice(0, 10);
  const latestCamera = metrics.find((metric) => metric.metric_type === "PULSE_RATE" && metric.source_type === "CAMERA_DERIVED");
  const pulsePoints = metrics.filter((metric) => metric.metric_type === "PULSE_RATE" && metric.source_type === "CAMERA_DERIVED" && metric.validity_status === "VALID" && metric.value != null);
  const pressurePoints = metrics.filter((metric) => metric.metric_type === "BLOOD_PRESSURE_SYSTOLIC" && metric.validity_status === "VALID" && metric.value != null);
  const temperaturePoints = metrics.filter((metric) => metric.metric_type === "BODY_TEMPERATURE" && metric.validity_status === "VALID" && metric.value != null);
  const missed = missedToday(today, metrics, journal);
  const lastMood = journal.find((entry) => entry.entry_type === "MOOD");
  const transfer = transferLabel(sync);

  return (
    <section className="home-layout">
      <article className="panel crew-card personal-card">
        <div className="profile">
          <img className="profile-mark" src={profileMark} alt="" />
          <p className="profile-age">{session.ageYears}</p>
          <h2>{session.displayName}</h2>
          <p className="profile-role">{session.role}</p>
        </div>
        <dl className="identity">
          <div><dt>Age</dt><dd>{session.ageYears}</dd></div>
          <div><dt>Name</dt><dd>{session.displayName}</dd></div>
          <div><dt>Role</dt><dd>{session.role}</dd></div>
          <div><dt>Test password</dt><dd className="mono">{session.sessionPassword}</dd></div>
        </dl>
        <p className="muted">The test password lives in this window only. It is not written to the database. This is not a NASA account.</p>
        <p className="crew-id">PROFILE ID {card?.crew_identifier ?? session.crewIdentifier}</p>
        <button type="button" onClick={onLeave}>Sign out</button>
      </article>
      <div className="summary-stack">
        {error && <p className="error">{error}</p>}
        <section className="panel">
          <h2>Summary</h2>
          <p className="muted">The latest readings for this profile. Every number carries its source. This is not a diagnosis.</p>
          <div className="summary-actions">
            <button type="button" onClick={() => onStart("feel")}>Start a check</button>
            <button type="button" onClick={() => onStart("schedule")}>Scheduled check</button>
            <button type="button" onClick={onOpenHistory}>History and charts</button>
          </div>
          <p>Scheduled task today: <span className={taskClass(card?.task_display_status ?? "DUE")}>{card?.task_display_status ?? "DUE"}</span></p>
          <dl className="reading-list">
            <Reading label="Pulse" value={card?.pulse_bpm ?? null} unit="bpm" source={card?.pulse_source ?? latestCamera?.source_type ?? null} at={latestCamera?.measured_at_utc ?? null} />
            <Reading label="Blood pressure" value={card?.last_systolic != null ? `${card.last_systolic}/${card.last_diastolic ?? "—"}` : null} unit="mmHg" source={latestSource(metrics, "BLOOD_PRESSURE_SYSTOLIC")} at={latestTime(metrics, "BLOOD_PRESSURE_SYSTOLIC")} />
            <Reading label="Temperature" value={latestValue(metrics, "BODY_TEMPERATURE")} unit="°C" source={latestSource(metrics, "BODY_TEMPERATURE")} at={latestTime(metrics, "BODY_TEMPERATURE")} />
            <Reading label="Sleep" value={card?.sleep_hours ?? null} unit="h" source={card?.sleep_source ?? null} at={journal.find((entry) => entry.entry_type === "SLEEP")?.recorded_at_utc ?? null} />
            <Reading label="Mood" value={card?.wellbeing ?? null} unit="/ 5" source={card?.wellbeing_source ?? null} at={lastMood?.recorded_at_utc ?? null} />
          </dl>
          <p>Quality of the latest camera pulse: {cameraQuality(latestCamera)}</p>
          <p className="muted">Latest wellbeing entry: {lastMood ? `${lastMood.value} of 5, ${lastMood.recorded_at_utc}` : "none yet"}.</p>
          <div>
            <h3>Missing today</h3>
            {missed.length === 0 ? <p>Today's entries are already in.</p> : <ul className="missed">{missed.map((item) => <li key={item}>{item}</li>)}</ul>}
          </div>
        </section>
        <section className="panel">
          <h2>Trends</h2>
          <p className="muted">The line uses saved numbers only. Gaps are not filled in. The camera gives pulse only.</p>
          {pulsePoints.length === 0 ? <p>The pulse chart appears after a reliable camera check.</p> : <SeriesChart points={pulsePoints} label="Measurement trend" stroke="#7dcea0" unit="bpm" />}
          {pressurePoints.length > 0 && <SeriesChart points={pressurePoints} label="Measurement trend" stroke="#3ec6ff" unit="mmHg" />}
          {temperaturePoints.length > 0 && <SeriesChart points={temperaturePoints} label="Measurement trend" stroke="#e6c84a" unit="°C" />}
        </section>
        <section className="panel">
          <h2>Transfer to doctor</h2>
          <p><span className={transfer.tone}>{transfer.label}</span></p>
          <p>Waiting to send: {sync?.waiting_count ?? sync?.local_only_count ?? "—"}</p>
          <p>Sent: {sync?.sent_count ?? 0}</p>
          <p>Send errors: {sync?.error_count ?? 0}</p>
          <p className="muted">The link to the ground doctor is unavailable right now. Records stay on this computer and leave when a channel is configured. The onboard medic has no access in this version.</p>
        </section>
      </div>
    </section>
  );
}

function Reading({ label, value, unit, source, at }: { label: string; value: number | string | null; unit: string; source: string | null; at: string | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value ?? "—"} {value != null ? unit : ""}</dd>
      <dd className="muted">{sourceLabel(source)}{at ? ` · ${at}` : ""}</dd>
    </div>
  );
}

export function sourceLabel(source: string | null): string {
  if (source === "CAMERA_DERIVED") return "camera";
  if (source === "SELF_REPORTED") return "manual entry";
  if (source === "EXTERNAL_DEVICE") return "device";
  if (source === "SIMULATED") return "test sample";
  return "no record";
}

function latestValue(metrics: MetricRow[], metricType: string): number | null {
  return metrics.find((metric) => metric.metric_type === metricType && metric.value != null)?.value ?? null;
}

function latestSource(metrics: MetricRow[], metricType: string): string | null {
  return metrics.find((metric) => metric.metric_type === metricType)?.source_type ?? null;
}

function latestTime(metrics: MetricRow[], metricType: string): string | null {
  return metrics.find((metric) => metric.metric_type === metricType)?.measured_at_utc ?? null;
}

function cameraQuality(metric: MetricRow | undefined): string {
  if (!metric) return "no measurement yet";
  if (metric.validity_status === "VALID") return "sufficient for a saved estimate. This is not a diagnosis.";
  if (metric.validity_status === "INCONCLUSIVE") return "insufficient. The number is not saved as reliable.";
  return "unusable. The number is not a pulse estimate.";
}

function missedToday(today: string, metrics: MetricRow[], journal: JournalRow[]): string[] {
  const missed: string[] = [];
  const hasMetric = (metricType: string, source?: string) => metrics.some((metric) => metric.metric_type === metricType && metric.measured_at_utc.startsWith(today) && metric.value != null && (!source || metric.source_type === source));
  const hasJournal = (entryType: string) => journal.some((entry) => entry.entry_type === entryType && entry.recorded_at_utc.startsWith(today));
  if (!hasMetric("PULSE_RATE", "CAMERA_DERIVED")) missed.push("Camera pulse");
  if (!hasMetric("BLOOD_PRESSURE_SYSTOLIC")) missed.push("Blood pressure");
  if (!hasMetric("BODY_TEMPERATURE")) missed.push("Temperature");
  if (!hasJournal("SLEEP")) missed.push("Sleep");
  if (!hasJournal("MOOD")) missed.push("Mood");
  return missed;
}

function transferLabel(sync: SyncStatus | null): { label: string; tone: string } {
  const errors = sync?.error_count ?? 0;
  const waiting = sync?.waiting_count ?? sync?.local_only_count ?? 0;
  const sent = sync?.sent_count ?? 0;
  if (errors > 0) return { label: "Send error", tone: "status bad" };
  if (waiting > 0) return { label: "Waiting to send", tone: "status due" };
  if (sent > 0) return { label: "Sent", tone: "status done" };
  return { label: "Waiting to send", tone: "status due" };
}

export function CrewField({ label, hint, error, children }: { label: string; hint: string; error?: string; children: ReactNode }) {
  return (
    <label className={error ? "invalid" : undefined}>
      {label}
      {children}
      <span className={error ? "field-hint bad" : "field-hint"}>{error ?? hint}</span>
    </label>
  );
}

type CheckPhase = "idle" | "recording" | "saving" | "saved" | "discarded";

export function HealthCheckPage({ astronautId, displayName, launchReason, onSettled }: {
  astronautId: string;
  displayName: string;
  launchReason?: CheckReason;
  onSettled?: (phase: CheckPhase, result: WorkerEvent) => void;
}) {
  const [cameras, setCameras] = useState<Array<{ device_index: number; label: string }>>([]);
  const [deviceIndex, setDeviceIndex] = useState(0);
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("Open the camera. The check runs for this profile.");
  const [canStart, setCanStart] = useState(false);
  const [captureText, setCaptureText] = useState("Camera is not open.");
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(30);
  const [result, setResult] = useState<WorkerEvent | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [databasePath, setDatabasePath] = useState("");
  const [phase, setPhase] = useState<CheckPhase>("idle");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<CheckReason | "">(launchReason ?? "");
  const sessionAstronaut = useRef("");
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;

  useEffect(() => {
    if (!desktopAvailable()) return;
    sessionAstronaut.current = astronautId;
    void api.info().then((info) => setDatabasePath(info.database_path)).catch((reason: unknown) => setError(String(reason)));
    let unlisten: (() => void) | undefined;
    void listen<WorkerEvent>("worker-event", (event) => {
      const payload = event.payload;
      if (payload.event === "preview") {
        if (payload.jpeg_base64) setPreview(`data:image/jpeg;base64,${payload.jpeg_base64}`);
        const raw = payload.readiness?.message ?? "Camera is open.";
        setMessage(raw);
        setCanStart(Boolean(payload.readiness?.can_start));
        setCaptureText(describeCapture(payload));
      }
      if (payload.event === "progress") {
        setElapsed(Number(payload.elapsed_seconds ?? 0));
        setDuration(Number(payload.duration_seconds ?? 30));
        setPhase("recording");
        setResult(null);
        setSaved("");
      }
      if (payload.event === "result") {
        setResult(payload);
        setCanStart(false);
        const validity = payload.validity_status;
        const status = payload.status;
        const person = sessionAstronaut.current;
        const keep = (validity === "VALID" || validity === "INCONCLUSIVE") && status !== "ABORTED" && status !== "DEVICE_ERROR";
        if (keep && person) {
          setPhase("saving");
          void api.saveResult(person).then(async (id) => {
            const info = await api.info();
            setDatabasePath(info.database_path);
            setSaved(id);
            setPhase("saved");
            settledRef.current?.("saved", payload);
          }).catch((reason: unknown) => {
            setPhase("idle");
            setError(reason instanceof Error ? reason.message : String(reason));
          });
        } else {
          setPhase("discarded");
          setSaved("");
          settledRef.current?.("discarded", payload);
        }
      }
    }).then((stop) => {
      unlisten = stop;
    });
    return () => {
      unlisten?.();
      if (desktopAvailable()) void api.closeCamera().catch(() => undefined);
    };
  }, [astronautId]);

  const showNumber = result?.validity_status === "VALID" && typeof result.value_bpm === "number";
  const remaining = Math.max(0, duration - elapsed);
  const fill = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;
  const recording = phase === "recording" || phase === "saving";

  return (
    <section>
      <p>
        This is a 30-second pulse check for {displayName}. The camera estimates pulse from small changes in skin colour and
        does not read mood. It is not a diagnosis. No video is written to a file. Only the result reaches the database,
        and it stays on this computer.
      </p>
      <ol className="steps">
        <li className={stepClass(1, preview, phase)}>The personal profile is open. The check runs for this astronaut only.</li>
        <li className={stepClass(2, preview, phase)}>Open the camera. The picture stays on screen and is not saved to the database.</li>
        <li className={stepClass(3, preview, phase)}>Start a scheduled check or a check on how you feel. The signal collects in memory for 30 seconds.</li>
        <li className={stepClass(4, preview, phase)}>When time is up, the result is saved to the local database on its own. A pulse number appears only if the quality checks pass.</li>
      </ol>
      <p className="mono">Database file on this computer: {databasePath || "open Health Engine to see the path"}</p>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <p className="profile-lock">Profile: {displayName}</p>
        <label>Camera
          <select value={deviceIndex} onChange={(event) => setDeviceIndex(Number(event.target.value))}>
            {cameras.length === 0 && <option value={0}>List is empty</option>}
            {cameras.map((camera) => (
              <option key={camera.device_index} value={camera.device_index}>{camera.label}</option>
            ))}
          </select>
        </label>
        <button type="button" disabled={busy || recording} onClick={() => void run(async () => setCameras((await api.cameras()).cameras))}>Find cameras</button>
        <button type="button" disabled={busy || recording} onClick={() => void run(async () => { await api.openCamera(deviceIndex); setSaved(""); setResult(null); setPhase("idle"); })}>Open camera</button>
        {launchReason ? (
          <button type="button" disabled={busy || recording || !canStart || !astronautId} onClick={() => void begin(launchReason)}>
            Start pulse measurement
          </button>
        ) : (
          <>
            <button type="button" disabled={busy || recording || !canStart || !astronautId} onClick={() => void begin("schedule")}>Scheduled check</button>
            <button type="button" disabled={busy || recording || !canStart || !astronautId} onClick={() => void begin("feel")}>Check on how you feel</button>
          </>
        )}
        <button type="button" disabled={busy || phase !== "recording"} onClick={() => void run(() => api.stopMeasurement())}>Stop</button>
      </div>
      <p>{message}</p>
      <p className="mono">{captureText}</p>
      {phase === "recording" && (
        <div className="meter-block">
          <p className="mono">Check in progress: {reason ? reasonLabel(reason) : "check"}. {remaining.toFixed(0)} s left. This attempt is not in the database yet. The camera does not read mood.</p>
          <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={elapsed}>
            <span style={{ width: `${fill}%` }} />
          </div>
        </div>
      )}
      {phase === "saving" && <p className="mono">Saving the result to the database…</p>}
      <div className={phase === "recording" ? "preview-frame live" : "preview-frame"}>
        {preview ? <img className="preview" alt="Camera preview with forehead and cheek zones" src={preview} /> : <div className="preview" />}
      </div>
      {result && (
        <section className="panel">
          <h2>Result</h2>
          {showNumber ? <p className="pulse">{result.value_bpm}<span style={{ fontSize: "1rem" }}> bpm</span></p> : <p className="pulse">—</p>}
          <p>{qualityText(result)}</p>
          <p>{outcomeText(phase, result)}</p>
          <p className="muted">{result.diagnostic_summary}</p>
          <ul>{(result.rejection_reasons ?? []).map((reason) => <li key={reason}>{reason}</li>)}</ul>
          <p className="muted">Status {result.validity_status ?? "unknown"}. The quality checks are experimental and are not a probability.</p>
          {phase === "saved" && saved && <p>Record {saved} saved. File: {databasePath}</p>}
          {phase === "discarded" && <p>This attempt is not in the database. Stops and camera failures are not saved.</p>}
          {phase !== "recording" && phase !== "saving" && (
            <button type="button" onClick={() => { setPhase("idle"); setResult(null); setSaved(""); }}>Repeat measurement</button>
          )}
          {phase === "idle" && (result.validity_status === "VALID" || result.validity_status === "INCONCLUSIVE") && sessionAstronaut.current && (
            <button type="button" onClick={() => void run(async () => {
              setPhase("saving");
              try {
                const id = await api.saveResult(sessionAstronaut.current);
                setSaved(id);
                setPhase("saved");
              } catch (reason) {
                setPhase("idle");
                throw reason;
              }
            })}>Retry saving to the database</button>
          )}
          <details>
            <summary>Technical diagnostics</summary>
            <pre className="mono">{JSON.stringify(result.quality_components ?? {}, null, 2)}</pre>
          </details>
        </section>
      )}
      {result && result.validity_status === "VALID" && typeof result.value_bpm === "number" && (
        <section className="panel">
          <h2>Pulse waveform</h2>
          <PulseWave bpm={result.value_bpm} />
        </section>
      )}
    </section>
  );

  async function begin(nextReason: "schedule" | "feel") {
    await run(async () => {
      sessionAstronaut.current = astronautId;
      setReason(nextReason);
      setPhase("recording");
      setElapsed(0);
      setDuration(30);
      setResult(null);
      setSaved("");
      try {
        await api.startMeasurement(astronautId);
      } catch (cause) {
        setPhase("idle");
        setReason("");
        throw cause;
      }
    });
  }

  async function run(action: () => Promise<unknown>) {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }
}

function stepClass(step: number, preview: string, phase: CheckPhase): string {
  const current = !preview ? 2 : phase === "recording" ? 3 : phase === "saving" || phase === "saved" || phase === "discarded" ? 4 : 3;
  if (step < current) return "done";
  if (step === current) return "current";
  return "";
}

function qualityText(result: WorkerEvent): string {
  if (result.validity_status === "VALID") return "Signal quality is sufficient and the estimate was saved. This is not a diagnosis and not a medical threshold.";
  if (result.validity_status === "INCONCLUSIVE") return "Signal quality is insufficient. The number is not saved as reliable. Repeat the measurement.";
  return "There is no reliable estimate. Repeat the measurement.";
}

function outcomeText(phase: CheckPhase, result: WorkerEvent): string {
  if (phase === "saving") return "The check has finished. Saving the result to the database.";
  if (phase === "idle" && (result.validity_status === "VALID" || result.validity_status === "INCONCLUSIVE")) {
    return "The result is in, but it is not saved to the database yet. You can retry saving.";
  }
  if (phase === "discarded") return "No reliable record was created.";
  if (result.validity_status === "VALID") return "The pulse estimate was received and saved. This is not a diagnosis.";
  if (result.validity_status === "INCONCLUSIVE") return "No pulse number is shown: signal quality was not enough. The attempt itself is saved as insufficient data.";
  return "There is no reliable estimate.";
}

function describeCapture(payload: WorkerEvent): string {
  const capture = payload.capture;
  if (!capture) return "The camera mode has not been reported yet.";
  const measured = capture.measured_fps != null ? `stream now ${capture.measured_fps} fps` : "stream still being measured";
  const format = capture.yuy2_requested
    ? `YUY2 requested, camera gave ${capture.pixel_format ?? "unknown format"}`
    : `camera gave ${capture.pixel_format ?? "unknown format"}`;
  return `${capture.backend ?? "camera"} · ${capture.width ?? "?"}×${capture.height ?? "?"} · advertised ${capture.nominal_fps ?? "?"} fps · ${measured} · ${format}`;
}

export function DetailPage({ astronautId, displayName }: { astronautId: string; displayName: string }) {
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [journal, setJournal] = useState<JournalRow[]>([]);
  const [period, setPeriod] = useState<"7" | "30" | "all">("30");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!desktopAvailable() || !astronautId) return;
    void Promise.all([api.metrics(astronautId), api.journal(astronautId)]).then(([nextMetrics, nextJournal]) => {
      setMetrics(nextMetrics);
      setJournal(nextJournal);
    }).catch((reason: unknown) => setError(String(reason)));
  }, [astronautId]);

  const cutoff = periodCutoff(period);
  const inPeriod = (at: string) => !cutoff || at >= cutoff;
  const visibleMetrics = metrics.filter((metric) => inPeriod(metric.measured_at_utc));
  const visibleJournal = journal.filter((entry) => inPeriod(entry.recorded_at_utc));
  const pulse = visibleMetrics.filter((metric) => metric.metric_type === "PULSE_RATE" && metric.source_type === "CAMERA_DERIVED" && metric.validity_status === "VALID" && metric.value != null);
  const cameraRows = visibleMetrics.filter((metric) => metric.metric_type === "PULSE_RATE" && metric.source_type === "CAMERA_DERIVED");
  const pressure = visibleMetrics.filter((metric) => metric.metric_type === "BLOOD_PRESSURE_SYSTOLIC" && metric.value != null && metric.validity_status === "VALID");
  const temperatures = visibleMetrics.filter((metric) => metric.metric_type === "BODY_TEMPERATURE" && metric.value != null && metric.validity_status === "VALID");
  const manualRows = visibleMetrics.filter((metric) => metric.source_type === "SELF_REPORTED" || metric.source_type === "EXTERNAL_DEVICE");
  const journalDays = dayCompleteness(visibleJournal);
  const logRows = [
    ...visibleJournal.map((entry) => ({
      id: entry.entry_id,
      at: entry.recorded_at_utc,
      kind: entry.entry_type,
      value: `${entry.value} ${entry.unit_or_scale ?? ""}`.trim(),
      source: entry.source_type,
      tone: journalDays.get(entry.recorded_at_utc.slice(0, 10)) ?? "mid" as RecordTone,
    })),
    ...manualRows.map((metric) => ({
      id: metric.metric_id,
      at: metric.measured_at_utc,
      kind: metric.metric_type,
      value: `${metric.value ?? "—"} ${metric.unit}`,
      source: metric.source_type,
      tone: (metric.validity_status === "VALID" ? "good" : "bad") as RecordTone,
    })),
  ].sort((left, right) => right.at.localeCompare(left.at));

  return (
    <section className="detail-page">
      {error && <p className="error">{error}</p>}
      <section className="panel">
        <h2>History and charts</h2>
        <p className="profile-lock">Profile: {displayName}</p>
        <p className="muted">Lines use saved numbers only. A missing day is not drawn as a value. Manual entry, camera, and device differ by source. This is not a diagnosis.</p>
        <div className="period">
          <button type="button" className={period === "7" ? "active" : undefined} onClick={() => setPeriod("7")}>7 days</button>
          <button type="button" className={period === "30" ? "active" : undefined} onClick={() => setPeriod("30")}>30 days</button>
          <button type="button" className={period === "all" ? "active" : undefined} onClick={() => setPeriod("all")}>All time</button>
        </div>
      </section>
      <section className="panel detail-block">
        <h2>Camera pulse</h2>
        {pulse.length === 0 ? <p>No reliable pulse values in the selected period. Insufficient signal never reaches the chart.</p> : <SeriesChart points={pulse} label="Measurement trend" stroke="#7dcea0" unit="bpm" />}
        {pressure.length > 0 && <SeriesChart points={pressure} label="Measurement trend" stroke="#3ec6ff" unit="mmHg" />}
        {temperatures.length > 0 && <SeriesChart points={temperatures} label="Measurement trend" stroke="#e6c84a" unit="°C" />}
        <table>
          <thead><tr><th>Time (UTC)</th><th>Value</th><th>Quality</th><th>Source</th></tr></thead>
          <tbody>
            {cameraRows.map((metric) => {
              const tone = cameraTone(metric);
              return (
                <tr className={`tone-row ${tone}`} key={metric.metric_id}>
                  <td><DateMark icon="camera" tone={tone} text={metric.measured_at_utc} /></td>
                  <td className="mono">{metric.value ?? "—"} {metric.unit}</td>
                  <td>{metric.validity_status}</td>
                  <td>{sourceLabel(metric.source_type)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted">A green row is a usable record. Amber is an attempt without a number. Red is a record that cannot be used. This is not a diagnosis.</p>
      </section>
      <section className="panel detail-block">
        <h2>Sleep, mood, symptoms, blood pressure, and temperature</h2>
        <table>
          <thead><tr><th>Time (UTC)</th><th>Entry</th><th>Value</th><th>Source</th></tr></thead>
          <tbody>
            {logRows.map((row) => (
              <tr className={`tone-row ${row.tone}`} key={row.id}>
                <td><DateMark icon="journal" tone={row.tone} text={row.at} /></td>
                <td>{row.kind}</td>
                <td>{row.value}</td>
                <td>{sourceLabel(row.source)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">A green journal day has both sleep and mood. Amber is filled in partly. Red is a manual value that cannot be used. This is not a diagnosis.</p>
      </section>
    </section>
  );
}

function periodCutoff(period: "7" | "30" | "all"): string | null {
  if (period === "all") return null;
  const days = period === "7" ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export type DetailField = "sleep" | "mood" | "systolic" | "diastolic" | "temperature" | "form";
type RecordTone = "good" | "mid" | "bad";

export const DETAIL_HINTS: Record<DetailField, string> = {
  sleep: "Hours from 0 to 24, for example 7.5. Leave it empty if you are not recording sleep.",
  mood: "A whole number from 1 to 5. Leave it empty if you are not recording mood.",
  systolic: "40–300 and above the diastolic value. Enter both blood pressure numbers or neither.",
  diastolic: "20–200 and below the systolic value.",
  temperature: "20–50 °C, or leave it empty.",
  form: "Select at least one item.",
};

export function validateDetail(sleep: string, mood: string, systolic: string, diastolic: string, temperature: string, hasSymptom: boolean): Partial<Record<DetailField, string>> {
  const errors: Partial<Record<DetailField, string>> = {};
  if (sleep.trim()) {
    const hours = Number(sleep);
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) errors.sleep = DETAIL_HINTS.sleep;
  }
  if (mood.trim()) {
    const score = Number(mood);
    if (!Number.isInteger(score) || score < 1 || score > 5) errors.mood = DETAIL_HINTS.mood;
  }
  if (systolic.trim() || diastolic.trim()) {
    const sys = Number(systolic);
    const dia = Number(diastolic);
    if (!systolic.trim() || !diastolic.trim() || !(sys >= 40 && sys <= 300) || !(dia >= 20 && dia <= 200) || sys <= dia) {
      errors.systolic = DETAIL_HINTS.systolic;
      errors.diastolic = DETAIL_HINTS.diastolic;
    }
  }
  if (temperature.trim()) {
    const temp = Number(temperature);
    if (!Number.isFinite(temp) || temp < 20 || temp > 50) errors.temperature = DETAIL_HINTS.temperature;
  }
  if (!sleep.trim() && !mood.trim() && !systolic.trim() && !diastolic.trim() && !temperature.trim() && !hasSymptom) {
    errors.form = DETAIL_HINTS.form;
  }
  return errors;
}

function cameraTone(metric: MetricRow): RecordTone {
  if (metric.validity_status === "VALID" && metric.value != null) return "good";
  if (metric.validity_status === "INCONCLUSIVE") return "mid";
  return "bad";
}

function dayCompleteness(journal: JournalRow[]): Map<string, RecordTone> {
  const byDay = new Map<string, Set<string>>();
  for (const entry of journal) {
    const day = entry.recorded_at_utc.slice(0, 10);
    const kinds = byDay.get(day) ?? new Set<string>();
    kinds.add(entry.entry_type);
    byDay.set(day, kinds);
  }
  const tones = new Map<string, RecordTone>();
  for (const [day, kinds] of byDay) {
    tones.set(day, kinds.has("SLEEP") && kinds.has("MOOD") ? "good" : "mid");
  }
  return tones;
}

function DateMark({ icon, tone, text }: { icon: "camera" | "journal"; tone: RecordTone; text: string }) {
  return (
    <span className={`date-mark ${tone}`}>
      {icon === "camera" ? <CameraIcon /> : <JournalIcon />}
      <span className="mono">{text}</span>
    </span>
  );
}

function CameraIcon() {
  return (
    <svg className="row-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M4 7h3l2-2h6l2 2h3v12H4V7zm8 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    </svg>
  );
}

function JournalIcon() {
  return (
    <svg className="row-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M6 3h11a2 2 0 0 1 2 2v16H8a3 3 0 0 0-3 3V4a1 1 0 0 1 1-1zm2 5h7v2H8V8zm0 4h7v2H8v-2z" />
    </svg>
  );
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const CHART_PAD = { left: 58, right: 20, top: 18, bottom: 48 };

type ChartSample = { value: number; atUtc: number | null };

function parseUtcMs(text: string): number | null {
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function utcDayKey(atUtc: number): string {
  return new Date(atUtc).toISOString().slice(0, 10);
}

function formatUtcTick(atUtc: number, withDate: boolean): string {
  const date = new Date(atUtc);
  const pad = (part: number) => String(part).padStart(2, "0");
  const time = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
  return withDate ? `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)} ${time}` : time;
}

function formatAxisValue(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 100 || Number.isInteger(value)) return String(Math.round(value));
  return value.toFixed(1);
}

// Deterministic PRNG (mulberry32) so the demo wave never changes between renders.
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const PULSE_WAVE_WIDTH = 640;
const PULSE_WAVE_HEIGHT = 160;
const PULSE_WAVE_PAD = 12;
const PULSE_WAVE_SECONDS = 3;
const PULSE_WAVE_SAMPLES = 260;

export function buildPulseWave(bpm: number, seconds = PULSE_WAVE_SECONDS, count = PULSE_WAVE_SAMPLES): number[] {
  if (count < 2) return [];
  const rate = Number.isFinite(bpm) && bpm > 0 ? bpm : 70;
  const beatsPerSecond = rate / 60;
  const random = seededRandom(Math.round(rate * 100) + 0x5f3759df);
  const raw: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const at = (index / (count - 1)) * seconds;
    const phase = 2 * Math.PI * beatsPerSecond * at;
    // Three harmonics give the asymmetric systolic peak and the dicrotic notch of a PPG.
    const fundamental = Math.sin(phase);
    const second = 0.45 * Math.sin(2 * phase + 0.85);
    const third = 0.2 * Math.sin(3 * phase + 1.85);
    const noise = (random() + random() - 1) * 0.035;
    raw.push(fundamental + second + third + noise);
  }
  const min = Math.min(...raw);
  const max = Math.max(...raw);
  const span = max - min;
  if (!(span > 1e-9)) return raw.map(() => 0.5);
  // Invert so the systolic peak points up, then mirror in time: steep upstroke first,
  // slower decay with the dicrotic notch after it, as in a photoplethysmogram.
  return raw.map((value) => 1 - (value - min) / span).reverse();
}

export function PulseWave({ bpm = 70 }: { bpm?: number }) {
  const samples = useMemo(() => buildPulseWave(bpm), [bpm]);
  const rate = Number.isFinite(bpm) && bpm > 0 ? bpm : 70;
  const path = samples.map((value, index) => {
    const x = (index / (samples.length - 1)) * PULSE_WAVE_WIDTH;
    const y = PULSE_WAVE_PAD + (1 - value) * (PULSE_WAVE_HEIGHT - PULSE_WAVE_PAD * 2);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return (
    <figure className="pulse-wave">
      <svg
        className="pulse-wave-canvas"
        viewBox={`0 0 ${PULSE_WAVE_WIDTH} ${PULSE_WAVE_HEIGHT}`}
        role="img"
        aria-label={`Schematic pulse waveform for ${Math.round(rate)} bpm`}
      >
        <desc>Demo curve built from three harmonics. Not a measurement.</desc>
        <g className="pulse-wave-grid" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((step) => (
            <line key={`vertical-${step}`} x1={step * 64} y1={0} x2={step * 64} y2={PULSE_WAVE_HEIGHT} />
          ))}
          {[0, 1, 2, 3, 4, 5].map((step) => (
            <line key={`horizontal-${step}`} x1={0} y1={step * 32} x2={PULSE_WAVE_WIDTH} y2={step * 32} />
          ))}
        </g>
        <path d={path} fill="none" stroke="#6FD3A6" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption>Schematic signal (demo). Not a measurement, but an illustration of the waveform shape.</figcaption>
    </figure>
  );
}

export function SeriesChart({ points, label, stroke, unit }: { points: MetricRow[]; label: string; stroke: string; unit: string }) {
  const gradientId = `chart-fill-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const samples: ChartSample[] = points.flatMap((point) => (
    typeof point.value === "number" && Number.isFinite(point.value)
      ? [{ value: point.value, atUtc: parseUtcMs(point.measured_at_utc) }]
      : []
  ));

  if (samples.length < 3) {
    return <p className="chart-empty">Not enough data for a chart: at least 3 readings are needed.</p>;
  }

  const ordered = [...samples];
  const timeKnown = ordered.every((sample) => sample.atUtc != null);
  if (timeKnown) {
    ordered.sort((left, right) => (left.atUtc as number) - (right.atUtc as number));
  } else {
    ordered.reverse();
  }
  const positions = timeKnown
    ? ordered.map((sample) => sample.atUtc as number)
    : ordered.map((_, index) => index);

  const plotWidth = CHART_WIDTH - CHART_PAD.left - CHART_PAD.right;
  const plotHeight = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;
  const plotRight = CHART_PAD.left + plotWidth;
  const plotBottom = CHART_PAD.top + plotHeight;
  const timeSpan = positions[positions.length - 1] - positions[0];
  const xFor = (position: number) => timeSpan > 0
    ? CHART_PAD.left + ((position - positions[0]) / timeSpan) * plotWidth
    : CHART_PAD.left + plotWidth / 2;

  const values = ordered.map((sample) => sample.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const flat = maxValue - minValue < 1e-9;
  const valuePad = flat ? 0 : Math.max((maxValue - minValue) * 0.18, 0.5);
  const lowValue = minValue - valuePad;
  const highValue = maxValue + valuePad;
  const valueSpan = highValue - lowValue;
  const yFor = (value: number) => flat
    ? CHART_PAD.top + plotHeight / 2
    : plotBottom - ((value - lowValue) / valueSpan) * plotHeight;

  const yTicks = flat
    ? [{ value: minValue, y: CHART_PAD.top + plotHeight / 2 }]
    : [maxValue, (maxValue + minValue) / 2, minValue].map((value) => ({ value, y: yFor(value) }));

  const sameUtcDay = timeKnown && utcDayKey(positions[0]) === utcDayKey(positions[positions.length - 1]);
  const xTicks: Array<{ x: number; anchor: "start" | "middle" | "end"; label: string }> = [];
  if (timeKnown) {
    const seenX = new Set<number>();
    if (timeSpan > 0) {
      const indexes = [0, Math.floor((ordered.length - 1) / 2), ordered.length - 1];
      const anchors = ["start", "middle", "end"] as const;
      indexes.forEach((index, tickIndex) => {
        const x = xFor(positions[index]);
        if (seenX.has(x)) return;
        seenX.add(x);
        xTicks.push({ x, anchor: anchors[tickIndex], label: formatUtcTick(positions[index], !sameUtcDay) });
      });
    } else {
      xTicks.push({
        x: xFor(positions[0]),
        anchor: "middle",
        label: formatUtcTick(positions[0], true),
      });
    }
  }

  const linePath = ordered.map((sample, index) => (
    `${index === 0 ? "M" : "L"}${xFor(positions[index]).toFixed(2)},${yFor(sample.value).toFixed(2)}`
  )).join(" ");
  const firstX = xFor(positions[0]).toFixed(2);
  const lastX = xFor(positions[positions.length - 1]).toFixed(2);
  const areaPath = `${linePath} L${lastX},${plotBottom} L${firstX},${plotBottom} Z`;

  return (
    <figure className="chart-figure">
      <svg
        className="chart"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={`${label}. Units: ${unit}.`}
      >
        <desc>{`${label}: ${ordered.length} points, values from ${formatAxisValue(minValue)} to ${formatAxisValue(maxValue)} ${unit}.`}</desc>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.26" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="chart-grid" aria-hidden="true">
          {[0, 1, 2, 3].map((step) => {
            const x = CHART_PAD.left + (plotWidth / 3) * step;
            return <line key={`vertical-${step}`} x1={x} y1={CHART_PAD.top} x2={x} y2={plotBottom} />;
          })}
          {yTicks.map((tick) => (
            <line key={`horizontal-${tick.value}`} x1={CHART_PAD.left} y1={tick.y} x2={plotRight} y2={tick.y} />
          ))}
        </g>
        {!flat && <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />}
        <path d={linePath} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {ordered.map((sample, index) => (
          <circle
            key={`${sample.atUtc ?? index}-${index}`}
            cx={xFor(positions[index])}
            cy={yFor(sample.value)}
            r={3.2}
            fill="#070b10"
            stroke={stroke}
            strokeWidth={1.8}
          />
        ))}
        <path
          className="chart-axis"
          d={`M${CHART_PAD.left},${CHART_PAD.top} L${CHART_PAD.left},${plotBottom} L${plotRight},${plotBottom}`}
          fill="none"
        />
        {yTicks.map((tick) => (
          <text key={`y-label-${tick.value}-${tick.y}`} x={CHART_PAD.left - 8} y={tick.y + 4} textAnchor="end">
            {formatAxisValue(tick.value)}
          </text>
        ))}
        {xTicks.map((tick) => (
          <text key={`x-label-${tick.x}`} x={tick.x} y={plotBottom + 20} textAnchor={tick.anchor}>
            {tick.label}
          </text>
        ))}
        <text
          className="chart-axis-title"
          transform={`translate(16 ${CHART_PAD.top + plotHeight / 2}) rotate(-90)`}
          textAnchor="middle"
        >
          {unit}
        </text>
        <text className="chart-axis-title" x={CHART_PAD.left + plotWidth / 2} y={CHART_HEIGHT - 8} textAnchor="middle">
          time (UTC)
        </text>
      </svg>
      <figcaption className="chart-caption">{label}</figcaption>
    </figure>
  );
}

export function TasksPage({ astronautId }: { astronautId: string }) {
  const [tasks, setTasks] = useState<TaskView[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!desktopAvailable()) return;
    void api.tasks().then((rows) => setTasks(rows.filter((task) => task.astronaut_id === astronautId))).catch((reason: unknown) => setError(String(reason)));
  }, [astronautId]);
  return (
    <section>
      <p className="muted">Completion means this profile's check was saved, including an inconclusive attempt. It does not reward a particular pulse number.</p>
      {error && <p className="error">{error}</p>}
      <table>
        <thead><tr><th>Task</th><th>Due (UTC)</th><th>State</th></tr></thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.task_id}>
              <td>Face health check</td>
              <td className="mono">{task.due_at_utc}</td>
              <td><span className={taskClass(task.display_status)}>{task.display_status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {tasks.length === 0 && <p>No check is scheduled for this profile yet.</p>}
    </section>
  );
}

function taskClass(status: string): string {
  if (status === "COMPLETED") return "status done";
  if (status === "OVERDUE") return "status bad";
  return "status due";
}

export function WikiPage() {
  return (
    <section>
      <article className="panel">
        <h2>NASA Human Research Program context</h2>
        <p>The five hazards below come from the NASA Human Research Program. The app does not measure them. It keeps the crew member's own observations next to them, so a change is visible early.</p>
        <table>
          <thead><tr><th>Hazard</th><th>What this app does about it</th></tr></thead>
          <tbody>
            <tr><td>Isolation and confinement</td><td>Daily mood, sleep and symptom entries with a per-profile history.</td></tr>
            <tr><td>Distance from Earth</td><td>Every record stays on this computer, so a check works with no link to the ground.</td></tr>
            <tr><td>Altered gravity</td><td>Blood pressure and temperature are typed by the crew; the camera adds a pulse estimate.</td></tr>
            <tr><td>Closed environment</td><td>One local profile per crew member, no account, no upload.</td></tr>
            <tr><td>Radiation</td><td>Not modelled. The app does not measure dose and does not estimate radiation risk.</td></tr>
          </tbody>
        </table>
        <p className="muted">Sources: 5 Hazards of Human Spaceflight (https://www.nasa.gov/hrp/hazards/), Risks of Human Spaceflight (https://www.nasa.gov/hrp/risks/), Ongoing HRP Research in Space (https://www.nasa.gov/hrp/ongoing-hrp-research/). NASA does not endorse this project.</p>
      </article>
      <article className="panel">
        <h2>What a face check does</h2>
        <p>The camera watches the forehead and cheeks. Each heartbeat changes skin color by a very small amount. The program looks for that rhythm. It does not recognize the person, and it does not keep the picture.</p>
      </article>
      <article className="panel">
        <h2>What the camera cannot do</h2>
        <p>It does not measure blood pressure, temperature, oxygen, mood, or a medical diagnosis. A finger on the lens is not part of this check. Mood, sleep, and symptoms are entered by the astronaut.</p>
      </article>
      <article className="panel">
        <h2>Why a result can be missing</h2>
        <p>Movement, poor light, more than one face, a short recording, or a weak color signal means the program shows no pulse number. That is a failed measurement, not a statement about health.</p>
      </article>
      <article className="panel">
        <h2>Personal profile</h2>
        <p>The opening screen checks a test password and then keeps it only in this window. The password is not written to the database, a file, or an account store. Each launch can type a different login, and that login replaces the profile name. Health records stay on this profile. This is not a NASA account.</p>
      </article>
      <article className="panel">
        <h2>Labels</h2>
        <p>INSUFFICIENT DATA means there is no valid camera pulse yet. CHECK RECORDED means a valid estimate was saved. Neither label is a fitness-for-duty decision. Self-reported journal values are marked separately from camera values.</p>
      </article>
      <article className="panel">
        <h2>Reminders, alerts, and synchronization</h2>
        <p>While the program is open it creates one face-check task for this profile per UTC day. The check can also be started from how the astronaut feels. Saving an attempt completes that day's task. Warnings follow configured rules and do not diagnose. Records stay on this computer until a ground channel is configured. This version has no ground link, so nothing is marked synchronized.</p>
      </article>
    </section>
  );
}

export function SettingsPage({ session, storage, onChanged }: { session: PersonSession; storage: StorageStatus | null; onChanged: () => Promise<void> }) {
  const [info, setInfo] = useState<string>("");
  const [epoch, setEpoch] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [format, setFormat] = useState("JSON");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!desktopAvailable()) return;
    void Promise.all([api.info(), api.config()]).then(([app, config]) => {
      setInfo(`${app.version} · database ${app.database_path}`);
      setEpoch(config.mission_epoch_utc ?? "");
      setStart(config.circadian_start_utc ?? "");
      setEnd(config.circadian_end_utc ?? "");
      setFormat(config.export_format);
    }).catch((reason: unknown) => setError(String(reason)));
  }, []);

  return (
    <section>
      {error && <p className="error">{error}</p>}
      <section className="panel facts" aria-readonly="true" aria-label="Installation data">
        <p className="mono">{info || "Open the desktop application to read the installed version."}</p>
        <p>Data directory: {storage?.data_dir ?? "available in the desktop application"}</p>
        <p>Application data size: {storage ? `${storage.data_bytes} bytes` : "—"}</p>
        <p>Free space: {storage?.free_bytes ?? "unknown"} bytes</p>
      </section>
      <form
        className="row"
        onSubmit={(event) => {
          event.preventDefault();
          void api.setConfig(epoch, start, end, format).then(onChanged).then(() => setMessage("Configuration saved on this computer.")).catch((reason: unknown) => setError(String(reason)));
        }}
      >
        <label>Mission epoch UTC<input value={epoch} placeholder="2026-11-14T00:00:00Z" onChange={(event) => setEpoch(event.target.value)} /></label>
        <label>Day shift start UTC<input value={start} placeholder="06:00" onChange={(event) => setStart(event.target.value)} /></label>
        <label>Day shift end UTC<input value={end} placeholder="21:30" onChange={(event) => setEnd(event.target.value)} /></label>
        <label>Export format
          <select value={format} onChange={(event) => setFormat(event.target.value)}>
            <option>JSON</option>
            <option>TXT</option>
          </select>
        </label>
        <button type="submit">Save configuration</button>
      </form>
      <section className="panel">
        <h2>Not available in this version</h2>
        <ul className="missed">
          <li>No blood pressure and temperature device is selected. Readings are entered by hand.</li>
          <li>No link to the ground doctor is configured. Records stay on this computer.</li>
          <li>Access for the onboard medic is switched off. It opens only with this astronaut's permission, and this version has none.</li>
          <li>There are no agreed medical rules, so the program sets no thresholds and does not call a result a diagnosis.</li>
        </ul>
      </section>
      <aside className="info-callout" role="note">
        <svg className="info-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 10.5v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="7.2" r="1.15" fill="currentColor" />
        </svg>
        <p>PDF export is not available in this version. The daily reminder is once per UTC day. Screening thresholds are not configured, so pulse numbers are not turned into health grades.</p>
      </aside>
      <div className="row">
        <button type="button" onClick={() => void api.backup().then(setMessage).catch((reason: unknown) => setError(String(reason)))}>Create local backup</button>
        <button type="button" onClick={() => void api.snapshot().then(setMessage).catch((reason: unknown) => setError(String(reason)))}>Write this month's snapshot</button>
        <button type="button" onClick={() => void api.exportRecords(session.astronautId).then(setMessage).catch((reason: unknown) => setError(String(reason)))}>Export this profile</button>
      </div>
      {message && <p>{message}</p>}
    </section>
  );
}
