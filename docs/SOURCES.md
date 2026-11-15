# SOURCES — реестр источников проекта Health Engine

Назначение: (1) база для поля **References** в форме подачи NASA Space Apps 2026, (2) защита от утверждений без источника.
Составлено: 15.11.2026. Ссылки проверены запросом `curl` в этот же день; где проверка не удалась — помечено.

Статусы: **используется** — есть в коде или в действующей документации; **планируется** — заявлено в roadmap; **не используется** — только в реестре.

---

## 1. NASA: методическая рамка

| Категория | Название | Ссылка | Что берём | Статус | Лицензия / условия |
|---|---|---|---|---|---|
| NASA HRP | 5 Hazards of Human Spaceflight | https://www.nasa.gov/hrp/hazards/ | Пять опасностей: radiation, isolation and confinement, distance from Earth, gravity fields, hostile closed environments. Привязка показателя к опасности | **используется** (в документации и питче; в коде не зашито) | Публичный веб-ресурс NASA. Цитировать ссылкой; изображения — по NASA media usage guidelines |
| NASA HRP | Risks of Human Spaceflight | https://www.nasa.gov/hrp/risks/ | Перечень рисков для здоровья (BMed, cardiovascular, immune, bone loss) как обоснование выбора показателей | **используется** (документация) | То же |
| NASA HRP | Ongoing HRP Research in Space | https://www.nasa.gov/hrp/ongoing-hrp-research/ | Контекст: что уже исследуется, чтобы не выдавать своё за новое | **не используется** (только упомянут в `docs/DATASETS.md` как ресурс челленджа) | То же |
| NASA HRP | Human Research Roadmap | https://humanresearchroadmap.nasa.gov/ | Формулировки рисков и пробелов (gaps) в терминах HRP; ссылка на risks: https://humanresearchroadmap.nasa.gov/risks/ | **планируется** (для раздела «почему это важно») | То же |
| NASA OSDR | Open Science Data Repository (биологические и физические данные) | https://science.nasa.gov/biological-physical/data/ ; https://osdr.nasa.gov/ | Данные для будущих исследований; **видео лица и эталонного пульса там нет** | **не используется** | Открытые данные NASA, у каждого набора свои условия — читать перед скачиванием |
| Челлендж | Страница челленджа + вкладка Resources | https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/ | Постановка задачи; дисклеймер «NASA does not endorse…»; официальный список ресурсов (3 NASA + 2 CSA) | **используется** | Условия сайта Space Apps |
| Space Apps | Project Submission Guide / Judging & Awards Guide | https://www.spaceappschallenge.org/resources/project-submission-guide/ ; https://www.spaceappschallenge.org/resources/judging-awards-guide/ | Требования подачи и критерии оценки (см. `docs/COMPLIANCE.md`) | **используется** | Условия сайта Space Apps |

**Важно:** в Resources челленджа нет датасета с видео лица и эталонным пульсом. Единственные не-NASA материалы там — две статьи CSA (радиация, зачем ставят эксперименты в космосе).

---

## 2. Медицинские правила

| Категория | Название | Ссылка | Что берём | Статус | Лицензия / условия |
|---|---|---|---|---|---|
| AHA | Understanding Blood Pressure Readings | https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings | Категории АД (normal / elevated / stage 1 / stage 2) | **заявлено, не в коде** — порогов в приложении нет | Публичная образовательная страница. **Проверка не удалась:** HTTP 403 на curl (защита от ботов). Открыть вручную перед сабмитом |
| AHA | All About Heart Rate (Pulse) / Target Heart Rates Chart | https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/all-about-heart-rate-pulse ; https://www.heart.org/en/healthy-living/fitness/fitness-basics/target-heart-rates | Диапазон пульса покоя у взрослого | **заявлено, не в коде** | То же; 403 на curl — проверить вручную |
| NHS | Hypothermia | https://www.nhs.uk/conditions/hypothermia/ | Порог и признаки гипотермии (< 35 °C) | **заявлено, не в коде** | Open Government Licence v3.0 (по умолчанию для nhs.uk) — уточнить на странице |
| NHS | Fever in adults | https://www.nhs.uk/conditions/fever-in-adults/ | Порог лихорадки (38 °C и выше) | **заявлено, не в коде** | То же |
| NHS | Low blood pressure (hypotension) | https://www.nhs.uk/conditions/low-blood-pressure-hypotension/ | Порог низкого давления (90/60) | **заявлено, не в коде** | То же |
| NHS | High blood pressure (hypertension) | https://www.nhs.uk/conditions/high-blood-pressure-hypertension/ | Порог высокого давления (140/90 при измерении в клинике) | **заявлено, не в коде** | То же |

