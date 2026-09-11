# """SQLite persistence for the voice department PoC.
# Run: python database_setup.py
# Reset sample data explicitly: python database_setup.py --reset
# """
# import argparse
# import sqlite3
# from contextlib import contextmanager
# from pathlib import Path

# DB_PATH = Path(__file__).resolve().with_name('college_department.db')
# TABLES = ('students', 'attendance_log', 'department_calendar')


# @contextmanager
# def connect(db_path=DB_PATH):
#     # A connection per operation avoids sharing SQLite connections across threads.
#     conn = sqlite3.connect(str(db_path), timeout=15)
#     conn.row_factory = sqlite3.Row
#     conn.execute('PRAGMA foreign_keys = ON')
#     try:
#         with conn:
#             yield conn
#     finally:
#         conn.close()


# def initialize_database(db_path=DB_PATH, reset=False):
#     with connect(db_path) as conn:
#         if reset:
#             for table in ('attendance_log', 'department_calendar', 'students'):
#                 conn.execute(f'DROP TABLE IF EXISTS {table}')
#         conn.execute('''CREATE TABLE IF NOT EXISTS students (
#             student_id INTEGER PRIMARY KEY AUTOINCREMENT,
#             roll_no TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
#             department TEXT NOT NULL, email TEXT NOT NULL)''')
#         conn.execute('''CREATE TABLE IF NOT EXISTS department_calendar (
#             event_id INTEGER PRIMARY KEY AUTOINCREMENT,
#             event_title TEXT NOT NULL COLLATE NOCASE, date TEXT NOT NULL,
#             location TEXT NOT NULL COLLATE NOCASE, organizer TEXT NOT NULL,
#             UNIQUE(event_title, date, location))''')
#         conn.execute('''CREATE TABLE IF NOT EXISTS attendance_log (
#             log_id INTEGER PRIMARY KEY AUTOINCREMENT,
#             roll_no TEXT NOT NULL REFERENCES students(roll_no),
#             date TEXT NOT NULL,
#             status TEXT NOT NULL CHECK(status IN ('Present', 'Absent')),
#             source_type TEXT NOT NULL DEFAULT 'Voice' CHECK(source_type = 'Voice'),
#             UNIQUE(roll_no, date))''')
#         students = [('101', 'Rahul Sharma'), ('102', 'Priya Patel'),
#                     ('103', 'Aditya Diwanad'), ('104', 'Sneha Rao'),
#                     ('105', 'Arjun Kumar')]
#         conn.executemany('''INSERT INTO students(roll_no,name,department,email)
#             VALUES(?,?,?,?) ON CONFLICT(roll_no) DO NOTHING''',
#             [(roll, name, 'Information Science', f'student{roll}@example.edu')
#              for roll, name in students])
#         conn.executemany('''INSERT INTO department_calendar
#             (event_title,date,location,organizer) VALUES(?,?,?,?)
#             ON CONFLICT(event_title,date,location) DO NOTHING''', [
#                 ('Department Orientation', '2026-10-01', 'Seminar Hall', 'ISE Department'),
#                 ('Project Review', '2026-10-10', 'Lab 2', 'Project Coordinator')])


# def read_table(table, db_path=DB_PATH):
#     if table not in TABLES:  # SQL identifiers must be allowlisted, not user SQL.
#         raise ValueError('Unknown table')
#     with connect(db_path) as conn:
#         return [dict(row) for row in conn.execute(f'SELECT * FROM {table}')]


# if __name__ == '__main__':
#     parser = argparse.ArgumentParser(description=__doc__)
#     parser.add_argument('--reset', action='store_true')
#     args = parser.parse_args()
#     initialize_database(reset=args.reset)
#     print(f'Database ready: {DB_PATH}')






import os
import shutil
import sqlite3
from datetime import datetime, timedelta

DB_NAME = "college_department.db"


def backup_and_init_db():
  if os.path.exists(DB_NAME):
    backup_name = (
        f"college_department_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
    )
    shutil.copy(DB_NAME, backup_name)
    print(f"Backed up existing database to {backup_name}")

  conn = sqlite3.connect(DB_NAME)
  cursor = conn.cursor()

  # Create Tables
  cursor.execute("""
        CREATE TABLE IF NOT EXISTS students (
            student_id INTEGER PRIMARY KEY AUTOINCREMENT,
            roll_no TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            department TEXT NOT NULL
        )
    """)

  cursor.execute("""
        CREATE TABLE IF NOT EXISTS attendance_log (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            roll_no TEXT NOT NULL,
            status TEXT NOT NULL,
            date TEXT NOT NULL,
            confidence REAL DEFAULT 1.0,
            verified INTEGER DEFAULT 1
        )
    """)

  cursor.execute("""
        CREATE TABLE IF NOT EXISTS department_calendar (
            event_id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_title TEXT NOT NULL,
            date TEXT NOT NULL,
            time_slot TEXT NOT NULL,
            location TEXT NOT NULL,
            status TEXT DEFAULT 'Scheduled'
        )
    """)

  cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_trail (
            action_id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            raw_transcription TEXT,
            action_type TEXT NOT NULL,
            details TEXT
        )
    """)

  # Seed Students
  students = [
      ("101", "Aarav Sharma", "CSE"),
      ("102", "Ananya Verma", "CSE"),
      ("103", "Rohan Mehta", "CSE"),
      ("104", "Isha Patel", "CSE"),
      ("105", "Aditya Diwanad", "CSE"),
      ("106", "Priya Nair", "CSE"),
      ("107", "Karan Joshi", "CSE"),
      ("108", "Sneha Rao", "CSE"),
      ("109", "Vikram Singh", "CSE"),
      ("110", "Neha Gupta", "CSE"),
      ("111", "Rahul Kumar", "CSE"),
      ("112", "Pooja Das", "CSE"),
  ]

  cursor.executemany(
      "INSERT OR IGNORE INTO students (roll_no, name, department) VALUES (?,?,"
      " ?)",
      students,
  )

  # Seed Calendar Events
  events = [
      ("HOD Review Meeting", "2026-09-15", "10:00 AM - 11:00 AM", "Main Hall"),
      ("Mid-Term Lab Exam", "2026-09-15", "02:00 PM - 04:00 PM", "Lab 3"),
      ("Guest Lecture on AI", "2026-09-18", "11:00 AM - 01:00 PM", "Seminar Room A"),
      ("Faculty Development", "2026-09-20", "09:00 AM - 12:00 PM", "Main Hall"),
      ("Project Review", "2026-09-22", "02:00 PM - 05:00 PM", "Lab 3"),
      ("Department Sports Meet", "2026-09-25", "09:00 AM - 04:00 PM", "Ground"),
  ]

  cursor.executemany(
      "INSERT OR IGNORE INTO department_calendar (event_title, date, time_slot,"
      " location) VALUES (?, ?, ?, ?)",
      events,
  )

  conn.commit()
  conn.close()
  print("Database initialized and seeded successfully.")


if __name__ == "__main__":
  backup_and_init_db()