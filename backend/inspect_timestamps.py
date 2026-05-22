import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv(dotenv_path='backend/.env')

db_config = {
    "host": os.getenv("DB_HOST"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASS"),
    "database": os.getenv("DB_NAME")
}

try:
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, title, created_at, attached_file FROM complaints ORDER BY created_at DESC LIMIT 5")
    rows = cursor.fetchall()
    for row in rows:
        print(f"ID: {row['id']}, Title: {row['title']}, Created At: {row['created_at']}, Attached: {row['attached_file'][:50] if row['attached_file'] else 'None'}")
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
