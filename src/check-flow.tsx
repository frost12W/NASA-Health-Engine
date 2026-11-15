// STEP CHECK. CAMERA PULSE KEEPS ITS OWN SAVE RULES. THIS FILE SAVES ONLY SELF-REPORT AND MANUAL NUMBERS.
import { useEffect, useState } from "react";
import { api, desktopAvailable } from "./api";
import { CrewField, DETAIL_HINTS, HealthCheckPage, errorText, reasonLabel, sourceLabel, validateDetail, type CheckReason, type DetailField } from "./pages";
import type { SyncStatus, WorkerEvent } from "./types";

type Step = "feel" | "pulse" | "vitals" | "summary";

const STEPS: Array<{ id: Step; label: string }> = [
  { id: "feel", label: "How you feel" },
  { id: "pulse", label: "Pulse" },
  { id: "vitals", label: "Blood pressure and temperature" },
  { id: "summary", label: "Summary" },
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
  const [pulseNote, setPulseNote] = useState("The camera has not finished a pulse measurement on this step yet.");
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!desktopAvailable()) return;
    void api.symptoms().then(setSymptoms).catch((reason: unknown) => setError(errorText(reason)));
  }, []);

  function rememberPulse(phase: string, result: WorkerEvent) {
    if (phase === "saved" && result.validity_status === "VALID") {
      setPulseNote(`Pulse ${result.value_bpm ?? "—"} bpm saved. Source: camera. Signal quality sufficient. This is not a diagnosis.`);
      return;
    }
    if (result.validity_status === "INCONCLUSIVE") {
      setPulseNote("The signal was not sufficient. The number is not saved as reliable. You can repeat the measurement on the pulse step.");
      return;
    }
    setPulseNote("No reliable pulse estimate was saved. The measurement can be repeated.");
  }

  async function saveRecord() {
    const next = validateDetail(sleep, mood, systolic, diastolic, temperature, selected.length > 0);
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    if (!desktopAvailable()) {
      setError("Saving is available in the desktop application on this computer.");
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
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="path">
      <p className="profile-lock">Check: {reasonLabel(reason)} · {displayName}</p>
      <p className="muted">The same steps for a scheduled check and a check on how you feel. The camera measures pulse only.</p>
      <ol className="steps">
        {STEPS.map((item, index) => (
          <li key={item.id} className={item.id === step ? "current" : undefined}>{index + 1}. {item.label}</li>
        ))}
      </ol>
      {error && <p className="error">{error}</p>}
      {step === "feel" && (
        <section className="panel">
          <h2>Sleep, mood, and symptoms</h2>
          <p className="muted">These entries are made by the astronaut. The camera does not determine them.</p>
          <div className="journal-form">
            <CrewField label="Sleep, hours" hint={DETAIL_HINTS.sleep} error={errors.sleep}>
              <input value={sleep} onChange={(event) => setSleep(event.target.value)} />
            </CrewField>
            <CrewField label="Mood, 1–5" hint={DETAIL_HINTS.mood} error={errors.mood}>
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
          }}>Next</button>
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
          <button type="button" onClick={() => setStep("vitals")}>Next</button>
        </section>
      )}
      {step === "vitals" && (
        <section className="panel">
          <h2>Blood pressure and temperature</h2>
          <p className="muted">Readings are entered by hand for now. No device is connected in this version.</p>
          <div className="journal-form">
            <CrewField label="Systolic" hint={DETAIL_HINTS.systolic} error={errors.systolic}>
              <input value={systolic} onChange={(event) => setSystolic(event.target.value)} />
            </CrewField>
            <CrewField label="Diastolic" hint={DETAIL_HINTS.diastolic} error={errors.diastolic}>
              <input value={diastolic} onChange={(event) => setDiastolic(event.target.value)} />
            </CrewField>
            <CrewField label="Temperature, °C" hint={DETAIL_HINTS.temperature} error={errors.temperature}>
              <input value={temperature} onChange={(event) => setTemperature(event.target.value)} />
            </CrewField>
          </div>
          <fieldset className="source-choice" disabled>
            <legend>Source of blood pressure and temperature</legend>
            <label><span><input type="radio" checked readOnly /> Manual entry</span></label>
            <label><span><input type="radio" checked={false} disabled /> Device — unavailable</span></label>
          </fieldset>
          <div className="row">
            <button type="button" onClick={() => setStep("pulse")}>Back</button>
            <button type="button" onClick={() => {
              const next = validateDetail("", "", systolic, diastolic, temperature, true);
              setErrors(next);
              if (next.systolic || next.diastolic || next.temperature) return;
              setStep("summary");
            }}>Next</button>
          </div>
        </section>
      )}
      {step === "summary" && (
        <section className="panel">
          <h2>Check summary</h2>
          <p>{pulseNote}</p>
          <ul className="reading-list">
            <li>Sleep: {sleep.trim() || "not recorded"} · {sourceLabel(sleep.trim() ? "SELF_REPORTED" : null)}</li>
            <li>Mood: {mood.trim() || "not recorded"} · {sourceLabel(mood.trim() ? "SELF_REPORTED" : null)}</li>
            <li>Symptoms: {selected.length > 0 ? selected.join(", ") : "none recorded"}</li>
            <li>Blood pressure: {systolic.trim() && diastolic.trim() ? `${systolic}/${diastolic}` : "not entered"} · {sourceLabel(systolic.trim() ? "SELF_REPORTED" : null)}</li>
            <li>Temperature: {temperature.trim() || "not entered"} · {sourceLabel(temperature.trim() ? "SELF_REPORTED" : null)}</li>
          </ul>
          {errors.form && <p className="error">{errors.form}</p>}
          {(errors.sleep || errors.mood || errors.systolic || errors.temperature) && (
            <p className="error">{errors.sleep ?? errors.mood ?? errors.systolic ?? errors.temperature}</p>
          )}
          {!saved && (
            <div className="row">
              <button type="button" onClick={() => setStep("vitals")}>Back</button>
              <button type="button" disabled={busy} onClick={() => void saveRecord()}>Save record</button>
            </div>
          )}
          {saved && (
            <>
              <p>Record saved on this computer.</p>
              <p>Transfer to doctor: {sync && (sync.error_count ?? 0) > 0 ? "error" : "waiting to send"}.</p>
              <p className="muted">The channel is unavailable right now. Waiting to send: {sync?.waiting_count ?? "—"}, sent: {sync?.sent_count ?? 0}, errors: {sync?.error_count ?? 0}.</p>
              <button type="button" onClick={onDone}>Back to summary</button>
            </>
          )}
        </section>
      )}
    </section>
  );
}
