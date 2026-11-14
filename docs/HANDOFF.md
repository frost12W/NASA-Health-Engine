# HANDOFF: NASA-Health-Engine → проект `spaceapps-2026`

Передано: 14.11.2026, 14:45 (Asia/Bishkek), сессией DSH.
Цель документа: отдать другой сессии (работающей в `C:\Users\Tima\Documents\spaceapps-2026`)
полный и проверенный контекст по проекту `NASA-Health-Engine`, чтобы не переоткрывать
окружение, сборку и историю решений заново.

Все факты ниже проверены командами в этой сессии, если не указано иное.

---

## 0. TL;DR

| Что | Значение |
|---|---|
| Проект | `C:\Users\Tima\Documents\NASA-Health-Engine` (приватный репозиторий) |
| Ветка | `dev` @ `13922ca`, `main` отстаёт на 1+ коммит |
| Стек | Tauri 2 (Rust) + React 19 / TypeScript / Vite 8 + Python-воркер (OpenCV + MediaPipe) |
| Сборка | **уже собрана**, `src-tauri\target\debug\health-engine.exe` (16,5 МБ, 14.11 13:34) |
| Состояние | **запущено**: приложение PID 3604, python-воркер PID 2364 |
| Тесты | Python — 11 passed; Rust — 5 passed |
| dev-сервер | больше не нужен: интерфейс вшит в exe (фича `custom-protocol`) |
| Блокер | камера не открылась по индексу (DSHOW), живой замер не сделан |

---

## 1. Где что лежит

| Путь | Что это |
|---|---|
| `C:\Users\Tima\Documents\NASA-Health-Engine` | корень проекта (git-репозиторий) |
| `…\src\` | фронтенд: `pages.tsx` (30 КБ — все экраны), `api.ts`, `App.tsx`, `App.css`, `types.ts` |
| `…\src-tauri\src\` | Rust: `lib.rs` (сборка приложения), `commands.rs` (IPC-команды), `db.rs` (SQLite, 42 КБ), `worker.rs` (запуск и протокол Python-воркера), `clock.rs` (миссионное время) |
| `…\python-worker\worker\` | `engine.py` (485 строк — основной цикл), `face.py`, `roi.py`, `signals.py`, `quality.py`, `protocol.py`, `format.py`, `__main__.py` |
| `…\python-worker\tests\` | pytest-набор (11 тестов) |
| `…\docs\` | `technical-specification.txt` (38 КБ — **главный документ**), `architecture-document.txt` (60 КБ), `measurement-method.md` |
| `…\scripts\bootstrap-windows.ps1` | подготовка Python-окружения воркера |
| `…\BACKEND-ERRORS-LOG.md` | журнал дефектов бэкенда с причиной и проверкой |
| `…\dist\` | собранный фронтенд (вшивается в exe), в git нет |
| `…\src-tauri\target\` | артефакты Rust, в git нет |
| `C:\Users\Tima\Documents\health-engine-dev.png` | скриншот окна из ветки `dev` |
| `%LOCALAPPDATA%\HealthEngine\` | рабочие данные приложения (см. §6) |

Рабочая директория прошлой сессии была `C:\Users` (это не папка проекта — проект открывался
по абсолютному пути).

---

## 2. Доступ к репозиторию (важно)

Репозиторий **приватный**: `https://github.com/frost12W/NASA-Health-Engine`.
Без авторизации API отдаёт 404, `git clone` падает с `could not read Username`.

На машине настроены три профиля GitHub CLI:

| Профиль | Каталог конфигурации | Доступ к репо |
|---|---|---|
| `AGNARE` | `C:\Users\Tima\.gh\AGNARE` | **есть** |
| `abagylov0-ui` | `C:\Users\Tima\.gh\abagylov0-ui` | нет (404) |
| `argenbagylov64-stack` | `C:\Users\Tima\.gh\argenbagylov64-stack` | нет (404) |

Рабочий приём — выставить `GH_CONFIG_DIR` на нужный профиль перед `git`/`gh`:

