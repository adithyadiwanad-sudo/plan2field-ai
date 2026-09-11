"""Voice-Driven Academic Department Data Management System.
Python 3.11 recommended. Install: pip install 'streamlit>=1.50,<2' openai-whisper
Also install FFmpeg and put it on PATH. Start: python -m streamlit run app.py
Whisper runs locally; the first model load downloads base weights (no API key).
English, short callouts, one student per status; one calendar event per request.
Recording is transcribed after you stop, not word-by-word live streaming.
"""
import calendar
import json
import re
import shutil
import tempfile
import threading
from datetime import date, datetime, timedelta
from difflib import SequenceMatcher
from pathlib import Path

from database_setup import DB_PATH, connect, initialize_database, read_table


def normalize(value):
    return ' '.join(re.findall(r'\w+', str(value).casefold()))


def spoken_roll(value):
    """Resolve digit sequences and simple spoken hundreds; never fuzzy-match IDs."""
    value = normalize(value)
    if value.isdigit():
        return value
    digits = dict(zip('zero one two three four five six seven eight nine'.split(),
                      '0123456789'))
    digits['oh'] = '0'
    words = value.split()
    if words and all(w in digits for w in words):
        return ''.join(digits[w] for w in words)
    match = re.fullmatch(r'(one|two|three|four|five|six|seven|eight|nine) hundred(?: and)?(?: (.+))?', value)
    if match:
        suffix = match[2]
        if suffix is None or suffix in digits:
            return str(int(digits[match[1]]) * 100 + int(digits.get(suffix, '0')))
    return None


def extract_attendance(text):
    """Status words terminate each callout, even when Whisper omits commas."""
    rows, warnings, start = [], [], 0
    for match in re.finditer(r'\b(present|absent)\b', text, re.I):
        entity = text[start:match.start()].strip(' ,.;:\n')
        entity = re.sub(r'^(?:and\s+|mark\s+)', '', entity, flags=re.I)
        entity = re.sub(r'\s+(?:is|as)$', '', entity, flags=re.I).strip()
        rows.append({'entity': entity, 'status': match[1].title()})
        start = match.end()
    tail = text[start:].strip(' ,.;:\n')
    if tail:
        warnings.append(f'Unparsed text (not saved): {tail}')
    if not rows:
        warnings.append('No callouts found. Use "Roll 101 present, Rahul Sharma absent".')
    return rows, warnings


def match_student(entity, students):
    """Exact roll > exact full name > conservative fuzzy full-name suggestion.

    A roll typo must not silently identify another student. Names use character
    similarity, not probability. Close or weak candidates remain exceptions.
    Fuzzy results are suggestions requiring a faculty confirmation checkbox.
    """
    raw = re.sub(r'^roll(?:\s+(?:number|no\.?))?\s*', '', entity.strip(), flags=re.I)
    roll = spoken_roll(raw)
    if roll is not None:
        found = next((s for s in students if s['roll_no'] == roll), None)
        return found, 'Exact roll' if found else 'Unknown roll', 100 if found else 0
    name = normalize(raw)
    exact = [s for s in students if normalize(s['name']) == name]
    if len(exact) == 1:
        return exact[0], 'Exact name', 100
    if len(exact) > 1:
        return None, 'Ambiguous name: specify roll number', 100
    scores = sorted([(SequenceMatcher(None, name, normalize(s['name'])).ratio()*100, s)
                     for s in students], key=lambda x: x[0], reverse=True)
    if not scores or not name:
        return None, 'Missing entity', 0
    score, best = scores[0]
    margin = score - scores[1][0] if len(scores) > 1 else 100
    if len(name.split()) >= 2 and score >= 86 and margin >= 8:
        return best, 'Fuzzy suggestion', round(score, 1)
    return None, 'Unmatched/ambiguous: correct entity or use roll number', round(score, 1)