**Разрыв, который надо закрыть до питча.** В `docs/PITCH.md` (стр. 11) и `docs/DEMO.md` (стр. 21) сказано: «Оценка опирается на внешние правила. AHA, NHS, NASA HRP; каждый показатель привязан к опасности, у каждой рекомендации есть источник». В коде порогов нет: `src/pages.tsx:773` — "Screening thresholds are not configured, so pulse numbers are not turned into health grades."

Два честных варианта:
1. Внести таблицу порогов с `rule_id` и ссылкой на источник (тогда заявление верно).
2. Убрать «AHA/NHS» из питча и говорить: «рамка правил спроектирована, пороги не включены — это следующая итерация».

---

## 3. Научные статьи и ML-компоненты

| Категория | Название | Ссылка | Что берём | Статус | Лицензия / условия |
|---|---|---|---|---|---|
| Статья (POS) | Wang, W., den Brinker, A. C., Stuijk, S., de Haan, G. «Algorithmic Principles of Remote PPG». IEEE Trans. Biomed. Eng., 2017 | DOI: https://doi.org/10.1109/TBME.2016.2609282 (redirect → ieeexplore.ieee.org/document/7565547) | Метод POS: проекция RGB на две ортогональные плоскости, устойчивость к движению | **используется** — `python-worker/worker/signals.py:4`, версия `pos-wang-2017-v1` (`worker/quality.py:29`) | Статья под копирайтом IEEE. Код — наша реализация по описанию метода; цитировать статью, текст не копировать |
| Статья (CHROM) | de Haan, G., Jeanne, V. «Robust Pulse Rate From Chrominance-Based rPPG». IEEE Trans. Biomed. Eng., 2013 | DOI: https://doi.org/10.1109/TBME.2013.2266196 (redirect → ieeexplore.ieee.org/document/6523142) | Метод CHROM: хроматическая (chrominance) модель, второй независимый оценщик для проверки согласия методов | **используется** — `python-worker/worker/signals.py:5` | То же |
| ML-компонент | MediaPipe Face Landmarker (Google) | https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker | 478 точек лица → зоны лба и щёк (ROI) | **используется** — `python-worker/worker/face.py:34-71` | **Apache-2.0** (`mediapipe-1.2.3.dist-info`, `License: Apache 2.0`) |
| ML-модель | `face_landmarker.task` (бандл в репозитории) | `python-worker/models/face_landmarker.task`, описание — `python-worker/models/SOURCE.txt` | Локальный детектор лица, работает без сети | **используется** | Apache-2.0 вместе с MediaPipe; **проверить model card** и указать это в References |
| Метод (не статья) | GREEN / простая зелёная модуляция | — | Третий, вспомогательный оценщик в том же замере (65.7 уд/мин) | **используется** как контроль, без отдельной ссылки | Не ссылаемся как на статью — это базовая формула; в References не выносим |

---

## 4. Датасеты: не использованы, нужны для валидации

Ни один датасет в проекте не использован. ML-модели для пульса нет (`docs/DECISIONS.md` Р-1, Р-3). Данные нужны, чтобы посчитать **MAE** против эталона, а не чтобы «обучить модель к дедлайну».

