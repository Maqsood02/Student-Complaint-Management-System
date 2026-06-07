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
    cursor = conn.cursor()
    
    for table in ['users', 'complaints', 'notifications']:
        print(f"\n--- Columns in {table} ---")
        try:
            cursor.execute(f"DESCRIBE {table}")
            cols = cursor.fetchall()
            for col in cols:
                print(col)
        except Exception as ex:
            print(f"Error describing {table}: {ex}")
            
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Connection Error: {e}")
