# Real-Time AI Attendance System: Complete Build Plan

Walk-through face attendance on existing CCTV. Entry and exit cameras feed
detection, tracking, recognition and line-crossing. Events land in Postgres and
a live dashboard. Everything runs on-premise on CPU.

---

## 1. Goals and non-goals

**Goals**
- Identify employees while walking, with no cards, PINs or stopping.
- Log entry, exit and time inside per person.
- Live dashboard: who is inside now, activity feed with a snapshot per event, live camera view.
- Log unrecognized people as unknown visitors.
- On-prem only. Face data never leaves the organization.

**Non-goals (v1)**
- Multi-site federation, mobile app, payroll integration (export CSV only).
- Anti-spoofing beyond basic liveness heuristics (see Phase 9).

**Success metrics**
| Metric | Target |
|---|---|
| Recognition accuracy (enrolled staff, good angle) | >= 95% |
| False accept rate (wrong person named) | <= 0.5% |
| Direction accuracy | >= 98% |
| Event latency (crossing to dashboard) | < 2 s |
| Pipeline FPS per camera on CPU | >= 5 stable, dropped frames < 10% |
| Uptime | 99% in working hours |

---

## 2. Architecture

```
 Entry cam ─┐
            ├─► Capture workers ─► Detector (YOLO) ─► Tracker (ByteTrack)
 Exit cam  ─┘                                              │
                                                           ▼
                                      Face recognizer (InsightFace) ─► Identity voting per track
                                                           │
                                                           ▼
                                           Line-crossing / state machine
                                                           │
                                       ┌───────────────────┴───────────────────┐
                                       ▼                                       ▼
                           PostgreSQL + pgvector                      Event bus (Redis pub/sub)
                           (people, embeddings, events, sessions)                 │
                                       ▲                                          ▼
                                       └────────────── FastAPI ◄──── WebSocket ──► Next.js dashboard
```

**Services (Docker Compose)**
| Service | Role |
|---|---|
| `pipeline` | One process per camera: capture, detect, track, recognize, crossing. |
| `api` | FastAPI: REST, WebSocket, MJPEG/snapshot serving, enrollment. |
| `web` | Next.js dashboard. |
| `db` | PostgreSQL 16 + pgvector. |
| `redis` | Event fan-out between pipeline and API. |
| `proxy` | Caddy or Nginx with TLS and auth in front of api and web. |

---

## 3. Tech stack

- **Language/runtime:** Python 3.11, Node 20.
- **Detection:** Ultralytics YOLO (nano), exported to OpenVINO IR.
- **Tracking:** ByteTrack via `supervision` or `boxmot`.
- **Recognition:** InsightFace (`buffalo_s` to start, `buffalo_l` if CPU allows), ArcFace 512-d embeddings.
- **Inference runtime:** OpenVINO on CPU. Pin versions.
- **DB:** PostgreSQL + pgvector (HNSW or IVFFlat index, cosine).
- **API:** FastAPI, SQLAlchemy 2, Alembic, Pydantic.
- **Frontend:** Next.js (App Router), Tailwind, WebSocket client.
- **Ops:** Docker, Compose, Prometheus + Grafana (optional), structured JSON logs.

---

## 4. Repository layout

```
attendance/
├─ docker-compose.yml
├─ .env.example
├─ pipeline/
│  ├─ capture.py          # RTSP reader, latest-frame-only
│  ├─ detector.py         # YOLO + OpenVINO
│  ├─ tracker.py          # ByteTrack wrapper (FPS-aware)
│  ├─ recognizer.py       # InsightFace + embedding cache
│  ├─ identity.py         # per-track voting
│  ├─ crossing.py         # line geometry + state machine
│  ├─ publisher.py        # DB write + Redis publish
│  ├─ config.py           # camera + line config
│  └─ main.py
├─ api/
│  ├─ main.py
│  ├─ routers/ (people, events, presence, cameras, enroll, auth)
│  ├─ models.py, schemas.py, db.py
│  └─ migrations/
├─ web/
│  └─ app/ (dashboard, people, events, cameras, settings)
├─ tools/
│  ├─ replay.py           # run pipeline on a video file
│  ├─ enroll_cli.py
│  └─ evaluate.py         # accuracy + direction benchmark
├─ tests/
└─ docs/
```

