// CREW PAGES FOR CHECKS, RECORDS, TASKS, HELP, AND SETTINGS.
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { api, desktopAvailable } from "./api";
import type { Astronaut, HomeCard, JournalRow, MetricRow, StorageStatus, SyncStatus, TaskView, WorkerEvent } from "./types";

export function HomePage({ sync, onChanged }: { sync: SyncStatus | null; onChanged: () => Promise<void> }) {
  const [cards, setCards] = useState<HomeCard[]>([]);
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("CREW");
  const [error, setError] = useState("");

  async function load() {
    if (!desktopAvailable()) return;
    setCards(await api.home());
  }

  useEffect(() => {
    void load().catch((reason: unknown) => setError(String(reason)));
  }, []);

  return (
    <section>
      <h1>Crew overview</h1>
      <p className="muted">Health checks are recorded when someone completes them. Nothing on this screen is a diagnosis.</p>
      {error && <p className="error">{error}</p>}
      <div className="grid">
        {cards.map((card) => (
          <article className="panel" key={card.astronaut_id}>
            <h2>{card.display_name}</h2>
            <p className="mono">{card.crew_identifier} · {card.role}</p>
            <p><span className={card.workflow_state === "CHECK RECORDED" ? "status done" : "status"}>{card.workflow_state}</span></p>
            <p>Latest valid pulse: {card.latest_valid_pulse_bpm ?? "—"} {card.latest_valid_pulse_bpm != null ? "bpm" : ""}</p>
            <p className="muted">Valid at {card.latest_valid_pulse_at ?? "no valid camera pulse yet"}</p>
            <p>Latest attempt: {card.latest_attempt_validity ?? "none"} at {card.latest_attempt_at ?? "—"}</p>
            <p>Today's check: <span className={taskClass(card.task_display_status)}>{card.task_display_status}</span></p>
          </article>
        ))}
        {cards.length === 0 && <article className="panel">No crew members are configured on this computer.</article>}
      </div>
      <section className="panel" style={{ marginTop: "0.8rem" }}>
        <h2>Ground link</h2>
        <p>{sync?.note ?? "No ground link is configured. Records stay on this computer."}</p>
        <p className="mono">Records stored only here: {sync?.local_only_count ?? "—"}</p>
        <p className="muted">Last acknowledgement: {sync?.last_acknowledged_at ?? "none"}</p>
      </section>
      <form
        className="row"
        style={{ marginTop: "0.8rem" }}
        onSubmit={(event) => {
          event.preventDefault();
          void api.createAstronaut(identifier, name, role).then(() => {
            setIdentifier("");
            setName("");
            return load();
          }).then(onChanged).catch((reason: unknown) => setError(String(reason)));
        }}
      >
        <label>Crew identifier<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} /></label>
        <label>Display name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Role label
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option>CREW</option>
            <option>MEDICAL</option>
            <option>ADMIN</option>
          </select>
        </label>
        <button type="submit">Add crew member</button>
      </form>
      <p className="muted">Role labels are stored for later. This version has no separate logins, so anyone at this computer can open the local records.</p>
    </section>
  );
}

