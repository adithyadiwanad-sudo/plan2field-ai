"""Plan2Field AI: database, migrations and transactional services.

Python 3.11 recommended.

Commands:
    python database_setup.py
    python database_setup.py --empty
    python database_setup.py --reset --confirm-reset

Existing v1 databases are backed up and migrated in place.
PLAN2FIELD_DB can point to another SQLite database file.

Attendance percentage:
    present records / recorded attendance days * 100

Unrecorded dates never imply absence.

For institutional deployment, use authenticated access, durable
storage, authorization rules and a database backup/retention policy.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4


DB_PATH = Path(
    os.getenv(
        "PLAN2FIELD_DB",
        Path(__file__).with_name("college_department.db"),
    )
).resolve()

ROOMS = (
    "Seminar Hall",
    "Main Hall",
    "Lab 1",
    "Lab 2",
    "Conference Room",
)

TABLES = (
    "students",
    "attendance_log",
    "department_calendar",
    "audit_trail",
)

SCHEMA_VERSION = 2


class DataError(ValueError):
    """Expected validation, stale-review or calendar-conflict error."""


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="microseconds")


@contextmanager
def connect(db_path=DB_PATH, write=False):
    """Create a connection per operation instead of sharing connections."""

    conn = sqlite3.connect(
        str(db_path),
        timeout=20,
        isolation_level=None,
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=20000")

    try:
        if write:
            # Acquire the write lock before checking collisions/revisions.
            # This prevents two sessions from approving the same free slot.
            conn.execute("BEGIN IMMEDIATE")

        yield conn

        if write:
            conn.commit()

    except Exception:
        if write:
            conn.rollback()
        raise

    finally:
        conn.close()


def backup_database(db_path=DB_PATH):
    """Create a consistent backup, including committed WAL contents."""

    path = Path(db_path)
    target = path.with_name(
        f"{path.stem}.backup-"
        f"{datetime.now():%Y%m%d-%H%M%S}-"
        f"{uuid4().hex[:6]}.db"
    )

    with connect(path) as src:
        dst = sqlite3.connect(str(target))
        try:
            src.backup(dst)
        finally:
            dst.close()

    return target


def _audit(
    conn,
    raw,
    payload,
    action,
    actor="local-demo",
    request_id=None,
):
    """Write audit information using the caller's transaction."""

    conn.execute(
        """
        INSERT INTO audit_trail (
            timestamp,
            raw_transcription,
            parsed_json,
            user_action,
            actor,
            request_id
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            utc_now(),
            raw,
            json.dumps(
                payload,
                ensure_ascii=False,
                default=str,
                allow_nan=False,
            ),
            action,
            actor,
            request_id,
        ),
    )


def audit_event(
    raw,
    payload,
    action,
    actor="local-demo",
    db_path=DB_PATH,
):
    with connect(db_path, write=True) as conn:
        _audit(conn, raw, payload, action, actor)


def _tables(conn):
    return {
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )
    }


def _columns(conn, table):
    # This helper receives only internal, fixed table names.
    return {
        row[1]
        for row in conn.execute(f"PRAGMA table_info({table})")
    }


def _create_schema(conn):
    statements = [
        """
        CREATE TABLE IF NOT EXISTS students (
            student_id INTEGER PRIMARY KEY,
            roll_no TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            department TEXT NOT NULL,
            email TEXT NOT NULL DEFAULT '',
            attendance_pct REAL
                CHECK(attendance_pct BETWEEN 0 AND 100)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS attendance_log (
            log_id INTEGER PRIMARY KEY,
            student_id INTEGER NOT NULL
                REFERENCES students(student_id),
            date TEXT NOT NULL CHECK(length(date)=10),
            status TEXT NOT NULL
                CHECK(status IN ('Present', 'Absent')),
            confidence_score REAL NOT NULL
                CHECK(confidence_score BETWEEN 0 AND 100),
            verified INTEGER NOT NULL
                CHECK(verified IN (0, 1)),
            source_type TEXT NOT NULL DEFAULT 'Voice'
                CHECK(
                    source_type IN (
                        'Voice', 'Text', 'Demo', 'Legacy'
                    )
                ),
            revision INTEGER NOT NULL DEFAULT 1,
            UNIQUE(student_id, date)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS department_calendar (
            event_id INTEGER PRIMARY KEY,
            event_title TEXT NOT NULL,
            date TEXT NOT NULL CHECK(length(date)=10),
            time_slot TEXT NOT NULL,
            location TEXT NOT NULL COLLATE NOCASE,
            status TEXT NOT NULL
                CHECK(
                    status IN (
                        'Scheduled', 'Needs Review', 'Cancelled'
                    )
                ),
            start_minute INTEGER NOT NULL
                CHECK(start_minute >= 0),
            end_minute INTEGER NOT NULL
                CHECK(
                    end_minute <= 1440
                    AND end_minute > start_minute
                ),
            organizer TEXT NOT NULL DEFAULT '',
            revision INTEGER NOT NULL DEFAULT 1,
            CHECK(
                time_slot = printf(
                    '%02d:%02d-%02d:%02d',
                    start_minute / 60,
                    start_minute % 60,
                    end_minute / 60,
                    end_minute % 60
                )
            )
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS audit_trail (
            action_id INTEGER PRIMARY KEY,
            timestamp TEXT NOT NULL,
            raw_transcription TEXT NOT NULL,
            parsed_json TEXT NOT NULL,
            user_action TEXT NOT NULL,
            actor TEXT NOT NULL DEFAULT 'local-demo',
            request_id TEXT UNIQUE
        )
        """,
        """
        CREATE INDEX IF NOT EXISTS idx_att_date
        ON attendance_log(date)
        """,
        """
        CREATE INDEX IF NOT EXISTS idx_calendar_room
        ON department_calendar(date, location, status)
        """,
    ]

    for statement in statements:
        conn.execute(statement)

    # Database-level protection also applies to external SQL writers.
    # Intervals are half-open: 10:00-11:00 and 11:00-12:00 are compatible.
    for operation in ("INSERT", "UPDATE"):
        conn.execute(
            f"""
            CREATE TRIGGER IF NOT EXISTS
                no_room_overlap_{operation.lower()}
            BEFORE {operation} ON department_calendar
            WHEN NEW.status='Scheduled'
            BEGIN
                SELECT RAISE(
                    ABORT,
                    'Venue Conflict Warning: overlapping booking'
                )
                WHERE EXISTS (
                    SELECT 1
                    FROM department_calendar c
                    WHERE c.status='Scheduled'
                      AND c.date=NEW.date
                      AND lower(trim(c.location))
                          = lower(trim(NEW.location))
                      AND c.event_id
                          != COALESCE(NEW.event_id, -1)
                      AND c.start_minute < NEW.end_minute
                      AND c.end_minute > NEW.start_minute
                );
            END
            """
        )

    # Keep the requested attendance_pct column synchronized.
    # NULL means no attendance has been recorded for the student.
    for operation, reference in (
        ("INSERT", "NEW"),
        ("UPDATE", "NEW"),
        ("DELETE", "OLD"),
    ):
        conn.execute(
            f"""
            CREATE TRIGGER IF NOT EXISTS
                attendance_pct_{operation.lower()}
            AFTER {operation} ON attendance_log
            BEGIN
                UPDATE students
                SET attendance_pct = (
                    SELECT round(
                        100.0 * sum(status='Present') / count(*),
                        2
                    )
                    FROM attendance_log
                    WHERE student_id={reference}.student_id
                )
                WHERE student_id={reference}.student_id;
            END
            """
        )

    conn.execute(
        """
        CREATE TRIGGER IF NOT EXISTS attendance_pct_old_student
        AFTER UPDATE OF student_id ON attendance_log
        WHEN OLD.student_id != NEW.student_id
        BEGIN
            UPDATE students
            SET attendance_pct = (
                SELECT round(
                    100.0 * sum(status='Present') / count(*),
                    2
                )
                FROM attendance_log
                WHERE student_id=OLD.student_id
            )
            WHERE student_id=OLD.student_id;
        END
        """
    )


def initialize_database(db_path=DB_PATH, seed=True):
    """Initialize once; do not inject demo data into an existing database."""

    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with connect(path) as conn:
        version = conn.execute(
            "PRAGMA user_version"
        ).fetchone()[0]
        tables = _tables(conn)

        if version == SCHEMA_VERSION:
            return

        if version > SCHEMA_VERSION:
            raise DataError(
                "Database was created by a newer application; "
                "refusing to downgrade."
            )

        legacy = "students" in tables

        if legacy and (
            "attendance_pct" in _columns(conn, "students")
            or "student_id" in _columns(conn, "attendance_log")
        ):
            raise DataError(
                "Unrecognized schema. Restore a supported v1 "
                "backup or use a new database path."
            )

    backup = str(backup_database(path)) if legacy else None

    with connect(path) as conn:
        conn.execute("PRAGMA journal_mode=WAL")

    with connect(path, write=True) as conn:
        # Another process may have initialized while we waited.
        version = conn.execute(
            "PRAGMA user_version"
        ).fetchone()[0]

        if version == SCHEMA_VERSION:
            return

        if legacy:
            conn.execute(
                "ALTER TABLE students "
                "ADD COLUMN attendance_pct REAL"
            )
            conn.execute(
                "ALTER TABLE attendance_log "
                "RENAME TO attendance_log_v1"
            )
            conn.execute(
                "ALTER TABLE department_calendar "
                "RENAME TO department_calendar_v1"
            )

        _create_schema(conn)

        if legacy:
            conn.execute(
                """
                INSERT INTO attendance_log (
                    log_id,
                    student_id,
                    date,
                    status,
                    confidence_score,
                    verified,
                    source_type
                )
                SELECT
                    a.log_id,
                    s.student_id,
                    a.date,
                    a.status,
                    0,
                    0,
                    'Legacy'
                FROM attendance_log_v1 a
                JOIN students s ON a.roll_no=s.roll_no
                """
            )

            old_count = conn.execute(
                "SELECT count(*) FROM attendance_log_v1"
            ).fetchone()[0]
            new_count = conn.execute(
                "SELECT count(*) FROM attendance_log"
            ).fetchone()[0]

            if old_count != new_count:
                raise DataError(
                    "Migration found orphan attendance; "
                    "migration rolled back. See backup."
                )

            # The old schema did not contain event times.
            # Use a provisional slot and require faculty review.
            conn.execute(
                """
                INSERT INTO department_calendar (
                    event_id,
                    event_title,
                    date,
                    time_slot,
                    location,
                    status,
                    start_minute,
                    end_minute,
                    organizer
                )
                SELECT
                    event_id,
                    event_title,
                    date,
                    '09:00-10:00',
                    location,
                    'Needs Review',
                    540,
                    600,
                    organizer
                FROM department_calendar_v1
                """
            )

            conn.execute("DROP TABLE attendance_log_v1")
            conn.execute("DROP TABLE department_calendar_v1")

            _audit(
                conn,
                "",
                {
                    "backup": backup,
                    "calendar_note":
                        "Times provisional; faculty review required",
                },
                "MIGRATION_V1_TO_V2",
            )

        elif seed:
            _seed(conn)

        conn.execute(f"PRAGMA user_version={SCHEMA_VERSION}")


def _seed(conn):
    """Create deterministic synthetic records for demonstration."""

    names = [
        "Rahul Sharma",
        "Priya Patel",
        "Aditya Diwanad",
        "Sneha Rao",
        "Arjun Kumar",
        "Ananya Desai",
        "Kiran Gowda",
        "Meera Nair",
        "Rohan Shetty",
        "Kavya Rao",
        "Vikram Singh",
        "Nisha Reddy",
    ]

    for index, name in enumerate(names):
        roll = str(101 + index)

        conn.execute(
            """
            INSERT INTO students (
                roll_no, name, department, email
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                roll,
                name,
                "Information Science",
                f"student{roll}@example.edu",
            ),
        )

    students = conn.execute(
        "SELECT student_id, roll_no FROM students"
    ).fetchall()

    days = []
    cursor = date.today()

    while len(days) < 20:
        if cursor.weekday() < 5:
            days.append(cursor.isoformat())
        cursor -= timedelta(days=1)

    for index, student in enumerate(students):
        for day_index, day in enumerate(days):
            interval = 3 if index in (2, 4, 8) else 7
            absent = ((day_index + index) % interval) == 0

            conn.execute(
                """
                INSERT INTO attendance_log (
                    student_id,
                    date,
                    status,
                    confidence_score,
                    verified,
                    source_type
                )
                VALUES (?, ?, ?, ?, 1, 'Demo')
                """,
                (
                    student["student_id"],
                    day,
                    "Absent" if absent else "Present",
                    95,
                ),
            )

    events = [
        (0, "HOD Review", "Seminar Hall", 600),
        (0, "Faculty Sync", "Conference Room", 660),
        (0, "Project Lab", "Lab 1", 840),
        (1, "Research Forum", "Main Hall", 600),
        (2, "Placement Briefing", "Seminar Hall", 660),
        (3, "Design Critique", "Lab 2", 780),
    ]

    for offset, title, room, start in events:
        event_date = (
            date.today() + timedelta(days=offset)
        ).isoformat()

        conn.execute(
            """
            INSERT INTO department_calendar (
                event_title,
                date,
                time_slot,
                location,
                status,
                start_minute,
                end_minute,
                organizer
            )
            VALUES (?, ?, ?, ?, 'Scheduled', ?, ?, 'ISE Department')
            """,
            (
                title,
                event_date,
                format_slot(start, start + 60),
                room,
                start,
                start + 60,
            ),
        )

    _audit(
        conn,
        "",
        {
            "students": 12,
            "attendance_rows": 240,
            "events": 6,
            "synthetic": True,
        },
        "DEMO_SEED",
    )


def reset_demo(db_path=DB_PATH, actor="local-demo"):
    """Back up first, reset operational records, retain audit history."""

    backup = backup_database(db_path)

    with connect(db_path, write=True) as conn:
        conn.execute("DELETE FROM attendance_log")
        conn.execute("DELETE FROM department_calendar")
        conn.execute("DELETE FROM students")

        _seed(conn)

        _audit(
            conn,
            "",
            {"backup": str(backup)},
            "RESET_DEMO",
            actor,
        )

    return backup


def read_table(table, db_path=DB_PATH):
    # Table identifiers cannot be parameterized, so allowlist them.
    if table not in TABLES:
        raise DataError("Unknown table")

    with connect(db_path) as conn:
        return [
            dict(row)
            for row in conn.execute(f"SELECT * FROM {table}")
        ]


def format_slot(start, end):
    return (
        f"{start // 60:02d}:{start % 60:02d}-"
        f"{end // 60:02d}:{end % 60:02d}"
    )


def slot_minutes(slot):
    match = re.fullmatch(
        r"(\d{2}):(\d{2})-(\d{2}):(\d{2})",
        str(slot),
    )

    if not match:
        raise DataError(
            "Time slot must use 24-hour HH:MM-HH:MM, "
            "for example 10:00-11:00."
        )

    hour1, minute1, hour2, minute2 = map(
        int,
        match.groups(),
    )

    if (
        hour1 > 23
        or hour2 > 24
        or minute1 > 59
        or minute2 > 59
        or (hour2 == 24 and minute2 != 0)
    ):
        raise DataError("Invalid clock time.")

    start = hour1 * 60 + minute1
    end = hour2 * 60 + minute2

    if end <= start:
        raise DataError(
            "End must be after start; split overnight "
            "events into separate days."
        )

    return start, end


def valid_date(value):
    if not re.fullmatch(
        r"\d{4}-\d{2}-\d{2}",
        str(value),
    ):
        raise DataError("Date must be YYYY-MM-DD.")

    return date.fromisoformat(str(value)).isoformat()


def canonical_room(value):
    cleaned = " ".join(str(value).split())

    room = next(
        (
            room
            for room in ROOMS
            if room.casefold() == cleaned.casefold()
        ),
        None,
    )

    if not room:
        raise DataError(
            f'Unknown room "{cleaned}". '
            "Choose one of the registered rooms."
        )

    return room


def find_conflicts(event, existing):
    """Return confirmed bookings overlapping the proposed event."""

    start, end = slot_minutes(event["time_slot"])
    room = canonical_room(event["location"])

    return [
        existing_event
        for existing_event in existing
        if existing_event["status"] == "Scheduled"
        and existing_event["date"] == event["date"]
        and existing_event["location"].strip().casefold()
        == room.casefold()
        and (
            not event.get("event_id")
            or int(existing_event.get("event_id", -1))
            != int(event["event_id"])
        )
        and slot_minutes(existing_event["time_slot"])[0] < end
        and slot_minutes(existing_event["time_slot"])[1] > start
    ]


def suggest_resolution(event, existing):
    """Suggest other rooms and the next free slot in the same room.

    Searches seven dates, including the requested date.
    Suggested slots stay within 08:00-18:00.
    """

    event = dict(event)
    alternatives = []

    for room in ROOMS:
        candidate = {**event, "location": room}

        if (
            room != canonical_room(event["location"])
            and not find_conflicts(candidate, existing)
        ):
            alternatives.append(candidate)

    start, end = slot_minutes(event["time_slot"])
    duration = end - start

    if duration <= 600:
        for offset in range(7):
            day = (
                date.fromisoformat(event["date"])
                + timedelta(days=offset)
            ).isoformat()

            lower = max(480, start) if offset == 0 else 480

            # A free interval begins at opening time, the requested
            # start, or the end of an existing booking.
            candidates = {lower}

            candidates.update(
                slot_minutes(existing_event["time_slot"])[1]
                for existing_event in existing
                if existing_event["date"] == day
                and existing_event["status"] == "Scheduled"
                and existing_event["location"].casefold()
                == event["location"].casefold()
            )

            for candidate_start in sorted(candidates):
                if (
                    candidate_start < lower
                    or candidate_start + duration > 1080
                ):
                    continue

                candidate = {
                    **event,
                    "date": day,
                    "time_slot": format_slot(
                        candidate_start,
                        candidate_start + duration,
                    ),
                }

                if not find_conflicts(candidate, existing):
                    return alternatives, candidate

    return alternatives, None


def attendance_snapshot(day, db_path=DB_PATH):
    """Capture revisions used to detect stale review sessions."""

    with connect(db_path) as conn:
        return {
            row["student_id"]: dict(row)
            for row in conn.execute(
                "SELECT * FROM attendance_log WHERE date=?",
                (str(day),),
            )
        }


def validate_confidence(value):
    try:
        score = float(value)
    except (TypeError, ValueError) as exc:
        raise DataError(
            "Confidence must be a number between 0 and 100."
        ) from exc

    # Also rejects NaN and infinity.
    if not 0 <= score <= 100:
        raise DataError(
            "Confidence must be between 0 and 100."
        )

    return score


def save_attendance(
    rows,
    day,
    raw,
    original,
    request_id,
    actor="local-demo",
    source="Voice",
    db_path=DB_PATH,
):
    """Validate and commit reviewed attendance as one transaction."""

    day = valid_date(day)

    if (
        source not in ("Voice", "Text")
        or not rows
        or len(rows) > 500
    ):
        raise DataError(
            "Invalid source or attendance batch size."
        )

    seen = set()

    with connect(db_path, write=True) as conn:
        already_committed = conn.execute(
            "SELECT 1 FROM audit_trail WHERE request_id=?",
            (request_id,),
        ).fetchone()

        if already_committed:
            return 0

        changes = []

        for row in rows:
            student = conn.execute(
                "SELECT * FROM students WHERE roll_no=?",
                (str(row["roll_no"]).strip(),),
            ).fetchone()

            if not student:
                raise DataError(
                    f"Unknown roll {row['roll_no']}; "
                    "correct or exclude it."
                )

            student_id = student["student_id"]

            if student_id in seen:
                raise DataError(
                    "Duplicate/conflicting entries for roll "
                    f"{row['roll_no']}; keep one row."
                )

            seen.add(student_id)

            score = validate_confidence(
                row["confidence_score"]
            )

            if (
                row["status"] not in ("Present", "Absent")
                or row["verified"] is not True
            ):
                raise DataError(
                    "Every included attendance record must "
                    "have a valid status, score and "
                    "Verified checked."
                )

            old = conn.execute(
                """
                SELECT *
                FROM attendance_log
                WHERE student_id=? AND date=?
                """,
                (student_id, day),
            ).fetchone()

            expected = original.get(student_id)
            current_revision = old["revision"] if old else 0
            expected_revision = (
                expected["revision"] if expected else 0
            )

            if current_revision != expected_revision:
                raise DataError(
                    f"Roll {row['roll_no']} changed after "
                    "preview. Extract again to refresh."
                )

            conn.execute(
                """
                INSERT INTO attendance_log (
                    student_id,
                    date,
                    status,
                    confidence_score,
                    verified,
                    source_type
                )
                VALUES (?, ?, ?, ?, 1, ?)
                ON CONFLICT(student_id, date)
                DO UPDATE SET
                    status=excluded.status,
                    confidence_score=excluded.confidence_score,
                    verified=1,
                    source_type=excluded.source_type,
                    revision=attendance_log.revision+1
                """,
                (
                    student_id,
                    day,
                    row["status"],
                    score,
                    source,
                ),
            )

            changes.append(
                {
                    "before": dict(old) if old else None,
                    "after": row,
                }
            )

        # Audit and operational writes commit or roll back together.
        _audit(
            conn,
            raw,
            {
                "date": day,
                "source": source,
                "changes": changes,
            },
            "COMMIT_ATTENDANCE",
            actor,
            request_id,
        )

    return len(changes)


def save_events(
    rows,
    raw,
    request_id,
    actor="local-demo",
    db_path=DB_PATH,
):
    """Commit reviewed calendar changes; SQL triggers prevent overlaps."""

    if not rows or len(rows) > 100:
        raise DataError(
            "Calendar batch must have 1-100 events."
        )

    with connect(db_path, write=True) as conn:
        already_committed = conn.execute(
            "SELECT 1 FROM audit_trail WHERE request_id=?",
            (request_id,),
        ).fetchone()

        if already_committed:
            return 0

        changes = []

        for row in rows:
            day = valid_date(row["date"])
            room = canonical_room(row["location"])
            start, end = slot_minutes(row["time_slot"])

            validate_confidence(
                row.get("confidence_score", 0)
            )

            title = str(row["event_title"]).strip()

            if (
                not title
                or len(title) > 200
                or row.get("verified") is not True
            ):
                raise DataError(
                    "Every event needs a title and "
                    "Verified checked."
                )

            status = row.get("status", "Scheduled")

            if status not in ("Scheduled", "Cancelled"):
                raise DataError(
                    "Choose Scheduled or Cancelled "
                    "for reviewed events."
                )

            event_id = int(row.get("event_id", 0) or 0)

            old = (
                conn.execute(
                    """
                    SELECT *
                    FROM department_calendar
                    WHERE event_id=?
                    """,
                    (event_id,),
                ).fetchone()
                if event_id
                else None
            )

            if event_id and (
                not old
                or old["revision"]
                != int(row.get("revision", 0))
            ):
                raise DataError(
                    "This event changed after preview. "
                    "Refresh and review it again."
                )

            duplicate = conn.execute(
                """
                SELECT event_id
                FROM department_calendar
                WHERE lower(event_title)=lower(?)
                  AND date=?
                  AND lower(location)=lower(?)
                  AND time_slot=?
                  AND status='Scheduled'
                  AND event_id!=?
                """,
                (
                    title,
                    day,
                    room,
                    row["time_slot"],
                    event_id,
                ),
            ).fetchone()

            if duplicate and status == "Scheduled":
                raise DataError(
                    "This booking already exists; "
                    "edit it in the Calendar tab."
                )

            parameters = (
                title,
                day,
                row["time_slot"],
                room,
                status,
                start,
                end,
            )

            if old:
                conn.execute(
                    """
                    UPDATE department_calendar
                    SET event_title=?,
                        date=?,
                        time_slot=?,
                        location=?,
                        status=?,
                        start_minute=?,
                        end_minute=?,
                        revision=revision+1
                    WHERE event_id=?
                    """,
                    parameters + (event_id,),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO department_calendar (
                        event_title,
                        date,
                        time_slot,
                        location,
                        status,
                        start_minute,
                        end_minute
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    parameters,
                )

            changes.append(
                {
                    "before": dict(old) if old else None,
                    "after": row,
                }
            )

        _audit(
            conn,
            raw,
            {"changes": changes},
            "COMMIT_CALENDAR",
            actor,
            request_id,
        )

    return len(changes)


def save_student(
    roll,
    name,
    department,
    email="",
    actor="local-demo",
    db_path=DB_PATH,
):
    roll, name, department, email = [
        str(value).strip()
        for value in (roll, name, department, email)
    ]

    if (
        not re.fullmatch(r"\d{1,12}", roll)
        or not name
        or not department
        or max(map(len, (name, department, email))) > 200
    ):
        raise DataError(
            "Use a numeric roll number and nonempty "
            "name/department (maximum 200 characters)."
        )

    with connect(db_path, write=True) as conn:
        conn.execute(
            """
            INSERT INTO students (
                roll_no, name, department, email
            )
            VALUES (?, ?, ?, ?)
            """,
            (roll, name, department, email),
        )

        _audit(
            conn,
            "",
            {
                "roll_no": roll,
                "name": name,
                "department": department,
            },
            "ADD_STUDENT",
            actor,
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description=__doc__
    )
    parser.add_argument(
        "--empty",
        action="store_true",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
    )
    parser.add_argument(
        "--confirm-reset",
        action="store_true",
    )

    args = parser.parse_args()

    try:
        if args.reset and not args.confirm_reset:
            parser.error(
                "Reset requires --confirm-reset; "
                "a backup will be created."
            )

        initialize_database(seed=not args.empty)

        if args.reset:
            print(f"Backup: {reset_demo()}")

        print(
            f"Plan2Field AI database ready: {DB_PATH}"
        )

    except (sqlite3.Error, ValueError, OSError) as exc:
        raise SystemExit(
            f"Database setup failed: {exc}"
        ) from exc