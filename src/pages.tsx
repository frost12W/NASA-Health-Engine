// CREW PAGES FOR CHECKS, RECORDS, TASKS, HELP, AND SETTINGS.
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
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

const READINESS_RU: Record<string, string> = {
  "Face landmarks are unavailable, so a face pulse check cannot start.": "Модель лица недоступна, проверку начать нельзя.",
  "Change the light so the face is neither dark nor washed out.": "Поправьте свет: лицо не должно быть тёмным или засвеченным.",
  "Hold still and look toward the camera.": "Не двигайтесь и смотрите в камеру.",
  "Place one face in the frame.": "В кадре должно быть одно лицо.",
  "Leave only one person in the frame.": "В кадре должен остаться один человек.",
  "The forehead and cheeks are not clear enough.": "Лоб и щёки видны недостаточно ясно.",
  "Hold still. The face check can start.": "Можно начинать. Держите лицо неподвижно.",
};

type CheckPhase = "idle" | "recording" | "saving" | "saved" | "discarded";

export function HealthCheckPage() {
  const [crew, setCrew] = useState<Astronaut[]>([]);
  const [astronautId, setAstronautId] = useState("");
  const [cameras, setCameras] = useState<Array<{ device_index: number; label: string }>>([]);
  const [deviceIndex, setDeviceIndex] = useState(0);
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("Выберите члена экипажа и откройте камеру.");
  const [canStart, setCanStart] = useState(false);
  const [captureText, setCaptureText] = useState("Камера не открыта.");
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(30);
  const [result, setResult] = useState<WorkerEvent | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [databasePath, setDatabasePath] = useState("");
  const [phase, setPhase] = useState<CheckPhase>("idle");
  const [busy, setBusy] = useState(false);
  const sessionAstronaut = useRef("");

  useEffect(() => {
    if (!desktopAvailable()) return;
    void api.astronauts().then(setCrew).catch((reason: unknown) => setError(String(reason)));
    void api.info().then((info) => setDatabasePath(info.database_path)).catch((reason: unknown) => setError(String(reason)));
    let unlisten: (() => void) | undefined;
    void listen<WorkerEvent>("worker-event", (event) => {
      const payload = event.payload;
      if (payload.event === "preview") {
        if (payload.jpeg_base64) setPreview(`data:image/jpeg;base64,${payload.jpeg_base64}`);
        const raw = payload.readiness?.message ?? "Камера открыта.";
        setMessage(READINESS_RU[raw] ?? raw);
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
          }).catch((reason: unknown) => {
            setPhase("idle");
            setError(reason instanceof Error ? reason.message : String(reason));
          });
        } else {
          setPhase("discarded");
          setSaved("");
        }
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
  const remaining = Math.max(0, duration - elapsed);
  const fill = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;
  const recording = phase === "recording" || phase === "saving";

  return (
    <section>
      <h1>Проверка по лицу</h1>
      <p>
        Это 30-секундная диагностика. Камера оценивает пульс по изменению цвета кожи. Это не диагноз.
        Видео в файл не пишется. В базу попадает только итог.
      </p>
      <ol className="steps">
        <li className={stepClass(1, astronautId, preview, phase)}>Выберите члена экипажа.</li>
        <li className={stepClass(2, astronautId, preview, phase)}>Откройте камеру. Картинка остаётся на экране и в базу не сохраняется.</li>
        <li className={stepClass(3, astronautId, preview, phase)}>Нажмите «Начать 30 секунд». Сигнал 30 секунд копится в памяти, на экране идёт отсчёт.</li>
        <li className={stepClass(4, astronautId, preview, phase)}>Когда время вышло, итог сам записывается в локальную базу. Число пульса показывается только если проверки качества пройдены.</li>
      </ol>
      <p className="mono">Файл базы на этом компьютере: {databasePath || "откройте Health Engine, чтобы увидеть путь"}</p>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <label>Член экипажа
          <select value={astronautId} onChange={(event) => setAstronautId(event.target.value)}>
            <option value="">Выберите</option>
            {crew.map((person) => (
              <option key={person.astronaut_id} value={person.astronaut_id}>{person.display_name}</option>
            ))}
          </select>
        </label>
        <label>Камера
          <select value={deviceIndex} onChange={(event) => setDeviceIndex(Number(event.target.value))}>
            {cameras.length === 0 && <option value={0}>Список пуст</option>}
            {cameras.map((camera) => (
              <option key={camera.device_index} value={camera.device_index}>{camera.label}</option>
            ))}
          </select>
        </label>
        <button type="button" disabled={busy || recording} onClick={() => void run(async () => setCameras((await api.cameras()).cameras))}>Найти камеры</button>
        <button type="button" disabled={busy || recording} onClick={() => void run(async () => { await api.openCamera(deviceIndex); setSaved(""); setResult(null); setPhase("idle"); })}>Открыть камеру</button>
        <button
          type="button"
          disabled={busy || recording || !canStart || !astronautId}
          onClick={() => void run(async () => {
            sessionAstronaut.current = astronautId;
            setPhase("recording");
            setElapsed(0);
            setDuration(30);
            setResult(null);
            setSaved("");
            try {
              await api.startMeasurement(astronautId);
            } catch (reason) {
              setPhase("idle");
              throw reason;
            }
          })}
        >
          Начать 30 секунд
        </button>
        <button type="button" disabled={busy || phase !== "recording"} onClick={() => void run(() => api.stopMeasurement())}>Остановить</button>
      </div>
      <p>{message}</p>
      <p className="mono">{captureText}</p>
      {phase === "recording" && (
        <div className="meter-block">
          <p className="mono">Идёт диагностика. Осталось {remaining.toFixed(0)} с. В базу эта попытка ещё не записана.</p>
          <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={elapsed}>
            <span style={{ width: `${fill}%` }} />
          </div>
        </div>
      )}
      {phase === "saving" && <p className="mono">Записываю итог в базу…</p>}
      <div className={phase === "recording" ? "preview-frame live" : "preview-frame"}>
        {preview ? <img className="preview" alt="Предпросмотр камеры с зонами лба и щёк" src={preview} /> : <div className="preview" />}
      </div>
      {result && (
        <section className="panel">
          <h2>Итог</h2>
          {showNumber ? <p className="pulse">{result.value_bpm}<span style={{ fontSize: "1rem" }}> bpm</span></p> : <p className="pulse">—</p>}
          <p>{outcomeText(phase, result)}</p>
          <p className="muted">{result.diagnostic_summary}</p>
          <ul>{(result.rejection_reasons ?? []).map((reason) => <li key={reason}>{reason}</li>)}</ul>
          <p className="muted">Статус {result.validity_status ?? "неизвестен"}. Проверки качества экспериментальные и не являются вероятностью.</p>
          {phase === "saved" && saved && <p>Запись {saved} сохранена. Файл: {databasePath}</p>}
          {phase === "discarded" && <p>Эта попытка в базу не записана. Остановка и сбой камеры не сохраняются.</p>}
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
            })}>Повторить запись в базу</button>
          )}
          <details>
            <summary>Техническая диагностика</summary>
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

function stepClass(step: number, astronautId: string, preview: string, phase: CheckPhase): string {
  const current = !astronautId ? 1 : !preview ? 2 : phase === "recording" ? 3 : phase === "saving" || phase === "saved" || phase === "discarded" ? 4 : 3;
  if (step < current) return "done";
  if (step === current) return "current";
  return "";
}

function outcomeText(phase: CheckPhase, result: WorkerEvent): string {
  if (phase === "saving") return "Диагностика закончилась. Записываю итог в базу.";
  if (phase === "idle" && (result.validity_status === "VALID" || result.validity_status === "INCONCLUSIVE")) {
    return "Итог получен, но в базу не записан. Можно повторить запись.";
  }
  if (phase === "discarded") return "Надёжная запись не создана.";
  if (result.validity_status === "VALID") return "Оценка пульса получена и записана. Это не диагноз.";
  if (result.validity_status === "INCONCLUSIVE") return "Число пульса не показано: качества сигнала не хватило. Сама попытка записана как недостаточно данных.";
  return "Надёжной оценки нет.";
}

function describeCapture(payload: WorkerEvent): string {
  const capture = payload.capture;
  if (!capture) return "Режим камеры ещё не сообщён.";
  const measured = capture.measured_fps != null ? `поток сейчас ${capture.measured_fps} кадр/с` : "поток ещё измеряется";
  const format = capture.yuy2_requested
    ? `запрошен YUY2, камера дала ${capture.pixel_format ?? "неизвестный формат"}`
    : `камера дала ${capture.pixel_format ?? "неизвестный формат"}`;
  return `${capture.backend ?? "камера"} · ${capture.width ?? "?"}×${capture.height ?? "?"} · заявлено ${capture.nominal_fps ?? "?"} кадр/с · ${measured} · ${format}`;
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
