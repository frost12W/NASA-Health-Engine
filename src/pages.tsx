// CREW PAGES FOR CHECKS, RECORDS, TASKS, HELP, AND SETTINGS.
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState, type ReactNode } from "react";
import profileMark from "./assets/profile-mark.png";
import { api, desktopAvailable } from "./api";
import type { HomeCard, JournalRow, MetricRow, PersonSession, StorageStatus, SyncStatus, TaskView, WorkerEvent } from "./types";

export function HomePage({ session, sync, onChanged, onLeave }: { session: PersonSession; sync: SyncStatus | null; onChanged: () => Promise<void>; onLeave: () => void }) {
  const [card, setCard] = useState<HomeCard | null>(null);
  const [error, setError] = useState("");

  async function load() {
    if (!desktopAvailable()) return;
    const cards = await api.home();
    setCard(cards.find((item) => item.astronaut_id === session.astronautId) ?? null);
  }

  useEffect(() => {
    void load().catch((reason: unknown) => setError(String(reason)));
    const timer = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [session.astronautId]);

  return (
    <section>
      <p className="muted">Этот Health Engine открыт для одного астронавта. Записи на этой карточке не являются диагнозом.</p>
      {error && <p className="error">{error}</p>}
      <article className="panel crew-card personal-card">
        <div className="profile">
          <img className="profile-mark" src={profileMark} alt="" />
          <p className="profile-age">{session.ageYears}</p>
          <h2>{session.displayName}</h2>
          <p className="profile-role">{session.role}</p>
        </div>
        <dl className="identity">
          <div><dt>Возраст</dt><dd>{session.ageYears}</dd></div>
          <div><dt>Имя</dt><dd>{session.displayName}</dd></div>
          <div><dt>Роль</dt><dd>{session.role}</dd></div>
          <div><dt>Персональный пароль</dt><dd className="mono">{session.sessionPassword}</dd></div>
        </dl>
        <p className="muted">Пароль проверен при входе и хранится только в этом окне. В базу и на диск он не записывается.</p>
        <p><span className={card?.workflow_state === "CHECK RECORDED" ? "status done" : "status"}>{card?.workflow_state ?? "INSUFFICIENT DATA"}</span></p>
        <div className="vitals">
          <Vital kind="pulse" label="Pulse" value={card?.pulse_bpm ?? null} unit="bpm" source={card?.pulse_source ?? null} />
          <Vital kind="breath" label="Breaths" value={card?.respiratory_rate ?? null} unit="/min" source={card?.respiratory_source ?? null} />
          <Vital kind="sleep" label="Sleep" value={card?.sleep_hours ?? null} unit="h" source={card?.sleep_source ?? null} />
          <Vital kind="mood" label="Wellbeing" value={card?.wellbeing ?? null} unit="/ 5" source={card?.wellbeing_source ?? null} />
        </div>
        <p className="muted">Last pressure {card?.last_systolic ?? "—"}/{card?.last_diastolic ?? "—"}</p>
        <p>Today's check: <span className={taskClass(card?.task_display_status ?? "DUE")}>{card?.task_display_status ?? "DUE"}</span></p>
        <p className="crew-id">PROFILE ID {card?.crew_identifier ?? session.crewIdentifier}</p>
        <button type="button" onClick={() => { onLeave(); void onChanged(); }}>Выйти</button>
      </article>
      <section className="panel" style={{ marginTop: "0.8rem" }}>
        <h2>Ground link</h2>
        <p>{sync?.note ?? "No ground link is configured. Records stay on this computer until a channel is available."}</p>
        <p className="mono">Records stored only here: {sync?.local_only_count ?? "—"}</p>
        <p className="muted">Last acknowledgement: {sync?.last_acknowledged_at ?? "none"}</p>
      </section>
    </section>
  );
}

function CrewField({ label, hint, error, children }: { label: string; hint: string; error?: string; children: ReactNode }) {
  return (
    <label className={error ? "invalid" : undefined}>
      {label}
      {children}
      <span className={error ? "field-hint bad" : "field-hint"}>{error ?? hint}</span>
    </label>
  );
}

function Vital({ kind, label, value, unit, source }: { kind: "pulse" | "breath" | "sleep" | "mood"; label: string; value: number | null; unit: string; source: string | null }) {
  const origin = source === "CAMERA_DERIVED" ? "camera" : source === "SELF_REPORTED" ? "entered" : source === "SIMULATED" ? "sample" : "";
  const pace = kind === "pulse"
    ? 60 / Math.max(value ?? 60, 30)
    : kind === "breath"
      ? 60 / Math.max(value ?? 14, 6)
      : 3.2;
  return (
    <div className="vital">
      <span>{label}</span>
      <strong>{value ?? "—"} <small>{unit}</small></strong>
      <LiveDiagram kind={kind} value={value} pace={pace} />
      {origin && <em>{origin}</em>}
    </div>
  );
}

function LiveDiagram({ kind, value, pace }: { kind: "pulse" | "breath" | "sleep" | "mood"; value: number | null; pace: number }) {
  if (kind === "sleep") {
    const hours = value == null ? 0 : Math.max(0, Math.min(24, value));
    const sweep = (hours / 24) * 100;
    return (
      <svg className="diagram gauge" viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(197,208,220,0.25)" strokeWidth="3" />
        <circle cx="18" cy="18" r="14" fill="none" stroke="#3ec6ff" strokeWidth="3" strokeDasharray={`${sweep} 100`} strokeLinecap="round" transform="rotate(-90 18 18)" pathLength="100" />
        {value != null && (
          <g>
            <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="4s" repeatCount="indefinite" />
            <circle cx="18" cy="4" r="1.4" fill="#e6c84a" />
          </g>
        )}
      </svg>
    );
  }
  if (kind === "mood") {
    const score = value == null ? 0 : Math.max(0, Math.min(5, Math.round(value)));
    return (
      <svg className="diagram bars" viewBox="0 0 120 36" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((index) => (
          <rect key={index} x={8 + index * 22} y={30 - (index + 1) * 5} width="14" height={(index + 1) * 5} className={index < score ? "bar live" : "bar"} style={index < score ? { animationDelay: `${index * 0.12}s` } : undefined} />
        ))}
      </svg>
    );
  }
  if (value == null) {
    return (
      <svg className="diagram" viewBox="0 0 96 36" aria-hidden="true">
        <line x1="0" y1="18" x2="96" y2="18" stroke="rgba(197,208,220,0.35)" strokeWidth="1.4" />
      </svg>
    );
  }
  const points = kind === "pulse"
    ? "0,18 10,18 14,18 18,4 22,32 26,12 30,18 48,18 58,18 62,4 66,32 70,12 74,18 96,18"
    : "0,18 8,8 16,28 24,8 32,28 40,8 48,28 56,8 64,28 72,8 80,28 88,8 96,18";
  return (
    <svg className="diagram wave" viewBox="0 0 96 36" aria-hidden="true">
      <polyline className="trace" points={points} fill="none" stroke="#3ec6ff" strokeWidth="1.6" style={{ animationDuration: `${pace}s` }} />
    </svg>
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

export function HealthCheckPage({ astronautId, displayName }: { astronautId: string; displayName: string }) {
  const [cameras, setCameras] = useState<Array<{ device_index: number; label: string }>>([]);
  const [deviceIndex, setDeviceIndex] = useState(0);
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("Откройте камеру. Проверка идёт для этого профиля.");
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
  const [reason, setReason] = useState<"расписанию" | "самочувствию" | "">("");
  const sessionAstronaut = useRef("");

  useEffect(() => {
    if (!desktopAvailable()) return;
    sessionAstronaut.current = astronautId;
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
  }, [astronautId]);

  const showNumber = result?.validity_status === "VALID" && typeof result.value_bpm === "number";
  const remaining = Math.max(0, duration - elapsed);
  const fill = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;
  const recording = phase === "recording" || phase === "saving";

  return (
    <section>
      <p>
        Это 30-секундная проверка пульса для {displayName}. Камера оценивает пульс по изменению цвета кожи и не определяет настроение.
        Это не диагноз. Видео в файл не пишется. В базу попадает только итог, и он остаётся на этом компьютере.
      </p>
      <ol className="steps">
        <li className={stepClass(1, preview, phase)}>Личный профиль открыт. Проверка идёт только для этого астронавта.</li>
        <li className={stepClass(2, preview, phase)}>Откройте камеру. Картинка остаётся на экране и в базу не сохраняется.</li>
        <li className={stepClass(3, preview, phase)}>Запустите проверку по расписанию или по самочувствию. Сигнал 30 секунд копится в памяти.</li>
        <li className={stepClass(4, preview, phase)}>Когда время вышло, итог сам записывается в локальную базу. Число пульса показывается только если проверки качества пройдены.</li>
      </ol>
      <p className="mono">Файл базы на этом компьютере: {databasePath || "откройте Health Engine, чтобы увидеть путь"}</p>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <p className="profile-lock">Профиль: {displayName}</p>
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
          onClick={() => void begin("расписанию")}
        >
          Проверка по расписанию
        </button>
        <button
          type="button"
          disabled={busy || recording || !canStart || !astronautId}
          onClick={() => void begin("самочувствию")}
        >
          Проверка по самочувствию
        </button>
        <button type="button" disabled={busy || phase !== "recording"} onClick={() => void run(() => api.stopMeasurement())}>Остановить</button>
      </div>
      <p>{message}</p>
      <p className="mono">{captureText}</p>
      {phase === "recording" && (
        <div className="meter-block">
          <p className="mono">Идёт проверка по {reason}. Осталось {remaining.toFixed(0)} с. В базу эта попытка ещё не записана. Камера не оценивает настроение.</p>
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

  async function begin(nextReason: "расписанию" | "самочувствию") {
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

export function DetailPage({ astronautId, displayName }: { astronautId: string; displayName: string }) {
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [journal, setJournal] = useState<JournalRow[]>([]);
  const [symptoms, setSymptoms] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [sleep, setSleep] = useState("");
  const [mood, setMood] = useState("");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [temperature, setTemperature] = useState("");
  const [source, setSource] = useState("SELF_REPORTED");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<DetailField, string>>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (!desktopAvailable()) return;
    void api.symptoms().then(setSymptoms).catch((reason: unknown) => setError(String(reason)));
  }, []);

  useEffect(() => {
    if (!desktopAvailable() || !astronautId) return;
    void Promise.all([api.metrics(astronautId), api.journal(astronautId)]).then(([nextMetrics, nextJournal]) => {
      setMetrics(nextMetrics);
      setJournal(nextJournal);
    }).catch((reason: unknown) => setError(String(reason)));
  }, [astronautId]);

  const pulse = metrics.filter((metric) => metric.metric_type === "PULSE_RATE" && metric.source_type === "CAMERA_DERIVED" && metric.validity_status === "VALID" && metric.value != null);

  const cameraRows = metrics.filter((metric) => metric.metric_type === "PULSE_RATE" && metric.source_type === "CAMERA_DERIVED");
  const pressure = metrics.filter((metric) => metric.metric_type === "BLOOD_PRESSURE_SYSTOLIC" && metric.value != null && metric.validity_status === "VALID");
  const temperatures = metrics.filter((metric) => metric.metric_type === "BODY_TEMPERATURE" && metric.value != null && metric.validity_status === "VALID");
  const manualRows = metrics.filter((metric) => metric.source_type === "SELF_REPORTED" || metric.source_type === "EXTERNAL_DEVICE");
  const journalDays = dayCompleteness(journal);
  const logRows = [
    ...journal.map((entry) => ({
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
        <h2>Сводка</h2>
        <p className="profile-lock">Профиль: {displayName}</p>
        <p className="muted">История и графики ниже относятся только к этому астронавту. Камера измеряет пульс и не определяет настроение. Предупреждения не ставят диагноз.</p>
      </section>
      <section className="panel detail-block">
        <h2>Valid camera pulse</h2>
        {pulse.length === 0 ? <p>No valid measurements recorded yet.</p> : <SeriesChart points={pulse} label="Valid camera pulse values" stroke="#7dcea0" />}
        {pressure.length > 0 && <SeriesChart points={pressure} label="Systolic pressure" stroke="#3ec6ff" />}
        {temperatures.length > 0 && <SeriesChart points={temperatures} label="Temperature" stroke="#e6c84a" />}
        <table>
          <thead><tr><th>Time (UTC)</th><th>Value</th><th>Validity</th></tr></thead>
          <tbody>
            {cameraRows.map((metric) => {
              const tone = cameraTone(metric);
              return (
                <tr className={`tone-row ${tone}`} key={metric.metric_id}>
                  <td><DateMark icon="camera" tone={tone} text={metric.measured_at_utc} /></td>
                  <td className="mono">{metric.value ?? "—"} {metric.unit}</td>
                  <td>{metric.validity_status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted">Green means a saved usable camera record. Yellow means the attempt was saved without a number. Red means the record cannot be used. This is not a diagnosis.</p>
      </section>
      <section className="panel detail-block">
        <h2>Journal and manual entries</h2>
        <p className="muted">Sleep, mood, and symptoms are marked by this astronaut. The camera does not determine mood. Blood pressure and temperature are typed here, or taken from a connected instrument.</p>
        <form
          className="journal-form"
          onSubmit={(event) => {
            event.preventDefault();
            const nextErrors = validateDetail(sleep, mood, systolic, diastolic, temperature, selectedSymptoms.length > 0);
            setFieldErrors(nextErrors);
            if (Object.keys(nextErrors).length > 0) return;
            void saveJournal().catch((reason: unknown) => setError(String(reason)));
          }}
        >
          <CrewField label="Sleep hours" hint={DETAIL_HINTS.sleep} error={fieldErrors.sleep}>
            <input value={sleep} onChange={(event) => setSleep(event.target.value)} />
          </CrewField>
          <CrewField label="Mood 1–5" hint={DETAIL_HINTS.mood} error={fieldErrors.mood}>
            <input value={mood} onChange={(event) => setMood(event.target.value)} />
          </CrewField>
          <CrewField label="Systolic" hint={DETAIL_HINTS.systolic} error={fieldErrors.systolic}>
            <input value={systolic} onChange={(event) => setSystolic(event.target.value)} />
          </CrewField>
          <CrewField label="Diastolic" hint={DETAIL_HINTS.diastolic} error={fieldErrors.diastolic}>
            <input value={diastolic} onChange={(event) => setDiastolic(event.target.value)} />
          </CrewField>
          <CrewField label="Temperature °C" hint={DETAIL_HINTS.temperature} error={fieldErrors.temperature}>
            <input value={temperature} onChange={(event) => setTemperature(event.target.value)} />
          </CrewField>
          <fieldset className="source-choice">
            <legend>Pressure and temperature source</legend>
            <label><span><input type="radio" name="reading-source" checked={source === "SELF_REPORTED"} onChange={() => setSource("SELF_REPORTED")} /> Typed here</span></label>
            <label><span><input type="radio" name="reading-source" checked={source === "EXTERNAL_DEVICE"} onChange={() => setSource("EXTERNAL_DEVICE")} /> Connected instrument</span></label>
          </fieldset>
          <button type="submit">Save entries</button>
          {fieldErrors.form && <p className="error">{fieldErrors.form}</p>}
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
            {logRows.map((row) => (
              <tr className={`tone-row ${row.tone}`} key={row.id}>
                <td><DateMark icon="journal" tone={row.tone} text={row.at} /></td>
                <td>{row.kind}</td>
                <td>{row.value}</td>
                <td>{row.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">Green means that UTC day has both sleep and mood saved. Yellow means the day is only partly filled. Red means a saved manual value is not usable. This is not a diagnosis.</p>
      </section>
    </section>
  );

  async function saveJournal() {
    if (!astronautId) throw new Error("Open the personal profile before saving.");
    if (sleep) await api.addJournal(astronautId, "SLEEP", sleep);
    if (mood) await api.addJournal(astronautId, "MOOD", mood);
    for (const symptom of selectedSymptoms) await api.addJournal(astronautId, "SYMPTOM", symptom);
    if (systolic || diastolic || temperature) await api.addManual(astronautId, systolic, diastolic, temperature, source);
    setSleep("");
    setMood("");
    setSystolic("");
    setDiastolic("");
    setTemperature("");
    setSelectedSymptoms([]);
    setFieldErrors({});
    setMetrics(await api.metrics(astronautId));
    setJournal(await api.journal(astronautId));
  }
}

type DetailField = "sleep" | "mood" | "systolic" | "diastolic" | "temperature" | "form";
type RecordTone = "good" | "mid" | "bad";

const DETAIL_HINTS: Record<DetailField, string> = {
  sleep: "Hours from 0 to 24, such as 7.5. Leave empty if you are not recording sleep.",
  mood: "Whole number from 1 to 5. Leave empty if you are not recording mood.",
  systolic: "40–300, and higher than diastolic. Enter both pressure numbers or neither.",
  diastolic: "20–200, and lower than systolic.",
  temperature: "20–50 °C, or leave empty.",
  form: "Enter at least one item.",
};

function validateDetail(sleep: string, mood: string, systolic: string, diastolic: string, temperature: string, hasSymptom: boolean): Partial<Record<DetailField, string>> {
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

function SeriesChart({ points, label, stroke }: { points: MetricRow[]; label: string; stroke: string }) {
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
    <svg className="chart" viewBox="0 0 100 100" role="img" aria-label={label}>
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
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
        <p>The opening screen checks a personal password and then discards it. The password is not written to the database, a file, or an account store. Name, age, and role are kept for this one profile. Opening the profile again with a different name replaces the previous profile on this computer.</p>
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
        <button type="button" onClick={() => void api.exportRecords(session.astronautId).then(setMessage).catch((reason: unknown) => setError(String(reason)))}>Export this profile</button>
      </div>
      {message && <p>{message}</p>}
    </section>
  );
}
