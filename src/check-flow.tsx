// STEP CHECK. CAMERA PULSE KEEPS ITS OWN SAVE RULES. THIS FILE SAVES ONLY SELF-REPORT AND MANUAL NUMBERS.
import { useEffect, useState } from "react";
import { api, desktopAvailable } from "./api";
import { CrewField, DETAIL_HINTS, HealthCheckPage, sourceLabel, validateDetail, type CheckReason, type DetailField } from "./pages";
import type { SyncStatus, WorkerEvent } from "./types";

type Step = "feel" | "pulse" | "vitals" | "summary";

const STEPS: Array<{ id: Step; label: string }> = [
  { id: "feel", label: "Самочувствие" },
  { id: "pulse", label: "Пульс" },
  { id: "vitals", label: "Давление и температура" },
  { id: "summary", label: "Итог" },
];

export function CheckFlow({ astronautId, displayName, reason, onDone }: {
  astronautId: string;
  displayName: string;
  reason: CheckReason;
  onDone: () => void;
}) {
  const [step, setStep] = useState<Step>("feel");
  const [sleep, setSleep] = useState("");
  const [mood, setMood] = useState("");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [temperature, setTemperature] = useState("");
  const [symptoms, setSymptoms] = useState<Array<{ id: string; label: string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [errors, setErrors] = useState<Partial<Record<DetailField, string>>>({});
  const [pulseNote, setPulseNote] = useState("Пульс по камере на этом шаге ещё не завершён.");
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!desktopAvailable()) return;
    void api.symptoms().then(setSymptoms).catch((reason: unknown) => setError(String(reason)));
  }, []);

  function rememberPulse(phase: string, result: WorkerEvent) {
    if (phase === "saved" && result.validity_status === "VALID") {
      setPulseNote(`Пульс ${result.value_bpm ?? "—"} bpm записан. Источник: камера. Качество достаточное. Это не диагноз.`);
      return;
    }
    if (result.validity_status === "INCONCLUSIVE") {
      setPulseNote("Сигнал недостаточный. Число не сохранено как достоверное. Его можно повторить на шаге пульса.");
      return;
    }
    setPulseNote("Достоверная оценка пульса не записана. Измерение можно повторить.");
  }

  async function saveRecord() {
    const next = validateDetail(sleep, mood, systolic, diastolic, temperature, selected.length > 0);
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    if (!desktopAvailable()) {
      setError("Сохранение доступно в окне программы на этом компьютере.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (sleep.trim()) await api.addJournal(astronautId, "SLEEP", sleep.trim());
      if (mood.trim()) await api.addJournal(astronautId, "MOOD", mood.trim());
      for (const symptom of selected) await api.addJournal(astronautId, "SYMPTOM", symptom);
      if (systolic.trim() || diastolic.trim() || temperature.trim()) {
        await api.addManual(astronautId, systolic.trim(), diastolic.trim(), temperature.trim(), "SELF_REPORTED");
      }
      setSync(await api.sync());
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="path">
      <p className="profile-lock">Проверка по {reason} · {displayName}</p>
      <p className="muted">Один и тот же порядок для плановой проверки и проверки по самочувствию. Камера измеряет только пульс.</p>
      <ol className="steps">
        {STEPS.map((item, index) => (
          <li key={item.id} className={item.id === step ? "current" : undefined}>{index + 1}. {item.label}</li>
        ))}
      </ol>
      {error && <p className="error">{error}</p>}
      {step === "feel" && (
        <section className="panel">
          <h2>Сон, настроение и симптомы</h2>
          <p className="muted">Эти отметки делает сам астронавт. Камера их не определяет.</p>
          <div className="journal-form">
            <CrewField label="Сон, часы" hint={DETAIL_HINTS.sleep} error={errors.sleep}>
              <input value={sleep} onChange={(event) => setSleep(event.target.value)} />
            </CrewField>
            <CrewField label="Настроение, 1–5" hint={DETAIL_HINTS.mood} error={errors.mood}>
              <input value={mood} onChange={(event) => setMood(event.target.value)} />
            </CrewField>
          </div>
          <div className="row">
            {symptoms.map((symptom) => (
              <label key={symptom.id}>
                <span>
                  <input
                    type="checkbox"
                    checked={selected.includes(symptom.id)}
                    onChange={() => setSelected((current) => current.includes(symptom.id) ? current.filter((id) => id !== symptom.id) : [...current, symptom.id])}
                  /> {symptom.label}
                </span>
              </label>
            ))}
          </div>
          <button type="button" onClick={() => {
            const next = validateDetail(sleep, mood, "", "", "", true);
            setErrors(next);
            if (next.sleep || next.mood) return;
            setStep("pulse");
          }}>Далее</button>
        </section>
      )}
      {step === "pulse" && (
        <section>
          <HealthCheckPage
            astronautId={astronautId}
            displayName={displayName}
            launchReason={reason}
            onSettled={rememberPulse}
          />
          <button type="button" onClick={() => setStep("vitals")}>Далее</button>
        </section>
      )}
      {step === "vitals" && (
        <section className="panel">
          <h2>Давление и температура</h2>
          <p className="muted">Сейчас показания вводятся вручную. Подключённого прибора в этой версии нет.</p>
          <div className="journal-form">
            <CrewField label="Систолическое" hint={DETAIL_HINTS.systolic} error={errors.systolic}>
              <input value={systolic} onChange={(event) => setSystolic(event.target.value)} />
            </CrewField>
            <CrewField label="Диастолическое" hint={DETAIL_HINTS.diastolic} error={errors.diastolic}>
              <input value={diastolic} onChange={(event) => setDiastolic(event.target.value)} />
            </CrewField>
            <CrewField label="Температура, °C" hint={DETAIL_HINTS.temperature} error={errors.temperature}>
              <input value={temperature} onChange={(event) => setTemperature(event.target.value)} />
            </CrewField>
          </div>
          <fieldset className="source-choice" disabled>
            <legend>Источник давления и температуры</legend>
            <label><span><input type="radio" checked readOnly /> Ручной ввод</span></label>
            <label><span><input type="radio" checked={false} disabled /> Прибор — недоступен</span></label>
          </fieldset>
          <div className="row">
            <button type="button" onClick={() => setStep("pulse")}>Назад</button>
            <button type="button" onClick={() => {
              const next = validateDetail("", "", systolic, diastolic, temperature, true);
              setErrors(next);
              if (next.systolic || next.diastolic || next.temperature) return;
              setStep("summary");
            }}>Далее</button>
          </div>
        </section>
      )}
      {step === "summary" && (
        <section className="panel">
          <h2>Итог проверки</h2>
          <p>{pulseNote}</p>
          <ul className="reading-list">
            <li>Сон: {sleep.trim() || "не отмечен"} · {sourceLabel(sleep.trim() ? "SELF_REPORTED" : null)}</li>
            <li>Настроение: {mood.trim() || "не отмечено"} · {sourceLabel(mood.trim() ? "SELF_REPORTED" : null)}</li>
            <li>Симптомы: {selected.length > 0 ? selected.join(", ") : "не отмечены"}</li>
            <li>Давление: {systolic.trim() && diastolic.trim() ? `${systolic}/${diastolic}` : "не введено"} · {sourceLabel(systolic.trim() ? "SELF_REPORTED" : null)}</li>
            <li>Температура: {temperature.trim() || "не введена"} · {sourceLabel(temperature.trim() ? "SELF_REPORTED" : null)}</li>
          </ul>
          {errors.form && <p className="error">{errors.form}</p>}
          {(errors.sleep || errors.mood || errors.systolic || errors.temperature) && (
            <p className="error">{errors.sleep ?? errors.mood ?? errors.systolic ?? errors.temperature}</p>
          )}
          {!saved && (
            <div className="row">
              <button type="button" onClick={() => setStep("vitals")}>Назад</button>
              <button type="button" disabled={busy} onClick={() => void saveRecord()}>Сохранить запись</button>
            </div>
          )}
          {saved && (
            <>
              <p>Запись сохранена на этом компьютере.</p>
              <p>Передача врачу: {sync && (sync.error_count ?? 0) > 0 ? "ошибка" : "ожидает отправки"}.</p>
              <p className="muted">Канал сейчас недоступен. Ожидает отправки: {sync?.waiting_count ?? "—"}, отправлено: {sync?.sent_count ?? 0}, ошибка: {sync?.error_count ?? 0}.</p>
              <button type="button" onClick={onDone}>К сводке</button>
            </>
          )}
        </section>
      )}
    </section>
  );
}