---

## 5. Data model

```sql
people(id, employee_code, name, department, active, consent_at, created_at)
face_embeddings(id, person_id FK, embedding vector(512), quality, source_image_path, created_at)
cameras(id, name, rtsp_url, role ENUM('entry','exit','both'), line_json, roi_json, fps_target, enabled)
events(id, ts, camera_id FK, person_id FK NULL, kind ENUM('entry','exit'),
       is_unknown bool, confidence float, track_id, snapshot_path, session_id FK NULL)
sessions(id, person_id FK, entered_at, exited_at NULL, duration_s NULL)
visitors(id, first_seen, last_seen, embedding vector(512), label NULL)   -- optional unknown clustering
audit_log(id, ts, user, action, detail)
```

Indexes: `events(ts DESC)`, `events(person_id, ts)`, `sessions(person_id, exited_at)`,
HNSW on `face_embeddings.embedding vector_cosine_ops`.

---

## 6. Pipeline design (the core)

### 6.1 Capture
- One thread per stream. Always keep only the **latest** frame; drop stale ones.
- Reconnect with backoff on RTSP loss. Expose measured input FPS.
- Prefer the camera's sub-stream (e.g. 720p) for the pipeline, with the main stream only for snapshots if needed.

### 6.2 Detection
- YOLO nano, person class only, imgsz 640 (try 480 if CPU-bound).
- Export once to OpenVINO; load at startup. Assert at boot that the OpenVINO device is CPU with acceleration active (log it).
- Optional ROI mask to ignore irrelevant areas.

### 6.3 Tracking
- ByteTrack with `frame_rate` set to the **measured** stream FPS, not 30. Scale `track_buffer` accordingly.
- Keep per-track history: centroid trail, best face crops, first/last seen, side-of-line history.

### 6.4 Recognition
- Run face detection only inside each tracked person's upper-body box.
- Score each crop for quality (size, blur, yaw/pose) and skip poor ones.
- Embed the best N crops per track, query pgvector (top-1, cosine).
- Cache the whole enrolled-embedding matrix in memory for sub-millisecond matching; use pgvector as the source of truth and for admin queries.

### 6.5 Identity voting
- Accumulate per-track votes (person_id with similarity). Assign identity when:
  - >= K agreeing votes (e.g. 3) and mean similarity >= threshold, and
  - the margin to the second-best person is >= delta.
- Otherwise the identity stays `pending`. At crossing time, resolve using the votes so far. If still unresolved, log an `unknown`.
- Fixes the recognition-vs-crossing timing bug: the crossing event is **held for a short grace window** (e.g. up to 1.5 s or until the face is resolved) before it is written, and identity can be applied retroactively to the track.

### 6.6 Line-crossing and state machine
- Each camera has a configured virtual line (two points) and an "inside" side.
- A crossing counts only when the track has been seen on side A for >= N frames, then side B for >= N frames, with a minimum displacement.
- Direction from the sign of the cross product of the movement vector and the line.
- Per-person state machine: `OUTSIDE -> INSIDE -> OUTSIDE`. Ignore an entry when already inside and an exit when already outside, subject to a timeout reset (e.g. forced close of stale sessions at midnight).
- Cooldown per person/camera (e.g. 5 s) to prevent double logging.
- Entry camera and exit camera can each be `entry`-only or `exit`-only, or a single camera can serve `both`.

### 6.7 Publishing
- On a confirmed event: save the snapshot (full frame with box + face crop), insert the `events` row, update `sessions`, publish JSON to Redis.

---

## 7. API (FastAPI)

