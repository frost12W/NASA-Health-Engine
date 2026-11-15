# COMPLIANCE — обязательные условия подачи NASA Space Apps 2026

Проект: Health Engine (челлендж «Create Health Monitoring Software for Astronauts on Space Missions»).
Составлено: 15.11.2026, 11:20 (Asia/Bishkek). Дедлайн подачи — 15.11.2026, 23:59 по местному времени события.

Все английские цитаты — дословные, скопированы из указанного источника. Ничего не переписано и не дополнено.

## 0. Источники и обозначения

| Код | Источник | Где взят |
|---|---|---|
| **PSG** | Project Submission Guide (опубликован 13.11.2026) | https://www.spaceappschallenge.org/resources/project-submission-guide/ — скачан 15.11.2026, локальная копия: `C:\Users\Tima\Documents\spaceapps-2026\official\_live\https_www_spaceappschallenge_org_resources_project_submission_guide_.html` |
| **JAG** | Judging & Awards Guide (опубликован 13.11.2026) | https://www.spaceappschallenge.org/resources/judging-awards-guide/ — скачан 15.11.2026, локальная копия: `C:\Users\Tima\Documents\spaceapps-2026\official\_live\https_www_spaceappschallenge_org_resources_judging_awards_guide_.html` |
| **T&C** | 2026 Participant Terms & Conditions | `C:\Users\Tima\Documents\spaceapps-2026\official\legal-terms.source.html` (= https://www.spaceappschallenge.org/legal/) |
| **FAQ** | Participant FAQs | `C:\Users\Tima\Documents\spaceapps-2026\official\participant-faqs.source.html` |
| **CH** | Страница челленджа, вкладка Resources | https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/ — скачана 15.11.2026 |
| **EV** | Страница события 2026 | `C:\Users\Tima\Documents\spaceapps-2026\official\event-2026.source.html` |

Статусы: **выполнено** / **частично** / **не выполнено** / **требует действия** / **неизвестно**.

---

## 1. Обязательные условия подачи

### 1.1. Сводная таблица

| № | Требование | Дословная цитата (en) | Перевод | Источник | Статус у нас |
|---|---|---|---|---|---|
| 1 | Отклик на официальный челлендж | "Respond to one of the official NASA Space Apps Challenges." | Ответить на один из официальных челленджей NASA Space Apps. | JAG | **выполнено** — челлендж Health Monitoring Software |
| 2 | Все участники зарегистрированы, один и тот же Local Event, есть во вкладке Members | "Ensure that all team members are registered for the NASA Space Apps Challenge, have chosen the same Local Event (and are not waitlisted) or Universal Event, and appear on the Members tab of your Team's page." | Убедиться, что все участники зарегистрированы, выбрали одно и то же событие (и не в листе ожидания) и отображаются во вкладке Members. | JAG | **неизвестно** — проверить на странице команды |
| 3 | Размер команды: 1–6 человек | "Local Event teams must have at least one (1) person and Universal Event teams must have at least two (2) people to be eligible for global judging. Teams may have no more than six (6) members." | В Local Event минимум 1 человек, в Universal Event минимум 2; больше 6 человек нельзя. | JAG / FAQ | **неизвестно** — проверить состав |
| 4 | Заполнены все обязательные поля формы | "Complete all of the required fields on the Project Submission page." | Заполнить все обязательные поля страницы подачи проекта. | JAG | **не выполнено** |
| 5 | Демо: видео ≤ 30 с **или** колода ≤ 7 слайдов | "Provide a short demonstration ("demo") of your project, either in the form of a 7-slide presentation (including title and introductory slides) or a 30-second or less video presentation." | Короткое демо: либо презентация до 7 слайдов (включая титульный и вводный), либо видео не длиннее 30 секунд. | JAG / PSG | **частично** — видео `docs/media/health-engine-30s.mp4` = ровно 30 с, но публичной ссылки нет |
| 6 | Ссылка на демо публичная, без пароля и регистрации | "The link you provide should not require a password, permission, or registration in order to access your project demo." | Ссылка на демо не должна требовать пароля, разрешения или регистрации. | PSG | **не выполнено** |
| 7 | Ссылка на финальный проект публичная | "The link you provide should not require a password, permission, or registration in order to access your final project." | То же для ссылки на финальный проект (код/сайт/репозиторий). | PSG | **не выполнено** — репозиторий `github.com/frost12W/NASA-Health-Engine` нужно проверить на публичность |
| 8 | Видео и документы нельзя загрузить на сайт — только внешний хостинг | "The Project page DOES allow for the upload or copy/paste of images (JPG, PNG, GIF up to 10MB). However, it DOES NOT allow for the upload of videos or documents." | На страницу проекта можно вставлять только изображения до 10 МБ; видео и документы — нельзя, только ссылкой. | PSG | **требует действия** — выложить видео (YouTube/Drive/GitHub) |
| 9 | Если судья не откроет ссылку — проекта нет | "If judges can't access your project, it can't be evaluated or judged." | Если судьи не смогут открыть проект, его не оценят. | PSG | **требует действия** — проверить ссылки в приватном окне браузера |
| 10 | Английский язык на странице подачи и в связанных материалах | "You must use English language on the project submission page and in any linked materials." | Страница подачи и все связанные материалы — на английском. | PSG | **частично** — README на английском, `docs/*.md` и часть интерфейса на русском |
| 11 | Исключение: видео может быть на другом языке, но с английскими субтитрами | "There is an exception: If your team chooses to create a video for the Project Demo, you can speak in another language, however, it MUST include English language subtitles. Slide decks must be in English." | Видео можно на другом языке, но обязательно с английскими субтитрами; слайды — только на английском. | PSG | **выполнено** — `docs/media/health-engine-30s.srt` (английские субтитры) |
| 12 | Лимиты 30 с / 7 слайдов — жёсткие | "Limitations: Adhere to the 30-second and 7-slide limits. Projects that exceed these limits will not be eligible for Global Judging." | Превышение лимитов = проект не допускается к Global Judging. | PSG | **выполнено** — 00:00:30 по метаданным файла |
| 13 | Дедлайн: кнопка Submit for Judging до 15.11, 23:59 местного времени | "You must click the "Submit for Judging" button prior to Sunday, November 15 at 11:59 p.m. local time of your Local Event." | Нажать «Submit for Judging» до воскресенья 15 ноября, 23:59 по времени своего Local Event. | PSG | **требует действия** — сегодня последний день |
| 14 | Чекбокс 1: согласие с требованиями и T&C | "I have read and understand the project submission requirements as contained in the NASA Space Apps Project Submission Guide, and I agree to the Participant Terms and Conditions and Privacy Policy." | «Я прочитал и понимаю требования к подаче… и согласен с T&C и Privacy Policy». | JAG / PSG | **не выполнено** |
| 15 | Чекбокс 2: оригинальная работа + все внешние ресурсы перечислены в References | "I confirm that the submitted project represents my team's original work and that all external resources including code, text and images (even if they are open source or freely available) used in the project are listed in the References field of the project submission form. In creating our solution, my team has not used any copyrighted materials (i.e., music, images, text, etc.) that we don't have permission to use." | «Подтверждаю, что проект — наша оригинальная работа, а все внешние ресурсы (код, текст, изображения, даже open source) перечислены в поле References. При создании решения не использовались материалы, на которые у нас нет прав». | JAG / PSG | **не выполнено** — References ещё не собран (база — `docs/SOURCES.md`) |
| 16 | В демо и финальном проекте нет изображений/голоса/видео лиц младше 18 лет | "Project demonstrations and final projects may not include any images, video, audio, or other likeness to persons under 18 years old per the NASA Space Apps Terms & Conditions." | Нельзя показывать людей младше 18 лет. | PSG / T&C | **требует проверки** — в видео есть кадры с камеры (предпросмотр лица): подтвердить, что в кадре нет лиц младше 18 лет |
| 17 | Видео — собственная работа, без нарушения чужих прав, с согласием людей в кадре | "When submitting and/or editing video(s) for NASA Space Apps, you do represent and warrant to NASA that the video was produced and/or edited by you the undersigned (i.e. your original work), the contents of the video (including documents, photographs, audio recordings, video recordings, or other shown) do not infringe the copyright or any other right of any third party…" | Гарантируем: видео создано нами, не нарушает права третьих лиц; на людей в кадре есть согласие. | T&C | **требует проверки** — если в кадре лицо автора, нужно его согласие (T&C: "by submitting such material you represent and warrant that such individual agrees that NASA may use such individual's name and likeness"); проверить музыку, шрифты, чужие кадры |

### 1.2. Требования к содержанию формы (поля)

Дословно из PSG, раздел «Project Page Form Field Instructions»:

| Поле | Дословная формулировка (en) | Что писать у нас |
|---|---|---|
| Project Name | "What is the name of your project?" | Health Engine |
| High-Level Project Summary | "Provide a high-level summary of your project. What did you develop? How does it address the challenge? Why is it important?" | Офлайн-приложение: дневник показателей → оценка → действие → тренд |
| Link to Project Demo | "Provide a short demonstration ("demo") of your project, either in the form of a 7-slide presentation (including title and introductory slides) or a 30-second or less video presentation." | Ссылка на видео 30 с + субтитры |
| Link to Final Project | "Share a publicly accessible link to your final project. This can be a website you created to showcase your project, a cloud-based hosting service or code repository…" | Ссылка на GitHub-репозиторий |
| Detailed Project Description | "Provide additional details about your project. Some questions to consider are: What exactly does it do? How does it work? What benefits does it have? What do you hope to achieve? What tools, coding languages, hardware, or software did you use to develop your project?" | Tauri 2 + React + Rust + Python (OpenCV, MediaPipe), SQLite |
| Use of Super Intelligence (SI) | "Did you utilize any Super Intelligence (SI) tools and software in preparing your solution? If yes, how did you use them?" | См. §3.3 — обязательно заполнить |
| NASA Data | "Provide specific details about what NASA data and resources you used. To be eligible for a Global Award, you must use at least one NASA data or resource." | HRP: 5 Hazards, Risks, Ongoing HRP Research (см. `docs/SOURCES.md`) |
| Space Agency Partner Data and Other References | "List all of the data, resources, and tools used in your project. Resources should include any code, text, and images (even if they are open source or freely available) that you used when creating your project." | Таблица из `docs/SOURCES.md` |

### 1.3. Сценарий демо-видео (рекомендация организаторов, дословно)

Из PSG, раздел «Tips for Creating a Project Demo»:

> "Video Demo: The video pitch must be 30 seconds or less. [0:00] Introduce yourself: What is your name and your team's name? [0:02] Lead us in: What challenge does your project address? What inspired you to choose this challenge? [0:05] Name your project: Share your project's title and tagline to catch your audience's attention. Titles should be short but can indicate what problem the project solves or what people gain from your project. [0:10] Describe your idea: How does it work? Display images or a prototype, describe a user's experience, and share how using NASA's free and open data and Space Agency Partner data made your proposed solution possible. [0:20-0:30] Look into the future: Paint a picture! Captivate your audience with what it could be; What can your proposed solution do for people, the world, and beyond?"

Для слайдов обязателен состав: "Team name", "Names of team members", "The challenge your team selected".

**Наш разрыв:** в субтитрах `health-engine-30s.srt` нет имени и названия команды, нет явного «какой челлендж и почему», блок про NASA-данные отсутствует. Тайминги не совпадают с рекомендованными (0:00 — сразу продукт).

---

## 2. Критерии оценки

Дословно из JAG:

> "At every level of judging, from Local and Universal Events to Executive Judging, your project will be evaluated on a scale of 1-to-5, in each of the following criteria: Impact, Creativity, Validity, Relevance, Presentation."

Пять критериев, точные названия: **Impact, Creativity, Validity, Relevance, Presentation**.

### 2.1. Описания критериев (дословно) и наши позиции

| Критерий | Дословное описание (en) | Дословный «Score of 5» (en) | Чем закрываем | Риск |
|---|---|---|---|---|
| **Impact** | "This project makes an impact by addressing either a minor or major problem, which influences the quality and quantity of its overall effect. The extent to which it inspires or helps others varies, ranging from a broad audience to a select few." | "This project demonstrates exceptional impact, addressing a significant problem with proposed solutions. Its reach is extensive, inspiring, benefits a large audience, or could change the world. The quality and effectiveness of the project far exceeds expectations, setting a high standard for others." | Экипаж без врача на борту; офлайн-работа; отказ от ложного числа | Замер один, на одном человеке — «reach» доказать нечем |
| **Creativity** | "This project demonstrates originality and innovation. It introduces a novel concept that has not been attempted before or presents an improvement upon existing ideas in a meaningful way. This project is distinguished by its level of creativity, showcasing a fresh perspective or inventive execution." | "This project showcases remarkable creativity, introducing a groundbreaking approach that has never been attempted before. It challenges conventional methods, presenting an original and inventive proposed solution that stands out in its field. The uniqueness of the idea makes it a true innovation." | Гейты качества, которые отказываются выдавать пульс; привязка показателя к опасности HRP | rPPG — не новинка; «groundbreaking» не заявляем |
| **Validity** | "This project presents a proposed solution that is grounded in scientific principles and demonstrates technical, functional, or logical feasibility. It is designed to effectively achieve its intended purpose and has the potential to function in real-world applications. The completeness of the proposed solution varies—it may be fully developed or still require significant refinement. Additionally, the usability and user-friendliness of the project influence its practicality and accessibility." | "This proposed solution is scientifically sound and technically feasible, demonstrating strong alignment with established principles. It is fully developed and ready for real-world implementation, effectively achieving its intended purpose. The project is highly usable and user-friendly, making it accessible and practical for widespread application." | POS/CHROM по статьям; расхождение методов 0.16 уд/мин; 2 отказа с причиной | **Главный риск:** MAE против эталона не посчитан (`docs/VALIDATION.md` §4) |
| **Relevance** | "This project fully and directly addresses the challenge for which it was submitted, demonstrating a strong alignment with the intended objectives. It meaningfully integrates NASA data, utilizing it as a core component of the proposed solution rather than a superficial addition. The depth of engagement with the data enhances the project's credibility and effectiveness." | "This project thoroughly engages with the challenge, delivering a proposed solution that is deeply connected to the intended goals. NASA data is integral to the project's success, providing meaningful insights that drive the innovation forward. The use of data is well-executed, enhancing both the credibility and impact of the solution." | Челлендж прочитан; HRP используется как рамка оценки и эскалации | **Второй риск:** «NASA data integral» — у нас методическая рамка, а не данные; в коде HRP не зашит |
| **Presentation** | "The team effectively communicated their project, clearly conveying the challenge, their proposed solution, and its significance. The storytelling was engaging and well-structured, ensuring the audience understood the project's purpose and impact. The clarity, organization, and delivery of their presentation played a key role in making their ideas compelling and clear. Judges evaluate the demo and full project to compute this score." | "The team delivered a well-structured and compelling presentation, clearly articulating the challenge, proposed solution, and importance of the project. Their storytelling was engaging, allowing the audience to fully grasp the significance and potential impact of the work. The delivery was polished, structured, and highly effective in communicating their ideas." | Видео 30 с + субтитры; README; скриншоты | Видео не по рекомендованной раскадровке; интерфейс частично на русском |

### 2.2. Что организаторы подчёркивают отдельно

> "While many NASA Space Apps Challenge teams consider the first four judging criteria carefully and excel at developing projects with great potential, remember to pay equal attention to the final criterion: presentation."

> "Note: a strong project demo can increase the potential for a high score in the Presentation category of the judging rubric."

> "This demo will be considered in your overall project evaluation, but the majority of judges' evaluation will be based on your project submission."

**Вывод:** страница подачи важнее видео. Тексты на странице подачи — первичны.

### 2.3. Десять глобальных наград (для ориентира)

> "Best Use of Science: The project that makes the best and most valid use of the scientific method. Best Use of Data: The project that best makes space data accessible or leverages it to a unique application. Best Use of Technology: The project that exemplifies the most innovative use of technology. Galactic Impact: The project with the most potential to improve life on Earth or the universe. Best Mission Concept: The project with the most plausible concept and design. Most Inspirational: The project that captures our hearts. Best Storytelling Award: The project that most creatively communicates the potential of open data through the art of storytelling. Global Connection Award: The project that best connects people around the world through technology. Art & Technology Award: The project that most effectively combines technical and creative skills. Local Impact Award: The project that demonstrates the greatest potential for making a difference in their local community."

Наши ближайшие: **Best Use of Science** (метод из статей + гейты) и **Best Mission Concept** (офлайн, без сети, реальные ограничения железа).

---

## 3. Правила по данным и ИИ

### 3.1. Лицензия на собственный код

T&C, раздел «INTELLECTUAL PROPERTY RIGHTS IN SOLUTIONS»:

> "All posted Solutions will be available for others to download or use. You agree that any original content (that is, content that you have created for the NASA Space Apps Challenge) is freely available without restriction or is licensed as open source as defined by the Open Source Initiative (OSI): https://www.opensource.org/docs/osd. If you do not specify a specific OSI compliant license, NASA will distribute your original content under an Apache 2.0 license. See https://www.opensource.org/licenses/Apache-2.0."

**Перевод:** любой загруженный проект открыт для скачивания и использования. Свой контент либо свободен без ограничений, либо под OSI-лицензией; если лицензия не указана — NASA раздаёт его под Apache 2.0.

**У нас:** файла `LICENSE` в репозитории нет (проверено 15.11.2026). Видео заканчивается словами "Open source." — заявление без лицензии. **Требует действия:** добавить `LICENSE` (Apache-2.0) в корень.

### 3.2. Сторонние материалы: лицензия + цитирование

T&C, раздел «USE OF THIRD-PARTY MATERIALS»:

> "If your Solution requires the use of non-NASA materials (such as a dataset or code that does not originate from NASA or other space agency partners) (your "Solution Materials"), you are responsible for ensuring that your Solution Materials are freely and publicly available without restriction or, at a minimum, are also licensed as open source as defined by the Open Source Initiative: http://www.opensource.org/docs/osd. … You are solely responsible for all required verification or investigation of the requisite public availability of your Solution Materials prior to submitting your Solution. You are also solely responsible for ensuring that your Solution and Solution Materials do not contain any export-controlled information pursuant to the International Traffic in Arms Regulations or the Export Administration Regulations. Any licenses applicable to your Solution Materials must be identified in the documentation that you submit with your Solution. NASA will not accept or post any Solutions that do not include appropriate license documentation for your Solution Materials. You must cite every source that is used in the creation of your project, even if it is open source or freely available. NASA reserves the right to remove Solution Materials that do not cite references and resources appropriately (you will be prompted to submit references on the Project Submission form). NASA also reserves the right to remove nominations, awards, or winner status from teams that do not cite resources used in their Solution; all resources, even open source resources, must be cited."

**Что обязаны:**
1. Все сторонние материалы — публично доступны или под OSI-лицензией.
2. Их лицензии — **указаны в документации** проекта.
3. Процитирован **каждый** источник, даже open source.
4. Нет export-controlled информации.

**Санкция:** без лицензионной документации работу не примут и не опубликуют; за нецитирование снимают номинации и статус победителя.

**У нас:** лицензии зависимостей нигде не сведены (проверено: в `README.md` раздела источников нет). Черновик сводки — `docs/SOURCES.md`, раздел 5. **Требует действия.**

### 3.3. ИИ / SI: разрешено, но обязательно раскрыть

FAQ, «What is Super Intelligence? Can teams utilize it during the hackathon?»:

> "In accordance with the September 29, 2026 U.S. Executive Order, "the executive branch shall use the terms 'Super Intelligence' and 'SI' in place of 'Artificial Intelligence' and 'AI.'""

> "Super Intelligence (SI) refers to computer systems that perform tasks typically associated with human reasoning, decision-making, content creation, and problem-solving. Examples include large language models, conversational assistants, image and video generation tools, foundation models, and code generation tools."

> "Participants may use SI tools to accelerate innovation, streamline development, and enhance creativity in support of their challenge solution. Each team's project submission must include a description of how SI tools were used during the development of their project."

PSG, поле «Use of Super Intelligence (SI)»:

> "The use of SI tools, such as machine learning, chatbots, image generation, and large language models, is permitted for the NASA Space Apps Challenge and should be used as a tool to accelerate innovation and creativity for your challenge solution. SI should not be used to (come up with your idea of how to solve the challenge). Generated content may not use, contain, or modify any NASA branding or design elements (such as the NASA logos, flags, or mission identifiers)."

> "We require that you clearly indicate where and how SI tools were utilized in your project, including: Images and videos: Must include a visible watermark to indicate SI generation. Audio: Must acknowledge SI generation in descriptive text and metadata. Code and data: Must acknowledge SI generation in descriptive text and metadata."

> "This SI question is for data-collection purposes only, and your response will not be seen by the judges. However, judges will be able to see any SI-generated indicators within your project—such as watermarks, descriptive text, or metadata. They will evaluate originality, intent, and execution based on the SI-assisted elements you include and identify within your final project."

**Итого по SI:**
- Разрешено: код, тексты, изображения, видео — с раскрытием.
- Запрещено: SI как источник идеи решения; NASA-брендинг в сгенерированном контенте.
- Обязательно: описание, где и как использованы SI-инструменты; видимый водяной знак на SI-изображениях и видео; пометка в тексте и метаданных для аудио, кода и данных.
- Ответ на вопрос SI судьи не видят, но следы (водяные знаки, пометки) — видят.

**У нас:** раскрытия нет ни в репозитории, ни в документах. **Требует действия** — заполнить поле и добавить `docs/AI-USAGE.md` (или раздел в README).

### 3.4. NASA не поддерживает проект

CH, вкладка Resources, перед списком ресурсов:

> "NASA does not endorse any non-U.S. Government entity and is not responsible for information contained on non-U.S. Government websites. For non-U.S. Government websites, participants must comply with any data use parameters of that specific website."

**Перевод:** NASA не поддерживает никакие негосударственные организации и не отвечает за информацию на негосударственных сайтах; для негосударственных сайтов нужно соблюдать их условия использования данных.

**Следствие для нас:** нельзя писать «одобрено NASA», «при поддержке NASA», использовать логотип NASA. В README и на странице подачи — только «создано для челленджа NASA Space Apps 2026».

### 3.5. Что ещё нельзя в заявке

T&C, «SUBMISSIONS» — работа не принимается, если содержит:

> "Proprietary or business sensitive information that you do not have the right to make public; Solutions submitted for which you do not hold the copyright or other intellectual property rights; or Personally Identifiable Information (e.g., birthdays, social security numbers, home addresses, home phone numbers)."

**У нас:** в базе и на скриншотах не должно быть реальных ФИО, дат рождения, адресов. Проверить скриншоты и демо-данные перед публикацией.

### 3.6. Обязательный минимум по NASA-данным

PSG, поле «NASA Data»:

> "Provide specific details about what NASA data and resources you used. To be eligible for a Global Award, you must use at least one NASA data or resource."

**У нас:** используем материалы HRP (5 Hazards, Risks, Ongoing HRP Research) — это ресурсы NASA, но **не данные**. Формулировать честно: «NASA HRP used as the assessment framework», без слова «dataset».

---

## 4. Чек-лист перед сабмитом

Отметки: `[x]` — готово, `[ ]` — не готово.

### Блок A. Форма и ссылки

- [ ] **A1.** Все обязательные поля формы заполнены на английском.
- [ ] **A2.** Ссылка на демо открывается в приватном окне без логина.
- [ ] **A3.** Ссылка на финальный проект (GitHub) открывается без логина; репозиторий публичный.
- [ ] **A4.** Видео загружено на внешний хостинг (YouTube/Drive/GitHub Releases).
- [ ] **A5.** Субтитры `.srt` приложены или вшиты в видео.
- [ ] **A6.** Поле «NASA Data» заполнено (HRP: hazards / risks / ongoing research).
- [ ] **A7.** Поле References заполнено по `docs/SOURCES.md` — включая open source.
- [x] **A8.** Длительность видео ≤ 30 с (проверено: 00:00:30).
- [x] **A9.** Видео с английскими субтитрами (`health-engine-30s.srt`).

### Блок B. Лицензии и цитирование

- [ ] **B1.** `LICENSE` (Apache-2.0) в корне репозитория.
- [ ] **B2.** Лицензии сторонних зависимостей перечислены в документации (`docs/SOURCES.md`, раздел 5).
- [ ] **B3.** Лицензия модели MediaPipe (`face_landmarker.task`, Apache-2.0) указана явно.
- [ ] **B4.** В README есть раздел «Sources / References» со ссылкой на `docs/SOURCES.md`.
- [ ] **B5.** Нет утверждения «Open source» без файла лицензии (сейчас в видео есть — до B1 расхождение).

### Блок C. ИИ / SI

- [ ] **C1.** Поле «Use of Super Intelligence (SI)» заполнено по факту.
- [ ] **C2.** В репозитории есть раскрытие использования SI (файл или раздел README).
- [ ] **C3.** На SI-изображениях/видео — видимый водяной знак; в коде и данных — пометка в тексте и метаданных.
- [ ] **C4.** В сгенерированном контенте нет логотипов, флагов и идентификаторов миссий NASA.
- [ ] **C5.** Идея решения описана как собственная, не «придумана ИИ».

### Блок D. Содержание и честность

- [ ] **D1.** Нет слов «diagnosis», «medical device», «clinically validated», «accuracy ±N».
- [ ] **D2.** Точность сформулирована как «reproducibility 0.16 bpm between methods; accuracy vs. reference not measured».
- [ ] **D3.** Заявление «оценки по правилам AHA/NHS» либо подтверждено кодом, либо переформулировано (сейчас порогов в коде нет).
- [ ] **D4.** Скриншоты без персональных данных (ФИО, дата рождения, адрес).
- [ ] **D5.** В кадре нет людей младше 18 лет.
- [ ] **D6.** Нет чужих изображений, музыки, шрифтов без прав.
- [ ] **D7.** Нет формулировок «одобрено NASA» / «NASA project».
- [ ] **D8.** Если в кадре лицо автора — есть его согласие (T&C, media release).
- [ ] **D9.** Логотип и иконки проекта не воспроизводят NASA insignia / флаги / идентификаторы миссий.

### Блок E. Команда и подача

- [ ] **E1.** Все участники в одном Local Event, отображаются во вкладке Members.
- [ ] **E2.** Состав 1–6 человек.
- [ ] **E3.** В демо указаны название команды и имена участников (требование к слайдам; для видео — рекомендация).
- [ ] **E4.** Чекбокс T&C отмечен.
- [ ] **E5.** Чекбокс «Confirm All Work is Original» отмечен.
- [ ] **E6.** Нажата кнопка «Submit for Judging» до 15.11.2026, 23:59 местного времени.
- [ ] **E7.** После подачи проверено письмо/баннер подтверждения и сертификат в профиле.

### Блок F. Усиление оценки (не обязательно, но влияет на балл)

- [ ] **F1.** Скриншоты интерфейса на странице подачи (JPG/PNG ≤ 10 МБ).
- [ ] **F2.** MAE против эталонного прибора — хотя бы 5–7 пар (`docs/VALIDATION.md` §5).
- [ ] **F3.** Английские подписи интерфейса в кадрах демо или пояснение в субтитрах.
- [ ] **F4.** Слайд/абзац «какая опасность HRP → какой показатель → какое действие».

---

## 5. Чего в правилах НЕТ (проверено поиском)

| Вопрос | Что найдено | Вывод |
|---|---|---|
| Минимальная длительность видео | Есть только верхняя граница: «30 seconds or less». Требования «не короче N» нет | Ограничение только сверху |
| Требование клинической валидности или точности измерений | В PSG/JAG/T&C/CH таких требований нет. Ближайшее — критерий Validity: "grounded in scientific principles and demonstrates technical, functional, or logical feasibility" | Точность не требуют, но Validity оценивают |
| Обязательный open source именно для кода | Отдельного пункта нет. Есть общее правило про «original content» (§3.1) и сторонние материалы (§3.2) | Де-факто код должен быть открыт |
| Обязательный датасет или ML | Нет ни в PSG, ни в JAG, ни в CH | Не требуется |
| Требование указывать состав команды внутри проекта | Для слайдов — да ("Team name", "Names of team members"); для видео — в рекомендациях ("What is your name and your team's name?") | Для видео не жёстко |
| Фраза «NASA does not endorse» как обязательная надпись в проекте | Найдена только на странице челленджа как дисклеймер организаторов (§3.4). Требования вставлять её в свой проект нет | Рекомендуется продублировать в README |
| Требование скриншотов в заявке | Нет. Есть разрешение вставлять изображения (JPG/PNG/GIF ≤ 10 МБ) | Не обязательно, но усиливает Presentation |
| Требование указывать версии ПО и железо | Нет | Наша инициатива |

---

## 6. Три главных вывода

1. **Дедлайн — сегодня.** Незакрытые пункты A2, A3, A7, B1, C1 блокируют подачу или снимают работу с номинации.
2. **Лицензия и цитирование — не формальность.** T&C прямо разрешает NASA снять номинацию за нецитирование. Файла `LICENSE` нет — это первое, что нужно закрыть.
3. **Заявление «правила AHA/NHS» в питче сильнее, чем код.** В `src/pages.tsx:773` написано: "Screening thresholds are not configured, so pulse numbers are not turned into health grades." Либо пороги появляются, либо формулировка меняется на «правила заданы, пороги не включены».