def preview_attendance(rows, students):
    preview = []
    for row in rows:
        student, method, score = match_student(row['entity'], students)
        preview.append({**row, 'roll_no': student['roll_no'] if student else '',
                        'name': student['name'] if student else '',
                        'match': method, 'similarity': score})
    # Conflicting repeated callouts must be corrected before either is saved.
    for row in preview:
        if row['roll_no'] and len({r['status'] for r in preview
                                 if r['roll_no'] == row['roll_no']}) > 1:
            row['match'] = 'Conflict: multiple statuses for this student'
    return preview


def parse_event_date(text, default_year):
    text = text.strip().rstrip('.').lower()
    if text in ('today', 'tomorrow'):
        return (date.today() + timedelta(days=text == 'tomorrow')).isoformat()
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}', text):
        return date.fromisoformat(text).isoformat()
    text = re.sub(r'(\d)(st|nd|rd|th)\b', r'\1', text)
    text = text.replace(',', '')
    months = {name.lower(): i for i, name in enumerate(calendar.month_name) if name}
    months.update({name.lower(): i for i, name in enumerate(calendar.month_abbr) if name})
    for pattern, order in [(r'(\d{1,2}) ([a-z]+)(?: (\d{4}))?', 'day'),
                           (r'([a-z]+) (\d{1,2})(?: (\d{4}))?', 'month')]:
        m = re.fullmatch(pattern, text)
        if m:
            day, month = (m[1], m[2]) if order == 'day' else (m[2], m[1])
            if month in months:
                return date(int(m[3] or default_year), months[month], int(day)).isoformat()
    raise ValueError('Use an explicit date: 15th October 2026 or 2026-10-15.')


def extract_calendar(text, default_year, organizer):
    # Deliberately bounded grammar: no invented dates or LLM credentials required.
    match = re.fullmatch(r'\s*(?:schedule|add|create)\s+(.+?)\s+on\s+(.+?)\s+at\s+(.+?)\s*', text, re.I)
    if not match:
        raise ValueError('Use: Schedule HOD Meeting on 15th October 2026 at Main Hall')
    location = match[3].strip().rstrip('.')
    explicit_organizer = re.split(r'\s+organized by\s+', location, maxsplit=1, flags=re.I)
    if len(explicit_organizer) == 2:
        location, organizer = explicit_organizer
    return [{'event_title': match[1].strip(),
             'date': parse_event_date(match[2], default_year),
             'location': location, 'organizer': organizer.strip()}]


def validate_payload(payload, task):
    if not isinstance(payload, list) or not payload or len(payload) > 500:
        raise ValueError('JSON must be a nonempty array with at most 500 records.')
    fields = ('entity', 'status') if task == 'Attendance' else ('event_title', 'date', 'location', 'organizer')
    for row in payload:
        if not isinstance(row, dict) or set(row) != set(fields):
            raise ValueError(f'Each record needs exactly these fields: {", ".join(fields)}')
        if any(not isinstance(row[k], str) or not row[k].strip() or len(row[k]) > 300 for k in fields):
            raise ValueError('All fields must be nonempty strings, maximum 300 characters.')
        if task == 'Attendance' and row['status'] not in ('Present', 'Absent'):
            raise ValueError('Status must be Present or Absent.')
        if task != 'Attendance':
            if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', row['date']):
                raise ValueError('Calendar date must be YYYY-MM-DD.')
            date.fromisoformat(row['date'])
    return payload


def save_attendance(preview, attendance_date, accept_fuzzy=False, db_path=DB_PATH):
    day = date.fromisoformat(str(attendance_date)).isoformat()
    logs = []
    with connect(db_path) as conn:
        for row in preview:
            allowed = row['match'] in ('Exact roll', 'Exact name') or (
                accept_fuzzy and row['match'] == 'Fuzzy suggestion')
            if not allowed:
                logs.append(f"SKIPPED {row['entity']}: {row['match']}")
                continue
            # One record per student/day. A repeated submission is idempotent;
            # a corrected status updates that daily record, not a new duplicate.
            conn.execute('''INSERT INTO attendance_log(roll_no,date,status,source_type)
                VALUES(?,?,?,'Voice') ON CONFLICT(roll_no,date)
                DO UPDATE SET status=excluded.status''',
                (row['roll_no'], day, row['status']))
            logs.append(f"SAVED {row['roll_no']} {day}: {row['status']}")
    return logs


