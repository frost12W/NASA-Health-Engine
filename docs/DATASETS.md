# Датасеты для rPPG: где брать и зачем

В проекте машинного обучения нет: пульс считается алгоритмом POS/CHROM (Wang 2017,
de Haan 2013). Датасет нужен не для работы приложения, а чтобы доказать точность
(MAE) или — при желании — обучить модель, устойчивую к слабому сигналу.

## Что даёт NASA

Ничего из этого не является датасетом с видео лица и эталонным пульсом.

| Источник | Содержание | Ссылка |
|---|---|---|
| Resources челленджа | 5 Hazards, Risks, Ongoing HRP Research, две статьи CSA | https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/ |
| HRP | описание опасностей и рисков | https://www.nasa.gov/hrp/hazards/ |
| HRP Risks | риски для здоровья | https://www.nasa.gov/hrp/risks/ |
| OSDR | биологические данные, без видео лица | https://science.nasa.gov/biological-physical/data/ |

Вывод: научную рамку NASA даёт, данные для валидации — нет.

## Внешние датасеты

| Датасет | Что внутри | Объём | Доступ | Контакт |
|---|---|---|---|---|
| **PURE** | 10 человек, 60 видео по 1 мин, 30 Гц, 640×480, эталон CMS50E | несколько ГБ | заявка на сайте TU Ilmenau | страница Pulse Rate Detection Dataset |
| **UBFC-rPPG** | 42 видео, Logitech C920, 30 к/с, 640×480, CMS50E | десятки ГБ | письмо авторам (OneDrive закрыт) | yannick.benezeth@u-bourgogne.fr |
| **MMPD** | 33 человека, 11 ч, телефоны, разный свет и тон кожи | 48 ГБ (mini) / 370 ГБ | письмо, academic only | tjk24@mails.tsinghua.edu.cn |
| **LGI-PPGI** | 25 человек, 100 видео, C270 25 к/с | десятки ГБ | CC BY 4.0, раздача сейчас закрыта | репозиторий авторов |
| **iBVP** | RGB + тепловизор, 400 ГБ | — | EULA от научрука | UCL |

Все — только для исследований, с цитированием статьи авторов и без перераспространения.

## Шаблон письма

> Subject: Request for <PURE / UBFC-rPPG> dataset — NASA Space Apps 2026 team
>
> Dear Prof. <name>,
>
> We are a student team in the NASA Space Apps Challenge 2026 (health monitoring).
> We implemented POS/CHROM and want to validate against a reference signal.
> We need 2–5 recordings for validation only, will cite your paper and will not
> redistribute the data.
>
> Thank you, <name>, <university>, <email>

## Как использовать, когда данные придут

1. Видео + эталонный PPG из папки датасета.
2. Прогнать кадры через ROI и POS/CHROM (тем же кодом, что в `python-worker/worker/`).
3. Окна по 30 с с шагом 5 с, сравнить с эталоном: MAE, смещение, пределы согласия,
   доля окон с отказом.

## Ограничения

- Датасет не заменяет сверку с прибором для нашего железа: камера, свет и сжатие
  у нас другие.
- Наличие датасета не делает замер клинически валидным.