```powershell
$env:GH_CONFIG_DIR = "C:\Users\Tima\.gh\AGNARE"
git fetch origin
git push origin dev
Remove-Item Env:GH_CONFIG_DIR
```

`credential.helper` в git уже указывает на `gh auth git-credential`, поэтому отдельный PAT не нужен.
Автор коммитов в проекте — `Toaster123G <malcevartem807@gmail.com>`; мои коммиты уходят как
`AGNARE <argenbagylov0@gmail.com>`.

**Осторожно:** `dev` — рабочая ветка живого автора, он пушил в неё 14.11 в 13:02. Перед push
всегда `git fetch` и смотреть, не разошлись ли ветки. `main` не трогать.

---

## 3. Что установлено на машине

| Компонент | Версия | Путь / примечание |
|---|---|---|
| Rust (rustup, MSVC) | 1.100.0 | `C:\Users\Tima\.cargo\bin` — **не в PATH по умолчанию**, надо добавлять |
| Node.js / npm | 22.23.3 / 10.9.9 | `C:\Program Files\nodejs` |
| Python (системный) | 3.14.0 | `C:\Users\Tima\AppData\Local\Programs\Python\Python314` |
| Python (venv проекта) | 3.14.0 | `…\python-worker\.venv` (создан исправленным `bootstrap-windows.ps1`) |
| WebView2 Runtime | 157.0.4341.46 | есть |
| Visual Studio | Community 2026 + MSVC + Windows SDK | нужен для линковки Rust |

Пакеты в venv: `opencv-python 4.14.0.94`, `opencv-contrib-python 5.0.0.93`, `mediapipe 1.2.3`,
`numpy 2.5.4`, `scipy 1.18.1`, `pytest 9.2.0`.

Отдельно: **Rust пришлось ставить через `winget install --id Rustlang.Rustup -e`** — до этого
его не было вообще. Каждый новый shell требует:

```powershell
$env:Path = "C:\Users\Tima\.cargo\bin;" + $env:Path
```

---

## 4. Как собрать и запустить

Ключевая деталь, которую легко упустить: в `dev` фича `custom-protocol` включена **по умолчанию**.
Из-за этого обычный `cargo build` вшивает `dist` в exe, а `npm run tauri dev` собирает с
`--no-default-features` и работает через Vite. Это два разных режима.

**Обычный запуск (без dev-сервера):**

```powershell
cd C:\Users\Tima\Documents\NASA-Health-Engine
npm install                       # один раз
powershell -ExecutionPolicy Bypass -File scripts\bootstrap-windows.ps1   # один раз
npm run build                     # фронтенд → dist
cargo build --manifest-path src-tauri\Cargo.toml
src-tauri\target\debug\health-engine.exe
```

**Режим разработки с hot-reload:**

```powershell
npm run tauri dev                 # поднимает Vite на :1420 и собирает без custom-protocol
```

Тайминги на этой машине: чистый `cargo build` — 4 м 43 с, инкрементальный — 1 м 03 с,
`npm run build` — 0,4 с. Каталог проекта на `C:` (106 ГБ свободно), поэтому `CARGO_TARGET_DIR`
на другой диск не нужен, хотя README это советует (на машине автора был забит системный диск).

---

## 5. Проверенное состояние

| Проверка | Результат |
|---|---|
| `npm run build` (tsc + vite) | проходит, типы чистые |
| `cargo build` | проходит без ошибок и предупреждений |
| `cargo test` | **5 passed** (`db::storable_pulse_strips_inconclusive_numbers`, `clock::met_counts_configured_elapsed_time`, `clock::circadian_phase_uses_the_configured_utc_window`, `clock::day_of_year_matches_the_specification_example`, `db::valid_pulse_round_trips_and_inconclusive_cannot_keep_a_number`) |
| `pytest` в `python-worker` | **11 passed** (~2,6 с) |
| Запуск exe без Vite | работает, окно показывает интерфейс |
| `git status` | чисто |

Версия приложения — `dev`-редизайн: логотип с орбитой, моноширинные заголовки капсом,
голубые акценты, меню HOME / HEALTH CHECK / DETAIL MONITORING / HEALTH ACHIEVE /
HEALTH ENGINE WIKI / SETTINGS.

