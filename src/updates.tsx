import { useState } from "react";
import { api, desktopAvailable } from "./api";
import type { UpdateReport } from "./types";

export function UpdatePanel() {
  const [report, setReport] = useState<UpdateReport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function check() {
    if (!desktopAvailable()) {
      setError("Open Health Engine on this computer to check for an update.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setReport(await api.checkForUpdate());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Updates</h2>
      <p className="muted">
        The check looks for a network path. When a newer Health Engine package is published, it is saved on this computer and is not started by itself. Health records stay here.
      </p>
      <button type="button" disabled={busy} onClick={() => void check()}>Check the network and download</button>
      {error && <p className="error">{error}</p>}
      {report && <p>{report.message}</p>}
      {report?.downloaded_path && <p className="mono">{report.downloaded_path}</p>}
    </section>
  );
}