| Endpoint | Purpose |
|---|---|
| `POST /auth/login` | Admin and HR login (JWT). |
| `GET /presence` | Who is inside now. |
| `GET /events?from&to&person&camera&kind` | Paginated history. |
| `GET /people`, `POST /people`, `PATCH /people/{id}` | CRUD. |
| `POST /people/{id}/enroll` | Upload photos, extract and store embeddings, return a quality report. |
| `GET /people/{id}/sessions` | Time-inside history. |
| `GET /cameras`, `PATCH /cameras/{id}` | Config including line and ROI. |
| `GET /cameras/{id}/stream.mjpg` | Live view with overlays. |
| `GET /reports/daily?date=` and `/export.csv` | Attendance report. |
| `WS /ws/events` | Live event push. |
| `POST /events/{id}/relabel` | Correct an unknown or misidentified event (feeds improvement). |
| `DELETE /people/{id}` | Erasure: removes embeddings, snapshots and rows. |

---

## 8. Dashboard (Next.js)

1. **Live board:** "Inside now" cards (photo, name, since, time inside), counters (inside, entered today, unknown today).
2. **Activity feed:** real-time list with snapshot, name or "Unknown visitor", camera, direction, confidence. Click to expand to the full frame.
3. **Cameras:** live views with box and line overlay, per-camera FPS and health.
4. **People:** enrollment wizard (webcam or upload, quality feedback), edit, deactivate, delete.
5. **Reports:** daily and monthly attendance, hours inside, late and early flags, CSV export.
6. **Calibration:** draw the crossing line and ROI on a camera still; test with recorded clips.
7. **Settings and audit:** thresholds, retention, users and roles, audit log.

---

## 9. Phased delivery plan

| Phase | Weeks | Deliverable | Exit criteria |
|---|---|---|---|
| 0. Discovery | 1 | Camera inventory, network access, consent and legal sign-off, hardware spec | RTSP streams reachable; written consent process agreed |
| 1. Skeleton | 1 | Repo, Compose, DB schema, CI | `docker compose up` runs all services |
| 2. Capture + detect + track | 1-2 | Pipeline on a video file and one live camera | Stable tracking IDs, FPS reported, `replay.py` works |
| 3. Line crossing | 1 | Direction logic + state machine | >= 98% direction accuracy on labeled clips |
| 4. Enrollment + recognition | 2 | Enroll API/CLI, InsightFace, pgvector match, voting | >= 95% on enrolled test set; threshold chosen from ROC |
| 5. Persistence + API | 1-2 | Events, sessions, presence, WebSocket | Event latency < 2 s end-to-end |
| 6. Dashboard | 2 | Live board, feed, cameras, people, reports | Usable by HR without help |
| 7. Performance | 1 | OpenVINO export, threading, FPS-aware tracker, Docker CPU-flag verification | >= 5 FPS stable per camera, dropped frames < 10% |
| 8. Pilot | 2-3 | Run on real entry and exit cameras with a small group | Metrics in Section 1 measured and logged; edge cases catalogued |
| 9. Hardening | 1-2 | Auth/RBAC, TLS, backups, monitoring, retention jobs, optional liveness | Security checklist (Section 12) passed |
| 10. Rollout | 1 | All staff enrolled, runbook, training | Sign-off by stakeholders |

**Total: about 14-18 weeks for one engineer, about 8-10 with two (one pipeline, one API and web).**
Phases 3 and 4 can run in parallel with Phase 5.

---

## 10. Hardware and environment

- **Server:** modern x86 CPU with AVX2 or AVX-512 (Intel preferred for OpenVINO). Rough sizing: 1 core-pair per camera at 5 FPS with the nano model; 8-16 cores and 16-32 GB RAM supports 2-4 cameras. Benchmark before buying.
- **Storage:** snapshots about 100-200 KB each. Estimate 1,000 events a day, so about 70 GB a year, plus DB.
- **Network:** cameras on a dedicated VLAN, RTSP over LAN only, server not internet-exposed.
- **Cameras:** 1080p+, 2-2.5 m mount, tilted slightly down, good lighting, face visible for 1.5 m or more before the line, avoiding backlight (no windows behind the subject).

---

## 11. Testing and evaluation

