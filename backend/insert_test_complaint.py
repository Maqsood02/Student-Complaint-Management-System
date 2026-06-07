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

# Red dot base64 PNG
test_base64_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="

try:
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)
    
    # Get a valid student user
    cursor.execute("SELECT id, name, email FROM users WHERE role = 'student' LIMIT 1")
    user = cursor.fetchone()
    
    if not user:
        # Get any user if no student exists
        cursor.execute("SELECT id, name, email FROM users LIMIT 1")
        user = cursor.fetchone()
        
    if not user:
        print("Error: No users found in database to link the complaint.")
        cursor.close()
        conn.close()
        exit(1)
        
    complaint_id = "CMP-TEST64"
    
    # Delete test complaint if it already exists
    cursor.execute("DELETE FROM complaints WHERE id = %s", (complaint_id,))
    
    query = """
        INSERT INTO complaints (id, student_id, student_name, student_email, title, description, category, priority, status, attached_file)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'Pending', %s)
    """
    
    cursor.execute(query, (
        complaint_id,
        user['id'],
        user['name'],
        user['email'],
        "Test Base64 Image Display",
        "This is a test complaint to verify if the frontend displays base64 evidence images successfully without failing.",
        "Technical",
        "Medium",
        test_base64_image
    ))
    
    conn.commit()
    print(f"Success! Inserted test complaint '{complaint_id}' for user '{user['name']}' with base64 attachment.")
    
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