---

## 6. Данные приложения

`%LOCALAPPDATA%\HealthEngine` (`C:\Users\Tima\AppData\Local\HealthEngine`):

| Файл | Размер | Что |
|---|---|---|
| `database\health_engine.sqlite` | 147 456 Б | основная база: экипаж, попытки замера, журнал, задачи, алерты, аудит |
| `backups\health_engine-20261114T075632Z.sqlite` | 110 592 Б | копия, сделанная из Settings |
| `logs\python-worker.log` | 2 632 Б | лог vision-процесса |

Каталоги `exports\` и `ASTRONAUTS-HEALTH-RESULTS-MONTH\` создаются, но пока пустые.

---

## 7. Камера: блокер снят 14.11.2026 (проверено)

`logs\python-worker.log` содержит 7 повторов:

```
[ WARN:0@...] global cap.cpp:477 cv::VideoCapture::open VIDEOIO(DSHOW):
backend is generally available but can't be used to capture by index
```

При этом `mediapipe` инициализировался нормально:

```
INFO: Created TensorFlow Lite XNNPACK delegate for CPU.
W0000 ... face_landmarker_graph.cc:181] Sets FaceBlendshapesGraph acceleration to xnnpack by default.
```

Вывод: пайплайн и модель лица живые, а **захват кадра по индексу не открывается** (DSHOW).
Что проверить дальше:

1. Бэкенд захвата: `cv2.CAP_MSMF` вместо `CAP_DSHOW`, перебор индексов 0..3.
2. Наличие физической камеры и разрешений Windows (Settings → Privacy → Camera).
3. Не занята ли камера другим приложением (Zoom/Telegram/браузер).

По `BACKEND-ERRORS-LOG.md` живой замер на машине автора тоже не замерялся по времени —
то есть производительность 30-секундной проверки ни разу не подтверждена на железе.

---

## 8. Что изменила предыдущая сессия

Один коммит: **`13922ca` "Find the Python interpreter instead of hard-coding one path"**.

Проблема: `scripts\bootstrap-windows.ps1` содержал
`C:\Users\toaster123\AppData\Local\Programs\Python\Python313\python.exe` — путь с чужой машины,
скрипт из README падал у всех, кроме автора.

Что сделано:

- поиск интерпретатора по порядку: `HEALTH_ENGINE_PYTHON` → `py -3.13` → `py -3` →
  `python.exe` в PATH (заглушка Windows Store отбрасывается) → стандартные каталоги установки;
- требование версии ≥ 3.13 и вывод выбранной версии;
- опрос `py.exe` идёт с локально ослабленным `$ErrorActionPreference`: при `Stop` любой stderr
  от `py.exe` («No suitable Python runtime found») убивал весь скрипт;
- существующий рабочий `.venv` переиспользуется, пересоздаётся только отсутствующий/сломанный.

Проверка: с полностью удалённым `.venv` скрипт нашёл Python 3.14, поставил пакеты, exit 0,
затем `pytest` — 11 passed. Запушено в `origin/dev`, `13922ca` подтверждён на GitHub.

Отдельно стоит знать: на этой машине `py -3.13` **не работает**, хотя 3.13.14 установлен —
uv регистрирует его под тегом `Astral/CPython3.13.14`, поэтому `py -3` выдаёт 3.14.

---

## 9. Открытые вопросы и что не сделано

| Тема | Состояние |
|---|---|
| Release-сборка и установщик | не собирались (`npm run tauri build`), существует только debug-exe |
| Python внутри установщика | не вшит: на чужой машине нужен либо `python-worker\.venv`, либо `HEALTH_ENGINE_PYTHON` |
| Версия Python | скрипт берёт «3.13 или новее»; фактически используется 3.14. Если команде нужна строго 3.13 — либо менять проверку, либо задавать `HEALTH_ENGINE_PYTHON` |
| Живая камера | не работает по индексу (см. §7), замер не выполнен ни разу |
| Точность пульса | не подтверждена; приложение намеренно не ставит диагноз и не решает годность |
| `main` vs `dev` | `main` — первая версия, `dev` — рабочая; мержить без автора нельзя |
| Портативность bootstrap | исправлено только для Python; остальные шаги README ещё не проверялись на «чистой» машине |

---

## 10. Правила продукта (из README и спецификации)

Иерархия авторитета документов: `docs\technical-specification.txt` → `docs\architecture-document.txt`
→ отчёт первого прототипа (это свидетельство эксперимента, **не** вторая спецификация).

Приложение обязано оставаться офлайн: никакой сети, никакой синхронизации, никаких аккаунтов.
Оно **не** диагностирует, не назначает лечение и не определяет годность к работе; число пульса
сохраняется только если пройдены пороги качества, и остаётся оценкой.

Чего в этой версии сознательно нет: встроенного Python в установщике, передачи на Землю,
порогов «здоров/не годен», замера по пальцу, демо-записей, PDF-экспорта, заявлений о том,
что камера несжатая или держит заданный FPS.

---

## 11. Связь с проектом `spaceapps-2026`

`C:\Users\Tima\Documents\spaceapps-2026` — отдельный, независимый проект по той же теме
(по его `HANDOFF.md` от 13.11.2026): Python-реализация с `app\backend\rppg.py` (POS + CHROM),
`app\backend\roi.py`, `app\backend\storage.py`, FastAPI + WebSocket, PySide6-десктоп,
`app\tests` — 16 passed, плюс спайк `spikes\camera-face-tracking`. Не git-репозиторий.

Пересечение, которое стоит использовать при переносе знаний:

| Тема | `NASA-Health-Engine` | `spaceapps-2026` |
|---|---|---|
| rPPG-сигнал | `python-worker\worker\signals.py` (182 строки) | `app\backend\rppg.py` |
| ROI лица и маска кожи | `python-worker\worker\roi.py` (183) | `app\backend\roi.py` |
| Контроль качества | `python-worker\worker\quality.py` (190) | — |
| Хранение | `src-tauri\src\db.rs` (SQLite через rusqlite) | `app\backend\storage.py` |
| Камера | Python-воркер, отдельный процесс, JSON-протокол по stdin/stdout | PySide6 + OpenCV |

Практический вывод для принимающей сессии: **алгоритмы сравнимы, а окружения разные.**
`NASA-Health-Engine` — это офлайн-десктоп на Tauri с Rust-ядром и отдельным Python-процессом;
`spaceapps-2026` — Python-монорепо с FastAPI и PySide6. Общий знаменатель — OpenCV + MediaPipe
и rPPG-математика, её и имеет смысл сверять.

Открытый вопрос к владельцу: какой репозиторий считается основным для сдачи, и нужно ли
переносить в него наработки из второго (или наоборот).

---

## 12. Что делать следующей сессии (чек-лист)

1. Прочитать `docs\technical-specification.txt` — он главнее остального.
2. `git -C C:\Users\Tima\Documents\NASA-Health-Engine status` — убедиться, что рабочее дерево чистое.
3. Проверить, что приложение ещё живо: `Get-Process health-engine`.
4. Для правок фронтенда — `npm run tauri dev` (hot-reload), для проверки «как у пользователя» —
   `npm run build` + `cargo build` + exe.
5. Любые правки Python-воркера проверять `pytest` в `python-worker`, правки Rust — `cargo test`.
6. Перед push — `git fetch` (ветка живая, автор пушит сам).
7. Не выдумывать результаты замеров: камера на этой машине не запущена, чисел пульса нет.

---

**Обновление 14.11.2026, 15:45.** Блокер из раздела 7 снят: камера открывается через штатный протокол воркера (open_camera, device_index 0 → ok:true, CAP_DSHOW, YUY2, 640×480, detector mediapipe). Предупреждения can't be used to capture by index появляются при переборе несуществующих индексов (1, 2), а не на рабочей камере. Живой замер выполнен: 65.9 уд/мин (см. docs/VALIDATION.md).
