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
    
    db_name = db_config["database"]
    print(f"Altering database '{db_name}' to character set utf8mb4...")
    cursor.execute(f"ALTER DATABASE {db_name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    conn.commit()
    print("Database charset altered successfully.")
    
    for table in ['users', 'complaints', 'notifications']:
        print(f"Converting table '{table}' to utf8mb4...")
        cursor.execute(f"ALTER TABLE {table} CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        conn.commit()
        print(f"Table '{table}' converted successfully.")
        
    cursor.close()
    conn.close()
    print("\nUTF8MB4 Migration completed successfully!")
except Exception as e:
    print(f"Database error during migration: {e}")
