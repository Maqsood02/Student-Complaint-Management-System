# Trigger Vercel build with updated environment variables
import os
import uuid
import datetime
import requests
import random
from flask import Flask, request, jsonify, session, send_from_directory, has_request_context
from flask_cors import CORS
import mysql.connector
from flask_bcrypt import Bcrypt
from dotenv import load_dotenv

load_dotenv()

frontend_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend')
app = Flask(__name__, static_folder=frontend_dir, static_url_path='')
app.secret_key = os.getenv("FLASK_SECRET_KEY", "scms_secret_key_123")
CORS(app, supports_credentials=True)
bcrypt = Bcrypt(app)

# Database Configuration
# NOTE: If DB_PASS is empty in .env, os.getenv returns "", which might be wrong if a password is required.
_db_pass = os.getenv("DB_PASS")
if not _db_pass: # Handles both missing and empty strings
    _db_pass = "Maqs@879240"

_db_port = os.getenv("DB_PORT", "3306")
if not _db_port or not str(_db_port).strip():
    _db_port = 3306
else:
    try:
        _db_port = int(_db_port)
    except ValueError:
        _db_port = 3306

db_config = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": _db_port,
    "user": os.getenv("DB_USER", "root"),
    "password": _db_pass,
    "database": os.getenv("DB_NAME", "scms_db")
}

# Upload Folder Configuration (use /tmp on Vercel to bypass read-only filesystem restrictions)
if os.getenv("VERCEL") == "1":
    UPLOAD_FOLDER = "/tmp"
else:
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')



def get_db_connection():
    try:
        return mysql.connector.connect(**db_config)
    except Exception as e:
        print(f"DATABASE CONNECTION ERROR: {e}")
        raise e

# Ensure Admin User Exists
def init_admin():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE email = 'admin@scms.edu'")
        admin_user = cursor.fetchone()
        
        is_invalid = False
        if admin_user:
            pw = admin_user.get('password', '')
            if not pw or len(pw) != 60 or not (pw.startswith('$2a$') or pw.startswith('$2b$') or pw.startswith('$2y$')):
                is_invalid = True
                
        if not admin_user or is_invalid:
            hashed_pw = bcrypt.generate_password_hash('admin123').decode('utf-8')
            if is_invalid:
                print("--- DETECTED INVALID ADMIN PASSWORD HASH. UPDATING... ---")
                cursor.execute("UPDATE users SET name = 'System Admin', password = %s, role = 'admin' WHERE email = 'admin@scms.edu'", (hashed_pw,))
            else:
                cursor.execute("INSERT INTO users (name, email, password, role) VALUES (%s, %s, %s, %s)",
                               ('System Admin', 'admin@scms.edu', hashed_pw, 'admin'))
            conn.commit()
            print("--- ADMIN ACCOUNT CREATED/RESET ---")
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Admin Init Failed: {e}")


init_admin()

# Helper: Trigger Node.js Email Service
def trigger_email_service(data):
    try:
        # Determine service URL and dynamic siteUrl based on environment
        is_vercel = os.getenv("VERCEL") == "1"
        host = ""
        
        if has_request_context():
            # Check headers in order of reliability for public domain
            for header in ["X-Forwarded-Host", "X-Vercel-Deployment-Url", "Host"]:
                val = request.headers.get(header)
                if val and "localhost" not in val and "127.0.0.1" not in val:
                    proto = request.headers.get("X-Forwarded-Proto", "https")
                    host = f"{proto}://{val}"
                    break
        
        # If still not resolved and we are on Vercel, use VERCEL_URL env
        if not host and os.getenv("VERCEL_URL"):
            host = f"https://{os.getenv('VERCEL_URL')}"
            
        # If still not resolved, use request.host_url if context exists
        if not host and has_request_context():
            host = request.host_url.rstrip('/')
            
        # Final local fallback
        if not host:
            host = "http://localhost:5000"
            
        # Clean up and ensure https on Vercel
        host = host.rstrip('/')
        if is_vercel and host.startswith("http://") and "localhost" not in host and "127.0.0.1" not in host:
            host = "https://" + host[7:]
            
        # Add siteUrl to the email payloads
        data['siteUrl'] = host
        
        if is_vercel:
            url = f"{host}/api/send-email"
        else:
            url = f"http://localhost:{os.getenv('EMAIL_SERVICE_PORT', '5001')}/api/send-email"
            
        print(f"Triggering email service at: {url} with siteUrl: {host}")
        # Use an 8.0s timeout which is safe on serverless environments to prevent 504 Gateway Timeouts
        response = requests.post(url, json=data, timeout=8.0)
        print(f"Email service response status: {response.status_code}")
        return response.json()
    except Exception as e:
        print(f"Email Service Error: {e}")
        return {"success": False, "error": str(e)}

