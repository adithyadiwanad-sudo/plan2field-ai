import json
import os
import re
import sqlite3
from datetime import datetime
import pandas as pd
import plotly.express as px
import streamlit as st

# Automatically initialize database if missing (Crucial for Streamlit Cloud)
import database_setup

if not os.path.exists("college_department.db"):
  database_setup.backup_and_init_db()

DB_NAME = "college_department.db"

st.set_page_config(
    page_title="Plan2Field AI - Voice Desk", layout="wide", page_icon="🎙️"
)

# Custom Dark Theme Styling
st.markdown(
    """
    <style>
    .metric-card {
        background-color: #1e1e2e;
        padding: 15px;
        border-radius: 10px;
        border: 1px solid #313244;
        text-align: center;
    }
    </style>
""",
    unsafe_allow_html=True,
)


def get_db_connection():
  conn = sqlite3.connect(DB_NAME, timeout=10)
  conn.row_factory = sqlite3.Row
  return conn


# Header
st.title("🎙️ Plan2Field AI: Department Voice Desk")
st.caption(
    "Voice Ingestion ➔ AI Extraction ➔ Entity Matching ➔ Dashboard Update"
)

# Metric Row
col1, col2, col3, col4 = st.columns(4)
conn = get_db_connection()
total_students = conn.execute("SELECT COUNT(*) FROM students").fetchone()[0]
total_events = conn.execute(
    "SELECT COUNT(*) FROM department_calendar"
).fetchone()[0]
conn.close()

col1.markdown(
    f"<div class='metric-card'><h4>Total Students</h4>2>{total_students}</h2></div>",
    unsafe_allow_html=True,
)
col2.markdown(
    "<div class='metric-card'><h4>Active Department</h4><h2>CSE</h2></div>",
    unsafe_allow_html=True,
)
col3.markdown(
    f"<div class='metric-card'><h4>Scheduled Events</h4><h2>{total_events}</h2></div>",
    unsafe_allow_html=True,
)
col4.markdown(
    "<div class='metric-card'><h4>System Engine</h4><h2>Whisper + SQLite</h2></div>",
    unsafe_allow_html=True,
)

st.write("---")

# Tab Layout
tab1, tab2, tab3, tab4 = st.tabs([
    "🎙️ Voice Command Center",
    "📋 Attendance Analytics",
    "📅 Department Calendar",
    "🗄️ Audit & Database",
])

with tab1:
  st.subheader("Voice Processing Engine")
  transcription_input = st.text_area(
      "Spoken Command / Transcription Input",
      placeholder="e.g., Roll 101 present, Roll 102 absent",
  )

  if st.button("Process Command"):
    pattern = (
        r"(?:roll\s*no\.?|roll\s*)?(\d{3})\s*(?:is\s*)?(present|absent)"
    )
    matches = re.findall(pattern, transcription_input, re.IGNORECASE)

    if matches:
      df_matches = pd.DataFrame([
          {
              "Roll No": r,
              "Status": s.capitalize(),
              "Confidence": 0.95,
              "Date": datetime.now().strftime("%Y-%m-%d"),
          }
          for r, s in matches
      ])
      st.write("### Review Extracted Records")
      edited_df = st.data_editor(df_matches, num_rows="dynamic")

      if st.button("Save Records to Database"):
        conn = get_db_connection()
        cursor = conn.cursor()
        for idx, row in edited_df.iterrows():
          cursor.execute(
              "INSERT INTO attendance_log (roll_no, status, date, confidence)"
              " VALUES (?, ?, ?, ?)",
              (row["Roll No"], row["Status"], row["Date"], row["Confidence"]),
          )
        conn.commit()
        conn.close()
        st.success("Successfully logged into database!")

with tab2:
  st.subheader("Attendance Distribution")
  conn = get_db_connection()
  df_att = pd.read_sql_query("SELECT * FROM attendance_log", conn)
  conn.close()

  if not df_att.empty:
    fig = px.pie(
        df_att,
        names="status",
        title="Overall Attendance Percentage",
        color_discrete_sequence=["#2e7d32", "#c62828"],
    )
    st.plotly_chart(fig, use_container_width=True)
  else:
    st.info("No attendance records logged yet.")

with tab3:
  st.subheader("Department Calendar & Conflict Check")
  conn = get_db_connection()
  df_cal = pd.read_sql_query("SELECT * FROM department_calendar", conn)
  conn.close()
  st.dataframe(df_cal, use_container_width=True)

with tab4:
  st.subheader("System Audit Log")
  conn = get_db_connection()
  df_audit = pd.read_sql_query(
      "SELECT * FROM audit_trail ORDER BY action_id DESC", conn
  )
  conn.close()
  st.dataframe(df_audit, use_container_width=True)