1. **Unit tests:** line geometry, state machine, voting, cooldown.
2. **Replay harness:** `tools/replay.py` runs the pipeline on recorded clips with ground-truth labels (`clip, time, person, direction`).
3. **`tools/evaluate.py`** reports: recognition accuracy, FAR/FRR curve, direction accuracy, duplicate and missed events, FPS, drops.
4. **Edge-case clips to collect:** two people crossing together, someone loitering at the line, turning back, tailgating, masks and glasses, caps, low light, rain or glare, groups, carrying large items.
5. **Load test:** run all cameras for 24 hours and watch memory, FPS and queue depth.
6. **Regression gate in CI:** the replay evaluation on a small fixed clip set must not drop below the baseline.

---

## 12. Security, privacy and compliance

- Treat faces as **biometric data**: written employee consent, a stated purpose, and a retention period (e.g. snapshots 30-90 days, embeddings until the employee leaves plus a grace period).
- Encrypt disks, DB backups and snapshot storage; TLS on all web traffic.
- RBAC: admin, HR (read and reports), viewer. Audit log for enrollment, deletion, exports and relabels.
- Right to erasure endpoint that removes embeddings, snapshots and events.
- No cloud calls from the pipeline; block outbound traffic by default.
- Signage at monitored entrances.
- Check local law (GDPR, BIPA, DPDP or equivalent) before go-live.
- Basic anti-spoofing (optional): reject photos on a screen via a lightweight liveness model or a motion-consistency check; document the residual risk.

---

## 13. Observability and operations

- Metrics per camera: input FPS, processed FPS, dropped frames, inference ms, queue depth, tracks active, recognitions per minute, unknown rate.
- Alerts: camera offline, FPS below threshold, DB lag, disk above 80%, recognition unknown rate spike.
- Health endpoints, structured logs with `camera_id` and `track_id`.
- Nightly: close stale sessions, retention purge, DB backup.
- Runbook: restart procedures, adding a camera, re-enrolling someone, updating thresholds.

---

## 14. Known pitfalls (from the reference build) and mitigations

| Pitfall | Mitigation |
|---|---|
| Tracker assumes 30 FPS but the stream is about 5 | Measure the real FPS at startup and pass it to ByteTrack; scale the buffer and thresholds. |
| A dependency silently removes CPU acceleration in Docker | Pin versions, add a startup self-test that benchmarks one inference and checks the OpenVINO device, and fail loudly if too slow. |
| Recognition finishes after the line is crossed | Grace window plus retroactive identity from per-track voting. |
| Frame backlog causes lag | Latest-frame-only capture; skip frames rather than queue. |
| Duplicate events from jitter near the line | Hysteresis (N frames each side), min displacement, cooldown. |
| Wrong identity from a single bad frame | Quality gating, multi-frame voting, margin check. |
| Embedding drift (haircut, glasses) | Allow multiple enrollment embeddings per person; add relabeled hard examples. |

---

## 15. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Poor camera angle or lighting | Low accuracy | Site survey in Phase 0; adjust mounts early; consider a dedicated face camera at the door. |
| CPU too slow for the cameras | Dropped frames | Smaller model, lower imgsz, frame skipping, or add an Intel iGPU/NPU. |
| Legal or consent objections | Blocks launch | Engage legal in Phase 0. |
| Tailgating and crowding | Missed identities | Log as unknown and review; add a second camera angle. |
| Model bias across demographics | Unequal accuracy | Test on your actual staff population; tune thresholds per measured results. |

---

## 16. Definition of done

- All metrics in Section 1 met over a 2-week pilot.
- Runbook, backup and restore tested.
- Security and compliance checklist signed off.
- Staff enrolled with documented consent.
- Dashboard used daily by HR with no engineering involvement.

---

## 17. Suggested first sprint (week 1-2)

1. Create the repo layout and Compose skeleton (db, api, web, redis).
2. Write `capture.py`, `detector.py`, `tracker.py`, and `replay.py`; draw boxes and track IDs on a sample video.
3. Implement `crossing.py` with unit tests and a labeled 5-minute clip.
4. Stand up the Postgres schema with Alembic and a stub `/presence` endpoint.
5. Record 20-30 minutes of real footage from the entry and exit cameras for the evaluation set.
