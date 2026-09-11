"""SQLite persistence for the voice department PoC.
Run: python database_setup.py
Reset sample data explicitly: python database_setup.py --reset
"""
import argparse
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).resolve().with_name('college_department.db')
TABLES = ('students', 'attendance_log', 'department_calendar')


@contextmanager
def connect(db_path=DB_PATH):
    # A connection per operation avoids sharing SQLite connections across threads.
    conn = sqlite3.connect(str(db_path), timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def initialize_database(db_path=DB_PATH, reset=False):
    with connect(db_path) as conn:
        if reset:
            for table in ('attendance_log', 'department_calendar', 'students'):
                conn.execute(f'DROP TABLE IF EXISTS {table}')
        conn.execute('''CREATE TABLE IF NOT EXISTS students (
            student_id INTEGER PRIMARY KEY AUTOINCREMENT,
            roll_no TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
            department TEXT NOT NULL, email TEXT NOT NULL)''')
        conn.execute('''CREATE TABLE IF NOT EXISTS department_calendar (
            event_id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_title TEXT NOT NULL COLLATE NOCASE, date TEXT NOT NULL,
            location TEXT NOT NULL COLLATE NOCASE, organizer TEXT NOT NULL,
            UNIQUE(event_title, date, location))''')
        conn.execute('''CREATE TABLE IF NOT EXISTS attendance_log (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            roll_no TEXT NOT NULL REFERENCES students(roll_no),
            date TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('Present', 'Absent')),
            source_type TEXT NOT NULL DEFAULT 'Voice' CHECK(source_type = 'Voice'),
            UNIQUE(roll_no, date))''')
        students = [('101', 'Rahul Sharma'), ('102', 'Priya Patel'),
                    ('103', 'Aditya Diwanad'), ('104', 'Sneha Rao'),
                    ('105', 'Arjun Kumar')]
        conn.executemany('''INSERT INTO students(roll_no,name,department,email)
            VALUES(?,?,?,?) ON CONFLICT(roll_no) DO NOTHING''',
            [(roll, name, 'Information Science', f'student{roll}@example.edu')
             for roll, name in students])
        conn.executemany('''INSERT INTO department_calendar
            (event_title,date,location,organizer) VALUES(?,?,?,?)
            ON CONFLICT(event_title,date,location) DO NOTHING''', [
                ('Department Orientation', '2026-10-01', 'Seminar Hall', 'ISE Department'),
                ('Project Review', '2026-10-10', 'Lab 2', 'Project Coordinator')])


def read_table(table, db_path=DB_PATH):
    if table not in TABLES:  # SQL identifiers must be allowlisted, not user SQL.
        raise ValueError('Unknown table')
    with connect(db_path) as conn:
        return [dict(row) for row in conn.execute(f'SELECT * FROM {table}')]


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reset', action='store_true')
    args = parser.parse_args()
    initialize_database(reset=args.reset)
    print(f'Database ready: {DB_PATH}')