# --- FRONTEND ROUTES ---

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    # If the path exists as a file in the static folder, serve it
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    # Otherwise, fallback to index.html for SPA routing
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

# --- AUTH & OTP ROUTES ---

# Store pending registrations in memory (for demo, sessions are better)
# format: { email: { name, password, otp } }
pending_users = {}

@app.route('/api/send-otp', methods=['POST'])
def send_otp():
    try:
        data = request.json
        email = data.get('email')
        name = data.get('name')
        password = data.get('password')

        if not email or not name or not password:
            return jsonify({"success": False, "message": "Missing fields"}), 400

        # Check if user already exists
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({"success": False, "message": "Email already registered"}), 400
        cursor.close()
        conn.close()

        # Generate 6-digit OTP
        otp = str(random.randint(100000, 999999))
        print(f"--- [OTP DEBUG] CODE FOR {email}: {otp} ---")
        pending_users[email] = {
            "name": name,
            "password": password,
            "otp": otp,
            "timestamp": datetime.datetime.now()
        }

        # Send OTP via Email Service
        email_res = trigger_email_service({
            "studentEmail": email,
            "studentName": name,
            "category": "Verification",
            "title": "Email Verification Code",
            "otp": otp, 
            "description": f"Your verification code is: {otp}. It will expire in 10 minutes.",
            "complaintId": "AUTH-OTP"
        })

        # IMPROVEMENT: Even if email fails, let user proceed so they can use terminal OTP
        if not email_res or not email_res.get('success'):
            print(f"--- [EMAIL FAILED] Use Terminal OTP: {otp} ---")
            return jsonify({
                "success": True, 
                "message": "OTP generated! (Email service was busy, please check terminal/support)",
                "note": "proceed_anyway"
            })

        return jsonify({"success": True, "message": "OTP sent successfully"})
    except Exception as e:
        print(f"OTP SEND ERROR: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/verify-otp', methods=['POST'])
def verify_otp():
    try:
        data = request.json
        email = data.get('email')
        otp = data.get('otp')

        if not email or not otp:
            return jsonify({"success": False, "message": "Email and OTP required"}), 400

        user_data = pending_users.get(email)
        if not user_data:
            return jsonify({"success": False, "message": "No pending registration found"}), 404

        if user_data['otp'] != otp:
            return jsonify({"success": False, "message": "Invalid OTP code"}), 400

        # Success! Create the user
        hashed_pw = bcrypt.generate_password_hash(user_data['password']).decode('utf-8')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (name, email, password, role) VALUES (%s, %s, %s, 'student')", 
                       (user_data['name'], email, hashed_pw))
        conn.commit()
        cursor.close()
        conn.close()

        # Clear pending data
        del pending_users[email]

        return jsonify({"success": True, "message": "Account verified and created successfully"})
    except Exception as e:
        print(f"OTP VERIFY ERROR: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Store reset codes in memory
# format: { email: { code, timestamp } }
reset_codes = {}

@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    try:
        data = request.json
        email = data.get('email')

        # Check if user exists
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()

        if not user:
            return jsonify({"success": False, "message": "No account found with this email"}), 404

        # Generate 6-digit reset code
        code = str(random.randint(100000, 999999))
        print(f"--- [RESET DEBUG] CODE FOR {email}: {code} ---")
        reset_codes[email] = {
            "code": code,
            "timestamp": datetime.datetime.now()
        }

        # Send Reset Code via Email Service
        trigger_email_service({
            "studentEmail": email,
            "studentName": user['name'],
            "category": "Security",
            "title": "Password Reset Code",
            "otp": code, 
            "description": f"Your password reset code is: {code}. If you did not request this, please ignore this email.",
            "complaintId": "RESET-PWD"
        })

        return jsonify({"success": True, "message": "Reset code sent successfully"})
    except Exception as e:
        print(f"FORGOT PWD ERROR: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    try:
        data = request.json
        email = data.get('email')
        code = data.get('code')
        new_password = data.get('newPassword')

        if not email or not code or not new_password:
            return jsonify({"success": False, "message": "Missing fields"}), 400

        reset_data = reset_codes.get(email)
        if not reset_data or reset_data['code'] != code:
            return jsonify({"success": False, "message": "Invalid reset code"}), 400

        # Check for 10-minute expiration
        time_diff = datetime.datetime.now() - reset_data['timestamp']
        if time_diff.total_seconds() > 600: # 600 seconds = 10 minutes
            del reset_codes[email]
            return jsonify({"success": False, "message": "Reset code has expired. Please request a new one."}), 400

        # Update Password
        hashed_pw = bcrypt.generate_password_hash(new_password).decode('utf-8')
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET password = %s WHERE email = %s", (hashed_pw, email))
        conn.commit()
        cursor.close()
        conn.close()

        # Clear reset data
        del reset_codes[email]

        return jsonify({"success": True, "message": "Password updated successfully"})
    except Exception as e:
        print(f"RESET PWD ERROR: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()

        if user and bcrypt.check_password_hash(user['password'], password):
            return jsonify({
                "success": True,
                "user": {
                    "id": user['id'],
                    "name": user['name'],
                    "email": user['email'],
                    "role": user['role']
                }
            })
        
        return jsonify({"success": False, "message": "Invalid email or password"}), 401
    except Exception as e:
        print(f"DEBUG LOGIN ERROR: {e}")
        return jsonify({"success": False, "message": f"Database Error: {str(e)}"}), 500

# --- COMPLAINT ROUTES ---

@app.route('/api/complaints', methods=['POST'])
def submit_complaint():
    # Use form data for file uploads
    title = request.form.get('title')
    description = request.form.get('description')
    category = request.form.get('category')
    priority = request.form.get('priority', 'Medium')
    student_id = request.form.get('student_id')
    student_name = request.form.get('student_name')
    student_email = request.form.get('student_email')
    classroom = request.form.get('classroom')
    dept = request.form.get('dept')

    if classroom or dept:
        loc_str = f"{dept if dept else ''} - {classroom if classroom else ''}".strip(' - ')
        description = f"[[ LOCATION: {loc_str} ]] \n\n {description}"

    file_base64 = request.form.get('file_base64')
    attached_file_value = None
    if file_base64:
        attached_file_value = file_base64
    else:
        file = request.files.get('file')
        if file:
            filename = f"{uuid.uuid4()}_{file.filename}"
            try:
                if not os.path.exists(UPLOAD_FOLDER):
                    os.makedirs(UPLOAD_FOLDER)
                file.save(os.path.join(UPLOAD_FOLDER, filename))
                attached_file_value = filename
            except Exception as e:
                return jsonify({"success": False, "message": f"File save failed: {str(e)}"}), 500

    complaint_id = f"CMP-{uuid.uuid4().hex[:6].upper()}"
    
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO complaints (id, student_id, student_name, student_email, title, description, category, priority, status, attached_file)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'Pending', %s)
        """, (complaint_id, student_id, student_name, student_email, title, description, category, priority, attached_file_value))
        conn.commit()

        # Trigger Email Service
        email_data = {
            "studentEmail": student_email,
            "studentName": student_name,
            "category": category,
            "title": title,
            "description": description,
            "complaintId": complaint_id,
            "dept": dept # Pass department for custom routing
        }
        trigger_email_service(email_data)

        return jsonify({"success": True, "complaint_id": complaint_id})
    except Exception as e:
        return jsonify({"success": False, "message": f"Database error: {str(e)}"}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# Initialize Tables
def init_db():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                complaint_id VARCHAR(50),
                message TEXT,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"DB Init Failed: {e}")

init_db()

@app.route('/api/notifications/<user_id>', methods=['GET'])
def get_notifications(user_id):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM notifications WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
        notes = cursor.fetchall()
        return jsonify(notes)
    except Exception as e:
        return jsonify({"success": False, "message": f"Database error: {str(e)}"}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route('/api/notifications/read/<user_id>', methods=['POST'])
def mark_read(user_id):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE notifications SET is_read = TRUE WHERE user_id = %s", (user_id,))
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": f"Database error: {str(e)}"}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route('/api/complaints/<user_role>/<user_id>', methods=['GET'])
def get_complaints(user_role, user_id):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        if user_role == 'admin':
            cursor.execute("SELECT * FROM complaints ORDER BY created_at DESC")
        else:
            cursor.execute("SELECT * FROM complaints WHERE student_id = %s ORDER BY created_at DESC", (user_id,))
        
        complaints = cursor.fetchall()
        return jsonify(complaints)
    except Exception as e:
        return jsonify({"success": False, "message": f"Database error: {str(e)}"}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route('/api/complaints/update', methods=['POST'])
def update_complaint():
    data = request.json
    cid = data.get('id')
    status = data.get('status')
    priority = data.get('priority')
    reply = data.get('reply')

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # 1. Fetch Student Details
        cursor.execute("SELECT student_id, student_email, student_name, title FROM complaints WHERE id = %s", (cid,))
        comp = cursor.fetchone()
        
        if not comp:
            return jsonify({"success": False, "message": "Complaint not found"}), 404

        # 2. Update Complaint
        cursor.execute("""
            UPDATE complaints SET status = %s, priority = %s, admin_reply = %s WHERE id = %s
        """, (status, priority, reply, cid))
        
        # 3. Add Smart Notification
        msg = f"Your complaint '{comp['title']}' is now {status}."
        if status == "Resolved":
            msg = f"✅ Success! Your complaint '{comp['title']}' has been resolved."
        elif status == "In Progress":
            msg = f"⏳ Update: Work has started on your complaint '{comp['title']}'."
            
        cursor.execute("""
            INSERT INTO notifications (user_id, complaint_id, message) VALUES (%s, %s, %s)
        """, (comp['student_id'], cid, msg))
        
        conn.commit()

        # 4. Trigger Email to Student
        email_data = {
            "studentEmail": comp['student_email'],
            "studentName": comp['student_name'],
            "complaintId": cid,
            "title": comp['title'],
            "status": status,
            "adminReply": reply
        }
        trigger_email_service(email_data)

        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": f"Database error: {str(e)}"}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route('/api/admin/users', methods=['GET'])
def admin_get_users():
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name, email, role FROM users ORDER BY name ASC")
        users = cursor.fetchall()
        return jsonify(users)
    except Exception as e:
        return jsonify({"success": False, "message": f"Database error: {str(e)}"}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route('/api/admin/users', methods=['POST'])
def admin_create_user():
    data = request.json
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'student')

    if not name or not email or not password:
        return jsonify({"success": False, "message": "All fields are required"}), 400

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({"success": False, "message": "Email is already registered"}), 400

        hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')
        cursor.execute("INSERT INTO users (name, email, password, role) VALUES (%s, %s, %s, %s)",
                       (name, email, hashed_pw, role))
        conn.commit()
        return jsonify({"success": True, "message": "User registered successfully"})
    except Exception as e:
        return jsonify({"success": False, "message": f"Database error: {str(e)}"}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
def admin_delete_user(user_id):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT email, role FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404
        
        if user['email'] == 'admin@scms.edu':
            return jsonify({"success": False, "message": "Cannot delete primary system administrator account"}), 400

        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
        return jsonify({"success": True, "message": "User account deleted successfully"})
    except Exception as e:
        return jsonify({"success": False, "message": f"Database error: {str(e)}"}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
