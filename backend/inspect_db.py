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
    
    cursor.execute("SELECT id, title, attached_file FROM complaints ORDER BY created_at DESC LIMIT 5")
    rows = cursor.fetchall()
    print("Last 5 complaints:")
    for row in rows:
        attached = row['attached_file']
        if attached:
            print(f"ID: {row['id']}, Title: {row['title']}, Attached file type: {type(attached)}, Length: {len(attached)}")
            print(f"First 100 chars: {attached[:100]}")
        else:
            print(f"ID: {row['id']}, Title: {row['title']}, Attached file: None")
            
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