def save_calendar(rows, db_path=DB_PATH):
    validate_payload(rows, 'Calendar')
    logs = []
    with connect(db_path) as conn:
        for row in rows:
            cursor = conn.execute('''INSERT INTO department_calendar
                (event_title,date,location,organizer) VALUES(?,?,?,?)
                ON CONFLICT(event_title,date,location) DO NOTHING''',
                tuple(row[k].strip() for k in ('event_title','date','location','organizer')))
            logs.append(f"{'SAVED' if cursor.rowcount else 'DUPLICATE SKIPPED'}: {row['event_title']}")
    return logs


def load_whisper():
    import whisper
    return whisper.load_model('base'), threading.Lock()


def transcribe_audio(audio, cached_loader):
    if not shutil.which('ffmpeg'):
        raise RuntimeError('FFmpeg is missing. Install it, add it to PATH, and restart the terminal.')
    if audio.size > 25 * 1024 * 1024:
        raise ValueError('Use an audio clip under 25 MB (short clips are best).')
    suffix = Path(audio.name).suffix.lower()
    if suffix not in ('.wav', '.mp3', '.m4a'):
        raise ValueError('Upload WAV, MP3, or M4A audio.')
    # Close the file before FFmpeg opens it: necessary on Windows.
    with tempfile.TemporaryDirectory(prefix='department_audio_') as directory:
        path = Path(directory) / ('input' + suffix)
        path.write_bytes(audio.getvalue())
        model, lock = cached_loader()
        with lock:  # The cached model is shared across Streamlit sessions.
            result = model.transcribe(str(path), language='en', fp16=False)
    # Temporary audio is removed even if decoding/model inference fails.
    return result['text'].strip()


