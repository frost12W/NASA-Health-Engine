# Use of Super Intelligence (SI) tools — disclosure

Required by the NASA Space Apps 2026 Project Submission Guide: a team must
describe where and how it used AI/SI tools. This file is that description.
Last updated: 15.11.2026.

## Where AI was used

| Area | Tool | What exactly it did | Who verified the output |
|---|---|---|---|
| Application code (Tauri shell, React UI, Rust storage, Python worker) | OpenAI Codex | Drafted and edited the source code from the team's technical specification | Team lead reviewed behaviour, ran the app, approved the design decisions |
| Analysis, validation and documentation | DeepSeek Harness assistant | Reviewed the code, ran the test suites, extracted measurement results from SQLite, wrote `docs/VALIDATION.md`, `docs/DATASETS.md`, `docs/PITCH.md`, `docs/COMPLIANCE.md`, `docs/SOURCES.md` | Team lead checked the numbers against the database |
| Product video | Scripted rendering (Python + FFmpeg) with assistant-written text | Assembled the 30-second video from a real application screenshot and typography | Team lead approved the wording |
| Text of this repository | Assistant | Wording, translations, tables | Team lead accepts responsibility |

## What AI did not do

- The project idea, the challenge choice and the product scope were set by the team.
- No AI tool produced a measurement. Pulse numbers come from the POS/CHROM
  algorithms running in `python-worker`, and every published number passed the
  quality gates in `worker/quality.py`.
- AI did not invent sources: every reference in `docs/SOURCES.md` was fetched
  and checked for availability (HTTP status recorded) on 15.11.2026.
- No AI-generated imagery is used in the product or in the video. The video
  contains a screenshot of the running application and text drawn
  programmatically.

## Visible marking

- Video: the closing card states that the video was assembled with AI
  assistance.
- Text and code in this repository: this file is the marking required for
  code and data; the README links to it.
- No images in the product are AI-generated, so no visual watermark is needed
  inside the application itself.

## Limitations the team accepts

- AI-written code can contain defects. The team runs `cargo test` (9 tests)
  and `python-worker` pytest (15 tests) before changes are published.
- AI-written prose can overstate results. Statements about the pulse
  measurement are limited to what `docs/VALIDATION.md` proves.
- The team, not the AI tools, is responsible for the submission.