| Датасет | Что даёт | Как получить | Лицензия / условия | Что будем делать |
|---|---|---|---|---|
| **PURE** (TU Ilmenau) | 10 человек, ~60 видео по 1 мин, 30 к/с, 640×480; эталон — пульсоксиметр CMS50E | Заявка авторам через страницу набора: https://www.tu-ilmenau.de/universitaet/fakultaeten/fakultaet-informatik-und-automatisierung/profil/institute-und-fachgebiete/institut-fuer-technische-informatik-und-ingenieurinformatik/fachgebiet-neuroinformatik-und-kognitive-robotik/data-sets-code/pulse-rate-detection-dataset-pure (проверено: HTTP 200) | Research use only, по запросу; цитировать статью авторов, не перераспространять | Прогнать кадры через наш ROI + POS/CHROM, окна 30 с с шагом 5 с, посчитать MAE и смещение |
| **UBFC-rPPG** (Université Bourgogne Franche-Comté) | 42 видео, Logitech C920, 30 к/с, 640×480; эталон CMS50E | Страница авторов: https://sites.google.com/view/ybenezeth/ubfcrppg (проверено: HTTP 200); доступ по письму авторам | Academic use; цитирование статьи, без перераспространения | То же; отдельно — сравнение с PURE (разные камеры и свет) |
| **MMPD** (Tsinghua) | 33 человека, ~11 ч, съёмка на телефоны, разный свет и тон кожи | https://github.com/McJackTang/MMPD_rPPG_dataset (проверено: HTTP 200); полный набор — по письму авторам | Academic only, по запросу | Проверка устойчивости к тону кожи и свету — то, чего у нас нет |
| **LGI-PPGI** (Pilz et al.) | 25 человек, ~100 видео, камера C270, 25 к/с; сценарии: покой, движение, речь | https://github.com/partofthestars/LGI-PPGI-DB (проверено: HTTP 200) | В `docs/DATASETS.md` указано CC BY 4.0 — **проверить в репозитории перед использованием** | Тест на движение головы и разговор — наши слабые места |
| **iBVP** (UCL) | RGB + тепловизор, метки качества сигнала, ~400 ГБ | https://github.com/PhysiologicAILab/iBVP-Dataset (проверено: HTTP 200); полный доступ по EULA | EULA, по запросу у авторов | Метки качества — сверить с нашими гейтами (SNR, method agreement) |

### 4.1. Протокол MAE (одинаковый для любого датасета)

1. Взять видео + эталонный сигнал из набора.
2. Прогнать теми же модулями, что в приложении: `python-worker/worker/roi.py`, `signals.py`, `quality.py`.
3. Окна 30 с с шагом 5 с.
4. Считать: **MAE** = среднее |наш − эталон|; **bias** = среднее (наш − эталон); **LoA** (пределы согласия); **доля окон с отказом**.
5. Записать в `docs/VALIDATION.md` новой таблицей, с указанием датасета и лицензии.

Сверка с бытовым прибором (пульсоксиметр/часы) — отдельно и обязательна: датасет не заменяет проверку на нашем железе (`docs/VALIDATION.md` §5).

### 4.2. Чего датасеты не дают

- Не делают замер клинически валидным.
- Не описывают нашу камеру, свет и сжатие (YUY2 640×480, 15.6 к/с).
- Не дают права перераспространять видео.

---

## 5. Зависимости и их лицензии (для поля References)

Проверено по файлам лицензий в `node_modules` и `python-worker/.venv/*.dist-info` 15.11.2026.

| Компонент | Версия | Лицензия | Откуда взято |
|---|---|---|---|
| Tauri (Rust + JS API) | 2 | MIT / Apache-2.0 | `node_modules/@tauri-apps/api/LICENSE-APACHE-2.0`, `LICENSE.spdx` |
| React / React DOM | 19.1 | MIT | `node_modules/react/LICENSE` |
| TypeScript | 6.0 | Apache-2.0 | `node_modules/typescript/LICENSE.txt` |
| Vite | 8 | MIT | `node_modules/vite/LICENSE.md` |
| MediaPipe | 1.2.3 | Apache 2.0 | `mediapipe-1.2.3.dist-info` |
| OpenCV (opencv-python) | 4.14.0.94 | Apache 2.0 | `opencv_python-4.14.0.94.dist-info` |
| NumPy | 2.5.4 | BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0 | `numpy-2.5.4.dist-info` |
| SciPy | 1.18.1 | BSD-3-Clause (стиль SciPy) | `scipy-1.18.1.dist-info` |
| pytest | 9.2.0 | MIT | `pytest-9.2.0.dist-info` |
| rusqlite / SQLite | 0.37 / bundled | MIT / public domain (SQLite) | `src-tauri/Cargo.toml` |
| serde, chrono, uuid | — | MIT / Apache-2.0 | `src-tauri/Cargo.toml` |

