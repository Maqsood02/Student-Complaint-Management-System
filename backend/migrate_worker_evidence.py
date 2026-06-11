import os
import mysql.connector
from dotenv import load_dotenv

# Load env variables from backend/.env
env_path = 'backend/.env' if os.path.exists('backend/.env') else '.env'
load_dotenv(dotenv_path=env_path)

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
    
    # Describe complaints to check for existing columns
    cursor.execute("DESCRIBE complaints")
    columns = [col[0] for col in cursor.fetchall()]

    print("Altering complaints table to add worker evidence columns...")
    if 'worker_notes' not in columns:
        try:
            cursor.execute("ALTER TABLE complaints ADD COLUMN worker_notes TEXT NULL")
            conn.commit()
            print("Added worker_notes column.")
        except Exception as e:
            print(f"Error adding worker_notes column: {e}")
            
    if 'worker_evidence' not in columns:
        try:
            cursor.execute("ALTER TABLE complaints ADD COLUMN worker_evidence LONGTEXT NULL")
            conn.commit()
            print("Added worker_evidence column.")
        except Exception as e:
            print(f"Error adding worker_evidence column: {e}")

    cursor.close()
    conn.close()
    print("\nWorker Evidence Migration completed successfully!")
except Exception as e:
    print(f"Database error during migration: {e}")
