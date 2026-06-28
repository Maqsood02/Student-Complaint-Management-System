import os
import mysql.connector
from dotenv import load_dotenv

# Load configuration
load_dotenv(dotenv_path='backend/.env')

db_config = {
    "host": os.getenv("DB_HOST"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASS"),
    "database": os.getenv("DB_NAME")
}

try:
    print("Connecting to database...")
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()
    
    print("Altering complaints table columns for AES-256 storage compatibility...")
    
    # Modify student_name to VARCHAR(255)
    print("Altering student_name column to VARCHAR(255)...")
    cursor.execute("ALTER TABLE complaints MODIFY COLUMN student_name VARCHAR(255) NULL")
    
    # Modify student_email to VARCHAR(255)
    print("Altering student_email column to VARCHAR(255)...")
    cursor.execute("ALTER TABLE complaints MODIFY COLUMN student_email VARCHAR(255) NULL")
    
    conn.commit()
    print("Alter completed successfully!")
    
    print("\n--- Columns in complaints ---")
    cursor.execute("DESCRIBE complaints")
    for col in cursor.fetchall():
        if col[0] in ('student_name', 'student_email'):
            print(col)
            
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error executing migration: {e}")