**Что делать:** этот список либо оставить в `docs/SOURCES.md` (раздел 5) и сослаться на него в поле References, либо вынести в отдельный `docs/THIRD-PARTY.md`. Требование T&C: "Any licenses applicable to your Solution Materials must be identified in the documentation that you submit with your Solution."

---

## 6. Что нельзя утверждать без источника

| Нельзя говорить | Почему | Что говорить вместо |
|---|---|---|
| «Точность ±N уд/мин» | Сверки с эталонным прибором не было, MAE не посчитан (`docs/VALIDATION.md` §4) | «Воспроизводимость: POS и CHROM разошлись на 0.16 уд/мин. Точность против эталона не измерена» |
| «Медицинский прибор», «диагностика», «clinically validated» | Нет ни валидации, ни регуляторного статуса; T&C и критерий Validity такое не подтверждают | «Screening-support tool. It does not diagnose» (формулировка README) |
| «Оценки по правилам AHA/NHS» | Порогов в коде нет: `src/pages.tsx:773` — "Screening thresholds are not configured" | «Рамка правил построена на AHA/NHS/HRP; пороги не включены в этой версии» |
| «Используем данные NASA» | Используем текстовые ресурсы HRP, не данные; датасетов NASA по rPPG нет | «Используем NASA HRP как рамку оценки (hazards, risks)» |
| «Обучили ML-модель для пульса» | Не обучали (`docs/DECISIONS.md` Р-1, Р-3) | «ML — для восприятия (MediaPipe). Пульс — детерминированный DSP по статье» |
| «Работает на любом лице, тоне кожи и свете» | Проверен один человек, один свет, одна камера | «Проверено на одном замере; переносимость не измерена» |
| «Заменяет пульсоксиметр» | Нет сравнения | «Не заменяет прибор; при слабом сигнале отказывается выдавать число» |
| «Одобрено NASA», «проект NASA» | Прямой запрет: "NASA does not endorse any non-U.S. Government entity…" (страница челленджа) | «Создано для челленджа NASA Space Apps 2026» |
| «Open source» без файла лицензии | В репозитории нет `LICENSE`; T&C требует OSI-лицензию или Apache 2.0 по умолчанию | Добавить `LICENSE` (Apache-2.0), затем говорить |
| «Датасеты PURE/UBFC использованы» | Не использованы, доступа нет | «Датасеты запланированы для валидации MAE» |

---

## 7. Готовые строки для поля References

Копировать в форму подачи (английский, как требует PSG):

```
NASA Human Research Program. 5 Hazards of Human Spaceflight.
https://www.nasa.gov/hrp/hazards/

NASA Human Research Program. Risks of Human Spaceflight.
https://www.nasa.gov/hrp/risks/

NASA Human Research Program. Ongoing HRP Research in Space.
https://www.nasa.gov/hrp/ongoing-hrp-research/

Wang, W., den Brinker, A. C., Stuijk, S., de Haan, G. (2017).
Algorithmic Principles of Remote PPG. IEEE Trans. Biomed. Eng.
https://doi.org/10.1109/TBME.2016.2609282

de Haan, G., Jeanne, V. (2013). Robust Pulse Rate From Chrominance-Based rPPG.
IEEE Trans. Biomed. Eng. https://doi.org/10.1109/TBME.2013.2266196

Google MediaPipe. Face Landmarker (Apache-2.0).
https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker

American Heart Association. Understanding Blood Pressure Readings.
https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings

NHS. Hypothermia. https://www.nhs.uk/conditions/hypothermia/
NHS. Fever in adults. https://www.nhs.uk/conditions/fever-in-adults/
NHS. Low blood pressure (hypotension).
https://www.nhs.uk/conditions/low-blood-pressure-hypotension/

OpenCV (Apache-2.0), NumPy (BSD-3-Clause), SciPy (BSD-3-Clause),
Tauri (MIT/Apache-2.0), React (MIT), TypeScript (Apache-2.0), Vite (MIT).
Full list with licenses: docs/SOURCES.md, section 5 (in repository).
```

**Проверить перед вставкой:** ссылки AHA (HTTP 403 при автоматической проверке) и лицензию LGI-PPGI.
