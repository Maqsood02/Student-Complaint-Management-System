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
    
    print("Altering table notifications to add complaint_id...")
    cursor.execute("ALTER TABLE notifications ADD COLUMN complaint_id VARCHAR(50) NULL AFTER user_id")
    conn.commit()
    print("Alter completed successfully!")
    
    cursor.execute("DESCRIBE notifications")
    for col in cursor.fetchall():
        print(col)
        
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error executing migration: {e}")
