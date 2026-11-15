# Submission sheet — copy-paste fields

Updated: 15.11.2026. Everything below was checked against the live repository.

## Team

| Роль | Имя (латиницей) | Зона ответственности |
|---|---|---|
| Team lead | Artem Maltsev | product, Rust shell, decisions |
| Signal | Argen Bagylov | POS / CHROM, quality gates |
| Interface | Argen Bagylov, Artem Maltsev | React screens, records, export |
| Docs | Argen Bagylov | measurements, sources, submission |

## Public links (verified without login, HTTP 200)

| Поле формы | Значение |
|---|---|
| Project link | https://github.com/frost12W/NASA-Health-Engine |
| Demo link (video, 30 s) | https://raw.githubusercontent.com/frost12W/NASA-Health-Engine/main/docs/media/health-engine-30s.mp4 |
| Subtitles (SRT) | https://raw.githubusercontent.com/frost12W/NASA-Health-Engine/main/docs/media/health-engine-30s.srt |
| Pitch deck (7 slides) | https://github.com/frost12W/NASA-Health-Engine/tree/main/docs/deck |
| License | https://github.com/frost12W/NASA-Health-Engine/blob/main/LICENSE |

## Project description (English)

> Health Engine is an offline desktop application for crew health checks on a
> space station. It keeps a local profile per crew member, runs a step-by-step
> check (self-report, camera pulse, blood pressure and temperature, summary),
> stores every record in a local SQLite database, and shows trends over time.
> The pulse estimate comes from a 30-second face recording: POS and CHROM
> algorithms plus MediaPipe face landmarks, with quality gates that refuse to
> publish a number when the signal is weak. No account, no network, no data
> leaves the computer. It supports screening; it does not diagnose.

## NASA data / resource used

> NASA Human Research Program: 5 Hazards of Human Spaceflight
> (https://www.nasa.gov/hrp/hazards/), Risks of Human Spaceflight
> (https://www.nasa.gov/hrp/risks/), Ongoing HRP Research in Space
> (https://www.nasa.gov/hrp/ongoing-hrp-research/). These pages define the
> hazards and risks the interface refers to.

## Use of Super Intelligence (SI) tools

> We used OpenAI Codex to draft application code from our technical
> specification, and an AI assistant for analysis, documentation and video
> text. All outputs were reviewed by the team; test suites (9 Rust, 15 Python)
> run before publishing. No AI-generated imagery is used in the product; the
> video is marked as AI-assisted. AI did not set the idea and did not produce
> any measurement.

## References

> NASA HRP: 5 Hazards of Human Spaceflight; Risks of Human Spaceflight;
> Ongoing HRP Research in Space. American Heart Association: resting pulse and
> blood pressure pages. NHS: hypothermia, fever in adults, low blood pressure.
> Wang et al. 2017, "Algorithmic Principles of Remote PPG" (POS). de Haan and
> Jeanne 2013, "Robust Pulse Rate From Chrominance-Based rPPG" (CHROM).
> MediaPipe Face Landmarker, Apache-2.0. Tauri, React, Vite, TypeScript,
> OpenCV, NumPy, SciPy, SQLite — licenses listed in docs/SOURCES.md, section 5.

## Internal checklist

| Пункт | Статус |
|---|---|
| Видео ≤ 30 с | да, ровно 00:00:30 |
| Английские субтитры | вшиты в кадр + `.srt` |
| Репозиторий публичный | да, проверено анонимно |
| LICENSE | MIT, в корне |
| Раскрытие ИИ | `docs/AI-DISCLOSURE.md` + раздел в README |
| NASA resource | HRP hazards / risks / ongoing research |
| Лицензии зависимостей | `docs/SOURCES.md`, раздел 5 |
| Колода ≤ 7 слайдов | в работе, `docs/deck/` |

## Still open

- Скриншоты нового интерфейса в колоду и в видео (ждать финального UI).
- Валидация против эталонного прибора (MAE) — не сделана, заявлять точность нельзя.