export function HealthCheckPage() {
  const [crew, setCrew] = useState<Astronaut[]>([]);
  const [astronautId, setAstronautId] = useState("");
  const [cameras, setCameras] = useState<Array<{ device_index: number; label: string }>>([]);
  const [deviceIndex, setDeviceIndex] = useState(0);
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("Choose a crew member, then open a camera.");
  const [canStart, setCanStart] = useState(false);
  const [captureText, setCaptureText] = useState("No camera is open.");
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<WorkerEvent | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!desktopAvailable()) return;
    void api.astronauts().then(setCrew).catch((reason: unknown) => setError(String(reason)));
    let unlisten: (() => void) | undefined;
    void listen<WorkerEvent>("worker-event", (event) => {
      const payload = event.payload;
      if (payload.event === "preview") {
        if (payload.jpeg_base64) setPreview(`data:image/jpeg;base64,${payload.jpeg_base64}`);
        setMessage(payload.readiness?.message ?? "Camera is open.");
        setCanStart(Boolean(payload.readiness?.can_start));
        setCaptureText(describeCapture(payload));
      }
      if (payload.event === "progress") {
        setProgress(`${payload.elapsed_seconds ?? 0}s / ${payload.duration_seconds ?? 0}s · usable frames ${payload.status ?? "COLLECTING"}`);
        setResult(null);
      }
      if (payload.event === "result") {
        setResult(payload);
        setProgress("");
        setCanStart(false);
      }
    }).then((stop) => {
      unlisten = stop;
    });
    return () => {
      unlisten?.();
      if (desktopAvailable()) void api.closeCamera().catch(() => undefined);
    };
  }, []);

  const showNumber = result?.validity_status === "VALID" && typeof result.value_bpm === "number";
  const canSave = result?.validity_status === "VALID" || result?.validity_status === "INCONCLUSIVE";

  return (
    <section>
      <h1>Face health check</h1>
      <p>This estimates pulse from small skin-color changes. It is not a diagnosis, and poor light or movement can make it fail.</p>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <label>Crew member
          <select value={astronautId} onChange={(event) => setAstronautId(event.target.value)}>
            <option value="">Select</option>
            {crew.map((person) => (
              <option key={person.astronaut_id} value={person.astronaut_id}>{person.display_name}</option>
            ))}
          </select>
        </label>
        <label>Camera
          <select value={deviceIndex} onChange={(event) => setDeviceIndex(Number(event.target.value))}>
            {cameras.length === 0 && <option value={0}>Not scanned</option>}
            {cameras.map((camera) => (
              <option key={camera.device_index} value={camera.device_index}>{camera.label}</option>
            ))}
          </select>
        </label>
        <button type="button" disabled={busy} onClick={() => void run(async () => setCameras((await api.cameras()).cameras))}>Scan cameras</button>
        <button type="button" disabled={busy} onClick={() => void run(async () => { await api.openCamera(deviceIndex); setSaved(""); setResult(null); })}>Open camera</button>
        <button type="button" disabled={busy || !canStart || !astronautId} onClick={() => void run(() => api.startMeasurement(astronautId))}>Start 15 second check</button>
        <button type="button" disabled={busy} onClick={() => void run(() => api.stopMeasurement())}>Stop</button>
      </div>
      <p>{message}</p>
      <p className="mono">{captureText}</p>
      {progress && <p className="mono">{progress}</p>}
      {preview ? <img className="preview" alt="Camera preview with face guide" src={preview} /> : <div className="preview" />}
      {result && (
        <section className="panel">
          <h2>Result</h2>
          {showNumber ? <p className="pulse">{result.value_bpm}<span style={{ fontSize: "1rem" }}> bpm</span></p> : <p className="pulse">—</p>}
          <p>{showNumber ? "Estimate, not a diagnosis." : "No reliable estimate obtained."}</p>
          <p>{result.diagnostic_summary}</p>
          <ul>{(result.rejection_reasons ?? []).map((reason) => <li key={reason}>{reason}</li>)}</ul>
          <p className="muted">Validity {result.validity_status ?? "unknown"}. Quality checks are experimental and are not a probability.</p>
          {canSave && astronautId && (
            <button type="button" onClick={() => void run(async () => setSaved(await api.saveResult(astronautId)))}>Save this attempt on this computer</button>
          )}
          {saved && <p>Saved record {saved}. It stays on this computer.</p>}
          <details>
            <summary>Technical diagnostics</summary>
            <pre className="mono">{JSON.stringify(result.quality_components ?? {}, null, 2)}</pre>
          </details>
        </section>
      )}
    </section>
  );

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

function describeCapture(payload: WorkerEvent): string {
  const capture = payload.capture;
  if (!capture) return "Capture mode has not been reported.";
  const yuy2 = capture.yuy2_requested
    ? `YUY2 was requested. The camera provided ${capture.pixel_format ?? "an unknown format"}.`
    : `The camera provided ${capture.pixel_format ?? "an unknown format"}.`;
  return `${capture.backend ?? "camera"} · ${capture.width ?? "?"}×${capture.height ?? "?"} · nominal ${capture.nominal_fps ?? "?"} fps · ${yuy2}`;
}

