// TEST LOGIN. THE PASSWORD STAYS IN THIS WINDOW AND IS NEVER SENT OR SAVED.
import { useEffect, useState } from "react";
import { api, desktopAvailable } from "./api";
import type { PersonSession } from "./types";

type LoginField = "name" | "age" | "role" | "password";
type GateMode = "loading" | "create" | "return";

const HINTS: Record<LoginField, string> = {
  name: "Family name and given name, up to 80 characters.",
  age: "Whole years, from 18 to 99.",
  role: "CREW, MEDICAL, or ADMIN.",
  password: "4 to 64 characters. Checked only on this screen. The password is not stored.",
};

export function testPassword(password: string): string | null {
  if (password.length < 4 || password.length > 64 || password.trim() !== password) return HINTS.password;
  return null;
}

function hexPoints(cx: number, cy: number, radius: number): string {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 180) * (60 * index - 30);
    return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");
}

function honeycombCells() {
  const radius = 28;
  const width = Math.sqrt(3) * radius;
  const height = radius * 2;
  const cells = [];
  for (let row = 0; row < 22; row += 1) {
    for (let col = 0; col < 34; col += 1) {
      const cx = col * width + (row % 2 ? width / 2 : 0) - 20;
      const cy = row * height * 0.75 - 16;
      cells.push({
        id: `${row}-${col}`,
        points: hexPoints(cx, cy, radius - 1.6),
        delay: `${((row * 17 + col * 13) % 70) / 10}s`,
        duration: `${2.8 + ((row * 3 + col) % 9) * 0.45}s`,
      });
    }
  }
  return cells;
}

const CELLS = honeycombCells();

export function LoginGate({ onEnter }: { onEnter: (session: PersonSession) => void }) {
  const [mode, setMode] = useState<GateMode>("loading");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [role, setRole] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Partial<Record<LoginField, string>>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!desktopAvailable()) {
      setMode("create");
      return;
    }
    void api.astronauts().then((people) => {
      setMode(people.length > 0 ? "return" : "create");
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : String(reason));
    });
  }, []);

  return (
    <div className="login-gate">
      <div className="login-blur" />
      <svg className="honeycomb" viewBox="0 0 1600 980" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {CELLS.map((cell) => (
          <polygon key={cell.id} className="hex" points={cell.points} style={{ animationDelay: cell.delay, animationDuration: cell.duration }} />
        ))}
      </svg>
      <form
        className="login-card panel"
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          const next = mode === "return" ? validateReturn(name, password) : validateLogin(name, age, role, password);
          setErrors(next);
          if (Object.keys(next).length > 0 || mode === "loading") return;
          if (!desktopAvailable()) {
            setError("This Health Engine window is not connected to the local database. Open the program on this computer.");
            return;
          }
          setBusy(true);
          setError("");
          const open = mode === "return" ? api.overwritePerson(name.trim()) : api.bindPerson(name.trim(), Number(age), role);
          void open.then((astronaut) => {
            onEnter({
              astronautId: astronaut.astronaut_id,
              crewIdentifier: astronaut.crew_identifier,
              displayName: astronaut.display_name,
              ageYears: astronaut.age_years ?? Number(age),
              role: astronaut.role,
              sessionPassword: password,
            });
          }).catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : String(reason));
          }).finally(() => setBusy(false));
        }}
      >
        <p className="login-kicker">Test sign-in</p>
        <h1>Personal profile</h1>
        <p className="muted">This is a Health Engine prototype, not a NASA account. The login and password belong only to this program. The password is checked here and is not stored.</p>
        {error && <p className="error">{error}</p>}
        {mode === "loading" && <p className="muted">Checking whether this computer already has a profile.</p>}
        {mode !== "loading" && (
          <label className={errors.name ? "invalid" : undefined}>
            {mode === "return" ? "Login" : "Profile login"}
            <input value={name} autoComplete="off" onChange={(event) => setName(event.target.value)} />
            <span className={errors.name ? "field-hint bad" : "field-hint"}>{errors.name ?? (mode === "return" ? "Each launch can use a different login. It replaces the profile name. Check records stay." : HINTS.name)}</span>
          </label>
        )}
        {mode === "create" && (
          <>
            <label className={errors.age ? "invalid" : undefined}>
              Age
              <input value={age} inputMode="numeric" autoComplete="off" onChange={(event) => setAge(event.target.value)} />
              <span className={errors.age ? "field-hint bad" : "field-hint"}>{errors.age ?? HINTS.age}</span>
            </label>
            <label className={errors.role ? "invalid" : undefined}>
              Role
              <select value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="">Choose</option>
                <option value="CREW">CREW</option>
                <option value="MEDICAL">MEDICAL</option>
                <option value="ADMIN">ADMIN</option>
              </select>
              <span className={errors.role ? "field-hint bad" : "field-hint"}>{errors.role ?? HINTS.role}</span>
            </label>
          </>
        )}
        {mode !== "loading" && (
          <label className={errors.password ? "invalid" : undefined}>
            Test password
            <input value={password} type="password" autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} />
            <span className={errors.password ? "field-hint bad" : "field-hint"}>{errors.password ?? HINTS.password}</span>
          </label>
        )}
        <button type="submit" disabled={busy || mode === "loading"}>Sign in</button>
      </form>
    </div>
  );
}

function validateReturn(name: string, password: string): Partial<Record<LoginField, string>> {
  const errors: Partial<Record<LoginField, string>> = {};
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80 || !/[A-Za-z\u0400-\u04FF]/.test(trimmed)) errors.name = HINTS.name;
  const passwordError = testPassword(password);
  if (passwordError) errors.password = passwordError;
  return errors;
}

function validateLogin(name: string, age: string, role: string, password: string): Partial<Record<LoginField, string>> {
  const errors: Partial<Record<LoginField, string>> = {};
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80 || !/[A-Za-z\u0400-\u04FF]/.test(trimmed)) errors.name = HINTS.name;
  const years = Number(age);
  if (!Number.isInteger(years) || years < 18 || years > 99) errors.age = HINTS.age;
  if (role !== "CREW" && role !== "MEDICAL" && role !== "ADMIN") errors.role = HINTS.role;
  const passwordError = testPassword(password);
  if (passwordError) errors.password = passwordError;
  return errors;
}
