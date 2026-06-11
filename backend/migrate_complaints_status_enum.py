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
    
    print("Modifying complaints table status column to include 'Under Review'...")
    try:
        cursor.execute("ALTER TABLE complaints MODIFY COLUMN status ENUM('Pending', 'In Progress', 'Under Review', 'Resolved') DEFAULT 'Pending'")
        conn.commit()
        print("Complaints table status ENUM modified successfully.")
    except Exception as e:
        print(f"Error modifying complaints table status ENUM: {e}")

    cursor.close()
    conn.close()
    print("\nENUM Status Migration completed successfully!")
except Exception as e:
    print(f"Database connection error: {e}")