export function DetailPage() {
  const [crew, setCrew] = useState<Astronaut[]>([]);
  const [astronautId, setAstronautId] = useState("");
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [journal, setJournal] = useState<JournalRow[]>([]);
  const [symptoms, setSymptoms] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [sleep, setSleep] = useState("");
  const [mood, setMood] = useState("");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [temperature, setTemperature] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!desktopAvailable()) return;
    void Promise.all([api.astronauts(), api.symptoms()]).then(([people, catalog]) => {
      setCrew(people);
      setSymptoms(catalog);
      if (people[0]) setAstronautId(people[0].astronaut_id);
    }).catch((reason: unknown) => setError(String(reason)));
  }, []);

  useEffect(() => {
    if (!desktopAvailable() || !astronautId) return;
    void Promise.all([api.metrics(astronautId), api.journal(astronautId)]).then(([nextMetrics, nextJournal]) => {
      setMetrics(nextMetrics);
      setJournal(nextJournal);
    }).catch((reason: unknown) => setError(String(reason)));
  }, [astronautId]);

  const pulse = metrics.filter((metric) => metric.metric_type === "PULSE_RATE" && metric.source_type === "CAMERA_DERIVED" && metric.validity_status === "VALID" && metric.value != null);

  return (
    <section>
      <h1>Detail monitoring</h1>
      {error && <p className="error">{error}</p>}
      <label>Crew member
        <select value={astronautId} onChange={(event) => setAstronautId(event.target.value)}>
          {crew.map((person) => <option key={person.astronaut_id} value={person.astronaut_id}>{person.display_name}</option>)}
        </select>
      </label>
      <h2>Valid camera pulse</h2>
      {pulse.length === 0 ? <p>No valid measurements recorded yet.</p> : <PulseChart points={pulse} />}
      <table>
        <thead><tr><th>Time (UTC)</th><th>Type</th><th>Value</th><th>Source</th><th>Validity</th></tr></thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric.metric_id}>
              <td className="mono">{metric.measured_at_utc}</td>
              <td>{metric.metric_type}</td>
              <td className="mono">{metric.value ?? "—"} {metric.unit}</td>
              <td>{metric.source_type}</td>
              <td>{metric.validity_status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Journal and manual entries</h2>
      <p className="muted">Sleep, mood, and symptoms are self-reported. Blood pressure and temperature are typed by the crew. The camera does not measure them.</p>
      <form
        className="row"
        onSubmit={(event) => {
          event.preventDefault();
          void saveJournal().catch((reason: unknown) => setError(String(reason)));
        }}
      >
        <label>Sleep hours<input value={sleep} onChange={(event) => setSleep(event.target.value)} /></label>
        <label>Mood 1–5<input value={mood} onChange={(event) => setMood(event.target.value)} /></label>
        <label>Systolic<input value={systolic} onChange={(event) => setSystolic(event.target.value)} /></label>
        <label>Diastolic<input value={diastolic} onChange={(event) => setDiastolic(event.target.value)} /></label>
        <label>Temperature °C<input value={temperature} onChange={(event) => setTemperature(event.target.value)} /></label>
        <button type="submit">Save entries</button>
      </form>
      <div className="row">
        {symptoms.map((symptom) => (
          <label key={symptom.id}>
            <span><input type="checkbox" checked={selectedSymptoms.includes(symptom.id)} onChange={() => setSelectedSymptoms((current) => current.includes(symptom.id) ? current.filter((id) => id !== symptom.id) : [...current, symptom.id])} /> {symptom.label}</span>
          </label>
        ))}
      </div>
      <table>
        <thead><tr><th>Time (UTC)</th><th>Entry</th><th>Value</th><th>Source</th></tr></thead>
        <tbody>
          {journal.map((entry) => (
            <tr key={entry.entry_id}>
              <td className="mono">{entry.recorded_at_utc}</td>
              <td>{entry.entry_type}</td>
              <td>{entry.value} {entry.unit_or_scale ?? ""}</td>
              <td>{entry.source_type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );

  async function saveJournal() {
    if (!astronautId) throw new Error("Choose a crew member.");
    if (sleep) await api.addJournal(astronautId, "SLEEP", sleep);
    if (mood) await api.addJournal(astronautId, "MOOD", mood);
    for (const symptom of selectedSymptoms) await api.addJournal(astronautId, "SYMPTOM", symptom);
    if (systolic || diastolic || temperature) await api.addManual(astronautId, systolic, diastolic, temperature);
    if (!sleep && !mood && selectedSymptoms.length === 0 && !systolic && !diastolic && !temperature) {
      throw new Error("Enter at least one journal item.");
    }
    setSleep("");
    setMood("");
    setSystolic("");
    setDiastolic("");
    setTemperature("");
    setSelectedSymptoms([]);
    setMetrics(await api.metrics(astronautId));
    setJournal(await api.journal(astronautId));
  }
}

function PulseChart({ points }: { points: MetricRow[] }) {
  const ordered = [...points].reverse();
  const values = ordered.map((point) => point.value ?? 0);
  const min = Math.min(...values) - 5;
  const max = Math.max(...values) + 5;
  const span = Math.max(max - min, 1);
  const step = ordered.length === 1 ? 0 : 100 / (ordered.length - 1);
  const path = ordered.map((point, index) => {
    const x = index * step;
    const y = 100 - (((point.value ?? min) - min) / span) * 100;
    return `${index === 0 ? "M" : "L"}${x},${y}`;
  }).join(" ");
  return (
    <svg className="chart" viewBox="0 0 100 100" role="img" aria-label="Valid camera pulse values">
      <path d={path} fill="none" stroke="#7dcea0" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function TasksPage() {
  const [tasks, setTasks] = useState<TaskView[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!desktopAvailable()) return;
    void api.tasks().then(setTasks).catch((reason: unknown) => setError(String(reason)));
  }, []);
  return (
    <section>
      <h1>Health achieve</h1>
      <p className="muted">Completion means the check was saved, including an inconclusive attempt. It does not reward a particular pulse number.</p>
      {error && <p className="error">{error}</p>}
      <table>
        <thead><tr><th>Crew</th><th>Task</th><th>Due (UTC)</th><th>State</th></tr></thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.task_id}>
              <td>{task.display_name}</td>
              <td>Face health check</td>
              <td className="mono">{task.due_at_utc}</td>
              <td><span className={taskClass(task.display_status)}>{task.display_status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {tasks.length === 0 && <p>No tasks yet. Add a crew member on Home.</p>}
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
      <h1>Health Engine wiki</h1>
      <article className="panel">
        <h2>What a face check does</h2>
        <p>The camera watches the forehead and cheeks. Each heartbeat changes skin color by a very small amount. The program looks for that rhythm. It does not recognize the person, and it does not keep the picture.</p>
      </article>
      <article className="panel">
        <h2>What the camera cannot do</h2>
        <p>It does not measure blood pressure, temperature, oxygen, or a medical diagnosis. A finger on the lens is not part of this check.</p>
      </article>
      <article className="panel">
        <h2>Why a result can be missing</h2>
        <p>Movement, poor light, more than one face, a short recording, or a weak color signal means the program shows no pulse number. That is a failed measurement, not a statement about health.</p>
      </article>
      <article className="panel">
        <h2>Labels</h2>
        <p>INSUFFICIENT DATA means there is no valid camera pulse yet. CHECK RECORDED means a valid estimate was saved. Neither label is a fitness-for-duty decision. Self-reported journal values are marked separately from camera values.</p>
      </article>
      <article className="panel">
        <h2>Reminders, alerts, and synchronization</h2>
        <p>While the program is open it creates one face-check task per crew member per UTC day. Saving an attempt completes that task. A low-disk warning can be acknowledged; the visual warning remains until space is available. Records are not sent anywhere unless a ground link is configured. This version has no ground link, so nothing is marked synchronized.</p>
      </article>
    </section>
  );
}

export function SettingsPage({ storage, onChanged }: { storage: StorageStatus | null; onChanged: () => Promise<void> }) {
  const [info, setInfo] = useState<string>("");
  const [epoch, setEpoch] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [format, setFormat] = useState("JSON");
  const [astronauts, setAstronauts] = useState<Astronaut[]>([]);
  const [astronautId, setAstronautId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!desktopAvailable()) return;
    void Promise.all([api.info(), api.config(), api.astronauts()]).then(([app, config, people]) => {
      setInfo(`${app.version} · database ${app.database_path}`);
      setEpoch(config.mission_epoch_utc ?? "");
      setStart(config.circadian_start_utc ?? "");
      setEnd(config.circadian_end_utc ?? "");
      setFormat(config.export_format);
      setAstronauts(people);
      if (people[0]) setAstronautId(people[0].astronaut_id);
    }).catch((reason: unknown) => setError(String(reason)));
  }, []);

  return (
    <section>
      <h1>Settings</h1>
      {error && <p className="error">{error}</p>}
      <p className="mono">{info || "Open the desktop application to read the installed version."}</p>
      <p>Data directory: {storage?.data_dir ?? "available in the desktop application"}</p>
      <p>Application data size: {storage ? `${storage.data_bytes} bytes` : "—"}</p>
      <p>Free space: {storage?.free_bytes ?? "unknown"} bytes</p>
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
      <p className="muted">PDF export is not available in this version. The daily reminder is once per UTC day. Screening thresholds are not configured, so pulse numbers are not turned into health grades.</p>
      <div className="row">
        <button type="button" onClick={() => void api.backup().then(setMessage).catch((reason: unknown) => setError(String(reason)))}>Create local backup</button>
        <button type="button" onClick={() => void api.snapshot().then(setMessage).catch((reason: unknown) => setError(String(reason)))}>Write this month's snapshot</button>
        <label>Export crew
          <select value={astronautId} onChange={(event) => setAstronautId(event.target.value)}>
            {astronauts.map((person) => <option key={person.astronaut_id} value={person.astronaut_id}>{person.display_name}</option>)}
          </select>
        </label>
        <button type="button" disabled={!astronautId} onClick={() => void api.exportRecords(astronautId).then(setMessage).catch((reason: unknown) => setError(String(reason)))}>Export selected format</button>
      </div>
      {message && <p>{message}</p>}
    </section>
  );
}