def main():
    import streamlit as st
    st.set_page_config(page_title='Department Voice Desk', page_icon='🎙️', layout='wide')
    cached_loader = st.cache_resource(show_spinner=False)(load_whisper)
    initialize_database()
    st.session_state.setdefault('audit', [])
    st.session_state.setdefault('transcript', '')

    def audit(messages):
        stamp = datetime.now().isoformat(timespec='seconds')
        st.session_state.audit.extend(f'{stamp} | {m}' for m in messages)
        st.session_state.audit = st.session_state.audit[-300:]

    with st.sidebar:
        st.title('Department Voice Desk')
        page = st.radio('Workspace', ['Voice Ingestion', 'Master Tables', 'Database Setup / Reset'])
        st.caption('Local PoC • English commands • SQLite')
        if st.button('Refresh tables'):
            st.rerun()
    if page == 'Database Setup / Reset':
        st.header('Database setup')
        st.code(str(DB_PATH))
        if st.button('Initialize / seed missing sample records'):
            initialize_database()
            st.success('Database initialized.')
        confirm = st.checkbox('Delete all attendance and events and restore sample data')
        if st.button('Reset database', disabled=not confirm):
            initialize_database(reset=True)
            for key in ('payload', 'preview_context', 'json_editor', 'transcript'):
                st.session_state.pop(key, None)
            st.session_state.audit = []
            st.success('Database reset to five students and two sample events.')
        return
    if page == 'Master Tables':
        for table in ('students', 'attendance_log', 'department_calendar'):
            st.subheader(table.replace('_', ' ').title())
            st.dataframe(read_table(table), width='stretch')
        return

    st.title('🎙️ Voice-Driven Department Desk')
    st.caption('Record or upload → transcribe → review JSON and matches → save')
    task = st.radio('Task', ['Attendance', 'Calendar'], horizontal=True)
    attendance_day = st.date_input('Attendance date', date.today()) if task == 'Attendance' else None
    year = st.number_input('Year when omitted from speech', 2000, 2100, date.today().year) if task == 'Calendar' else date.today().year
    organizer = st.text_input('Default organizer', 'ISE Department') if task == 'Calendar' else ''
    mode = st.radio('Audio source', ['Upload', 'Microphone'], horizontal=True)
    audio = (st.file_uploader('Upload a short recording', type=['wav', 'mp3', 'm4a'])
             if mode == 'Upload' else st.audio_input('Record an English command'))
    st.caption('Transcription appears after recording stops and processing completes; this is not streaming ASR.')
    if audio:
        st.audio(audio)
    if st.button('Transcribe audio', disabled=audio is None):
        try:
            with st.spinner('Loading Whisper base / transcribing (first run downloads the model)…'):
                st.session_state.transcript = transcribe_audio(audio, cached_loader)
            for key in ('payload', 'preview_context', 'json_editor'):
                st.session_state.pop(key, None)
            audit(['Whisper transcription completed'])
        except Exception as exc:
            st.error(f'Transcription failed: {exc}')
            audit([f'Transcription failed: {exc}'])
    st.text_area('Transcription — correct recognition mistakes here (or paste a test command)', key='transcript', height=120)
    st.caption('Attendance: Roll 101 present, Roll 102 absent, Sneha Rao present. '
               'Calendar: Schedule HOD Meeting on 15th October 2026 at Main Hall.')
    context = (task, st.session_state.transcript, str(attendance_day), year, organizer)
    if st.button('Extract structured JSON', type='primary'):
        for key in ('payload', 'preview_context', 'json_editor'):
            st.session_state.pop(key, None)
        try:
            if task == 'Attendance':
                payload, warnings = extract_attendance(st.session_state.transcript)
            else:
                payload = extract_calendar(st.session_state.transcript, year, organizer)
                warnings = []
            for warning in warnings:
                st.warning(warning)
            audit(warnings)
            validate_payload(payload, task)
            st.session_state.payload = payload
            st.session_state.json_editor = json.dumps(payload, indent=2)
            st.session_state.preview_context = context
            audit([f'Extracted {len(payload)} {task.lower()} record(s)'])
        except ValueError as exc:
            st.error(str(exc))
            audit([f'Extraction failed: {exc}'])
    if 'payload' in st.session_state:
        if st.session_state.preview_context != context:
            st.warning('Input or settings changed. Extract again before saving.')
        else:
            st.subheader('Review and correct structured data')
            edited = st.text_area('Editable JSON — use roll numbers to resolve exceptions', key='json_editor', height=200)
            try:
                rows = validate_payload(json.loads(edited), task)
                st.json(rows)
                fuzzy = False
                if task == 'Attendance':
                    preview = preview_attendance(rows, read_table('students'))
                    st.dataframe(preview, width='stretch')
                    if any(r['match'] == 'Fuzzy suggestion' for r in preview):
                        fuzzy = st.checkbox('I verified the suggested fuzzy name matches')
                    if any(not r['roll_no'] or r['match'].startswith('Conflict') for r in preview):
                        st.warning('Exceptions/conflicts are skipped. Correct the JSON entity to a valid roll number to resolve them.')
                    st.caption('Saving replaces the existing status for the same student and date. Unmentioned students remain unchanged.')
                if st.button('Save reviewed records to database'):
                    try:
                        logs = (save_attendance(preview, attendance_day, fuzzy) if task == 'Attendance'
                                else save_calendar(rows))
                        audit(logs)
                        st.info(f"{sum(m.startswith('SAVED') for m in logs)} record(s) saved. See execution logs for details.")
                    except Exception as exc:
                        st.error(f'Database write failed; transaction rolled back: {exc}')
                        audit([f'Database write failed: {exc}'])
            except (ValueError, TypeError) as exc:
                st.error(f'Fix JSON before saving: {exc}')

    st.subheader('Current database records')
    left, right = st.columns(2)
    with left:
        st.write('Attendance logs')
        st.dataframe(read_table('attendance_log'), width='stretch')
    with right:
        st.write('Department calendar')
        st.dataframe(read_table('department_calendar'), width='stretch')
    with st.expander('Execution logs — current session', expanded=True):
        st.code('\n'.join(st.session_state.audit) or 'No operations yet.', language=None)
        st.download_button('Download execution logs', '\n'.join(st.session_state.audit), 'execution_logs.txt')
        st.caption('Logs and transcript are session memory; SQLite records persist. '
                   'Text-pasted commands are a demo input and also use the required Voice source label.')


if __name__ == '__main__':
    main()
