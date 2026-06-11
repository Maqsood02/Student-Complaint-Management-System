import os
import mysql.connector
from dotenv import load_dotenv

# Load env variables from backend/.env
# Since we might execute from the backend folder or root folder, handle both
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
    
    print("Modifying users table to allow 'employee' role...")
    try:
        cursor.execute("ALTER TABLE users MODIFY COLUMN role ENUM('student', 'admin', 'employee') DEFAULT 'student'")
        conn.commit()
        print("Users table modified successfully.")
    except Exception as e:
        print(f"Error modifying users table: {e}")

    # Describe complaints to check for existing columns
    cursor.execute("DESCRIBE complaints")
    columns = [col[0] for col in cursor.fetchall()]

    print("Altering complaints table to add assignment columns...")
    if 'assigned_to' not in columns:
        try:
            cursor.execute("ALTER TABLE complaints ADD COLUMN assigned_to INT NULL")
            conn.commit()
            print("Added assigned_to column.")
        except Exception as e:
            print(f"Error adding assigned_to column: {e}")
            
    if 'assigned_to_name' not in columns:
        try:
            cursor.execute("ALTER TABLE complaints ADD COLUMN assigned_to_name VARCHAR(100) NULL")
            conn.commit()
            print("Added assigned_to_name column.")
        except Exception as e:
            print(f"Error adding assigned_to_name column: {e}")

    if 'resolution_deadline' not in columns:
        try:
            cursor.execute("ALTER TABLE complaints ADD COLUMN resolution_deadline DATETIME NULL")
            conn.commit()
            print("Added resolution_deadline column.")
        except Exception as e:
            print(f"Error adding resolution_deadline column: {e}")

    # Add Foreign Key constraint for assigned_to
    print("Checking/adding foreign key constraint for assigned_to...")
    try:
        # We try to add foreign key, if it fails because it already exists, that's fine
        cursor.execute("ALTER TABLE complaints ADD CONSTRAINT fk_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL")
        conn.commit()
        print("Added foreign key constraint successfully.")
    except Exception as e:
        print(f"Foreign key constraint already exists or error: {e}")

    # Verify tables
    for table in ['users', 'complaints']:
        print(f"\n--- Current Columns in {table} ---")
        cursor.execute(f"DESCRIBE {table}")
        cols = cursor.fetchall()
        for col in cols:
            print(col)

    cursor.close()
    conn.close()
    print("\nMigration completed successfully!")
except Exception as e:
    print(f"Database connection error: {e}")
