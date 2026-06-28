import os
import uuid
import datetime
import requests
import random
import threading
from flask import Flask, request, jsonify, session, send_from_directory, has_request_context
from flask_cors import CORS
import mysql.connector
from flask_bcrypt import Bcrypt
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

import base64
import hashlib
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import padding

class AES256Cipher:
    def __init__(self, key: str = None):
        if not key:
            key = os.getenv("AES_256_KEY")
        
        if not key:
            secret = os.getenv("FLASK_SECRET_KEY", "supersecretkey_scms_2026")
            self.key = hashlib.sha256(secret.encode('utf-8')).digest()
        else:
            try:
                decoded = base64.b64decode(key)
                if len(decoded) == 32:
                    self.key = decoded
                else:
                    raise ValueError()
            except Exception:
                self.key = hashlib.sha256(key.encode('utf-8')).digest()

    def encrypt(self, plaintext: str) -> str:
        if plaintext is None:
            return None
        if not isinstance(plaintext, str):
            plaintext = str(plaintext)
        if not plaintext.strip():
            return plaintext
        try:
            data = plaintext.encode('utf-8')
            iv = os.urandom(16)
            cipher = Cipher(algorithms.AES(self.key), modes.CBC(iv), backend=default_backend())
            encryptor = cipher.encryptor()
            padder = padding.PKCS7(128).padder()
            padded_data = padder.update(data) + padder.finalize()
            ciphertext = encryptor.update(padded_data) + encryptor.finalize()
            combined = iv + ciphertext
            return base64.b64encode(combined).decode('utf-8')
        except Exception as e:
            print(f"Encryption error: {e}")
            return plaintext

    def decrypt(self, ciphertext: str) -> str:
        if ciphertext is None:
            return None
        if not isinstance(ciphertext, str) or not ciphertext.strip():
            return ciphertext
        try:
            try:
                combined = base64.b64decode(ciphertext.encode('utf-8'), validate=True)
            except Exception:
                return ciphertext
            
            if len(combined) < 32:
                return ciphertext
                
            iv = combined[:16]
            actual_ciphertext = combined[16:]
            cipher = Cipher(algorithms.AES(self.key), modes.CBC(iv), backend=default_backend())
            decryptor = cipher.decryptor()
            padded_data = decryptor.update(actual_ciphertext) + decryptor.finalize()
            unpadder = padding.PKCS7(128).unpadder()
            data = unpadder.update(padded_data) + unpadder.finalize()
            return data.decode('utf-8')
        except Exception as e:
            return ciphertext

cipher_helper = AES256Cipher()

ENCRYPTED_FIELDS = {'student_name', 'student_email', 'title', 'description', 'attached_file', 'admin_reply', 'worker_notes', 'worker_evidence'}

def encrypt_complaint_dict(data: dict) -> dict:
    if not data:
        return data
    res = dict(data)
    for field in ENCRYPTED_FIELDS:
        if field in res and res[field] is not None:
            res[field] = cipher_helper.encrypt(res[field])
    return res

def decrypt_complaint_dict(data: dict) -> dict:
    if not data:
        return data
    res = dict(data)
    for field in ENCRYPTED_FIELDS:
        if field in res and res[field] is not None:
            val = res[field]
            if isinstance(val, (bytes, bytearray)):
                try:
                    val = val.decode('utf-8', errors='ignore')
                except Exception:
                    pass
            res[field] = cipher_helper.decrypt(str(val))
    return res

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
    "database": os.getenv("DB_NAME", "scms_db"),
    "charset": "utf8mb4",
    "use_unicode": True
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
        is_vercel = os.getenv("VERCEL") == "1"
        host = data.get('siteUrl')
        if not host:
            host = "http://localhost:5000"
            
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

# Helper: Trigger Node.js Email Service in Background
def trigger_email_service_async(data):
    try:
        # Pre-populate siteUrl from Flask request context in the main thread
        if 'siteUrl' not in data:
            host = ""
            if has_request_context():
                for header in ["X-Forwarded-Host", "X-Vercel-Deployment-Url", "Host"]:
                    val = request.headers.get(header)
                    if val and "localhost" not in val and "127.0.0.1" not in val:
                        proto = request.headers.get("X-Forwarded-Proto", "https")
                        host = f"{proto}://{val}"
                        break
            if not host and os.getenv("VERCEL_URL"):
                host = f"https://{os.getenv('VERCEL_URL')}"
            if not host and has_request_context():
                host = request.host_url.rstrip('/')
            if not host:
                host = "http://localhost:5000"
            host = host.rstrip('/')
            if os.getenv("VERCEL") == "1" and host.startswith("http://") and "localhost" not in host and "127.0.0.1" not in host:
                host = "https://" + host[7:]
            data['siteUrl'] = host

        # If on Vercel, execute synchronously to prevent container freezing and email lag
        if os.getenv("VERCEL") == "1":
            print("--- [VERCEL DETECTED] Sending email synchronously to prevent thread freezing ---")
            trigger_email_service(data)
        else:
            thread = threading.Thread(target=trigger_email_service, args=(data,))
            thread.daemon = True
            thread.start()
    except Exception as e:
        print(f"Failed to spawn email background thread/send: {e}")


# --- FRONTEND ROUTES ---

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html', max_age=0)

@app.route('/<path:path>')
def serve_static(path):
    # If the path exists as a file in the static folder, serve it
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    # Otherwise, fallback to index.html for SPA routing
    return send_from_directory(app.static_folder, 'index.html', max_age=0)

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

        # Send OTP via Email Service in background
        trigger_email_service_async({
            "studentEmail": email,
            "studentName": name,
            "category": "Verification",
            "title": "Email Verification Code",
            "otp": otp, 
            "description": f"Your verification code is: {otp}. It will expire in 10 minutes.",
            "complaintId": "AUTH-OTP"
        })

        return jsonify({
            "success": True, 
            "message": "OTP generated! Verification email sent.",
            "note": "proceed_anyway"
        })
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

        # Send Reset Code via Email Service in background
        trigger_email_service_async({
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

        identifier = email.strip() if email else ""
        user = None

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        is_emp_format = False
        if identifier.upper().startswith("EMP-"):
            is_emp_format = True
            try:
                emp_id = int(identifier[4:])
                cursor.execute("SELECT * FROM users WHERE id = %s AND role = 'employee'", (emp_id,))
                user = cursor.fetchone()
            except ValueError:
                pass
        else:
            cursor.execute("SELECT * FROM users WHERE email = %s", (identifier,))
            user = cursor.fetchone()
            
            if user and user['role'] == 'employee':
                cursor.close()
                conn.close()
                return jsonify({
                    "success": False, 
                    "message": "Employees must log in using their Employee ID (e.g., EMP-XXX)"
                }), 400

        cursor.close()
        conn.close()

        if user and bcrypt.check_password_hash(user['password'], password):
            # If the user logged in successfully, return their details
            return jsonify({
                "success": True,
                "user": {
                    "id": user['id'],
                    "name": user['name'],
                    "email": user['email'],
                    "role": user['role'],
                    "employee_role": user.get('employee_role')
                }
            })
        
        # Guide message in case of typo/incorrect ID or email
        ident_label = "Employee ID" if is_emp_format else "email"
        return jsonify({"success": False, "message": f"Invalid {ident_label} or password"}), 401
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
        
        # Encrypt fields for database storage
        enc_student_name = cipher_helper.encrypt(student_name)
        enc_student_email = cipher_helper.encrypt(student_email)
        enc_title = cipher_helper.encrypt(title)
        enc_description = cipher_helper.encrypt(description)
        enc_attached_file_value = cipher_helper.encrypt(attached_file_value) if attached_file_value else None

        cursor.execute("""
            INSERT INTO complaints (id, student_id, student_name, student_email, title, description, category, priority, status, attached_file)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'Pending', %s)
        """, (complaint_id, student_id, enc_student_name, enc_student_email, enc_title, enc_description, category, priority, enc_attached_file_value))
        conn.commit()

        # Trigger Email Service in background using plain text details
        email_data = {
            "studentEmail": student_email,
            "studentName": student_name,
            "category": category,
            "title": title,
            "description": description,
            "complaintId": complaint_id,
            "dept": dept, # Pass department for custom routing
            "attachedFile": attached_file_value # Include attachment string
        }
        trigger_email_service_async(email_data)

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
        
        # Check and add employee_role column to users table if it doesn't exist
        try:
            cursor.execute("SHOW COLUMNS FROM users LIKE 'employee_role'")
            result = cursor.fetchone()
            if not result:
                print("Adding 'employee_role' column to 'users' table...")
                cursor.execute("ALTER TABLE users ADD COLUMN employee_role VARCHAR(100) NULL")
                print("'employee_role' column added successfully.")
        except Exception as ex:
            print(f"Error checking/adding employee_role column: {ex}")
            
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
        
        # Exclude attached_file base64 data to keep dashboard load times extremely fast
        query_cols = "id, student_id, student_name, student_email, title, description, category, priority, status, admin_reply, assigned_to, assigned_to_name, resolution_deadline, created_at"
        if user_role == 'admin':
            cursor.execute(f"SELECT {query_cols} FROM complaints ORDER BY created_at DESC")
        elif user_role == 'employee':
            cursor.execute(f"SELECT {query_cols} FROM complaints WHERE assigned_to = %s ORDER BY created_at DESC", (user_id,))
        else:
            cursor.execute(f"SELECT {query_cols} FROM complaints WHERE student_id = %s ORDER BY created_at DESC", (user_id,))
        
        complaints = cursor.fetchall()
        
        # Decrypt complaint details
        complaints = [decrypt_complaint_dict(c) for c in complaints]
        
        # Format resolution_deadline and created_at if necessary
        for comp in complaints:
            if 'resolution_deadline' in comp and comp['resolution_deadline']:
                if isinstance(comp['resolution_deadline'], (datetime.datetime, datetime.date)):
                    comp['resolution_deadline'] = comp['resolution_deadline'].strftime('%Y-%m-%d %H:%M:%S')
            if 'created_at' in comp and comp['created_at']:
                if isinstance(comp['created_at'], (datetime.datetime, datetime.date)):
                    comp['created_at'] = comp['created_at'].isoformat()
                    
        return jsonify(complaints)
    except Exception as e:
        return jsonify({"success": False, "message": f"Database error: {str(e)}"}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
 
@app.route('/api/complaints/detail/<complaint_id>', methods=['GET'])
def get_complaint_detail(complaint_id):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM complaints WHERE id = %s", (complaint_id,))
        complaint = cursor.fetchone()
        if not complaint:
            return jsonify({"success": False, "message": "Complaint not found"}), 404
        
        # Decrypt complaint detail
        complaint = decrypt_complaint_dict(complaint)
        
        return jsonify(complaint)
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
    reply = data.get('reply') # employee notes / admin reply
    updater_role = data.get('updater_role')
    employee_name = data.get('employee_name')
    worker_evidence = data.get('worker_evidence') # base64 encoded proof image

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # Fetch details
        cursor.execute("SELECT student_id, student_email, student_name, title, assigned_to_name, worker_evidence, worker_notes FROM complaints WHERE id = %s", (cid,))
        comp = cursor.fetchone()
        
        if not comp:
            return jsonify({"success": False, "message": "Complaint not found"}), 404

        # Decrypt fetched details
        comp = decrypt_complaint_dict(comp)

        if updater_role == 'employee':
            # Enforce proof of work evidence if marking as Resolved
            db_status = status
            if status == "Resolved":
                db_status = "Under Review"
                if not worker_evidence or not str(worker_evidence).strip():
                    return jsonify({"success": False, "message": "Uploading proof of work evidence is mandatory to resolve a complaint."}), 400
            
            # Encrypt updates for DB storage
            enc_reply = cipher_helper.encrypt(reply) if reply else None
            enc_worker_evidence = cipher_helper.encrypt(worker_evidence) if worker_evidence else None

            # Update complaints table with worker notes and evidence
            cursor.execute("""
                UPDATE complaints 
                SET status = %s, worker_notes = %s, worker_evidence = %s 
                WHERE id = %s
            """, (db_status, enc_reply, enc_worker_evidence, cid))
            
            # Notify all admins in the database
            cursor.execute("SELECT id FROM users WHERE role = 'admin'")
            admins = cursor.fetchall()
            
            admin_msg = f"Worker {employee_name or comp.get('assigned_to_name', 'Employee')} updated complaint '{comp['title']}' to {db_status}."
            if status == "Resolved":
                admin_msg = f"📋 Review Required! Worker {employee_name or comp.get('assigned_to_name', 'Employee')} marked complaint '{comp['title']}' as Resolved. Review proof of work."
            
            for admin in admins:
                cursor.execute("""
                    INSERT INTO notifications (user_id, complaint_id, message) 
                    VALUES (%s, %s, %s)
                """, (admin['id'], cid, admin_msg))
                
            conn.commit()
            
            # Trigger email notification to admins
            admin_email_data = {
                "category": "Admin Status Update",
                "employeeName": employee_name or comp.get('assigned_to_name', 'Employee'),
                "complaintId": cid,
                "title": comp['title'],
                "status": db_status,
                "adminReply": reply or "No notes provided."
            }
            trigger_email_service_async(admin_email_data)
            
            return jsonify({"success": True, "message": "Progress details submitted to admins successfully."})
            
        else:
            # Updater is admin
            enc_reply = cipher_helper.encrypt(reply) if reply else None
            if priority:
                cursor.execute("""
                    UPDATE complaints SET status = %s, priority = %s, admin_reply = %s WHERE id = %s
                """, (status, priority, enc_reply, cid))
            else:
                cursor.execute("""
                    UPDATE complaints SET status = %s, admin_reply = %s WHERE id = %s
                """, (status, enc_reply, cid))
            
            # Smart notification for Student
            msg = f"Your complaint '{comp['title']}' is now {status}."
            if status == "Resolved":
                msg = f"Success! Your complaint '{comp['title']}' has been resolved."
            elif status == "In Progress":
                msg = f"Update: Work has started on your complaint '{comp['title']}'."
                
            cursor.execute("""
                INSERT INTO notifications (user_id, complaint_id, message) VALUES (%s, %s, %s)
            """, (comp['student_id'], cid, msg))
            
            conn.commit()
            
            # Trigger Email to Student in background
            raw_evidence = comp.get('worker_evidence')
            raw_notes = comp.get('worker_notes')

            email_data = {
                "studentEmail": comp['student_email'],
                "studentName": comp['student_name'],
                "complaintId": cid,
                "title": comp['title'],
                "status": status,
                "adminReply": reply,
                "workerEvidence": raw_evidence if raw_evidence else None,
                "workerNotes": raw_notes if raw_notes else None
            }
            trigger_email_service_async(email_data)
            
            return jsonify({"success": True, "message": "Complaint updated successfully and student notified."})


    except Exception as e:
        print(f"DEBUG UPDATE COMPLAINT ERROR: {e}")
        return jsonify({"success": False, "message": f"Database error: {str(e)}"}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# Store pending employee registrations
pending_employees = {}

@app.route('/api/admin/employees', methods=['GET'])
def admin_get_employees():
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name, email, role, employee_role FROM users WHERE role = 'employee' ORDER BY name ASC")
        employees = cursor.fetchall()
        return jsonify(employees)
    except Exception as e:
        return jsonify({"success": False, "message": f"Database error: {str(e)}"}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route('/api/admin/send-employee-otp', methods=['POST'])
def send_employee_otp():
    try:
        data = request.json
        name = data.get('name')
        email = data.get('email')
        password = data.get('password')
        employee_role = data.get('employee_role')
        
        if not email or not name or not password or not employee_role:
            return jsonify({"success": False, "message": "Missing fields"}), 400
            
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Email already registered"}), 400
        cursor.close()
        conn.close()
        
        otp = str(random.randint(100000, 999999))
        print(f"--- [EMPLOYEE OTP DEBUG] CODE FOR {email}: {otp} ---")
        pending_employees[email] = {
            "name": name,
            "password": password,
            "employee_role": employee_role,
            "otp": otp,
            "timestamp": datetime.datetime.now()
        }
        
        trigger_email_service_async({
            "employeeEmail": email,
            "employeeName": name,
            "category": "Employee OTP",
            "title": "Employee Verification Code",
            "otp": otp,
            "description": f"Verification code is: {otp}",
            "complaintId": "EMP-VERIFY"
        })
        
        return jsonify({"success": True, "message": "OTP sent to employee's email."})
    except Exception as e:
        print(f"EMPLOYEE OTP SEND ERROR: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/admin/verify-employee-otp', methods=['POST'])
def verify_employee_otp():
    try:
        data = request.json
        email = data.get('email')
        otp = data.get('otp')
        
        if not email or not otp:
            return jsonify({"success": False, "message": "Email and OTP required"}), 400
            
        emp_data = pending_employees.get(email)
        if not emp_data:
            return jsonify({"success": False, "message": "No pending employee registration found"}), 404
            
        if emp_data['otp'] != otp:
            return jsonify({"success": False, "message": "Invalid OTP code"}), 400
            
        hashed_pw = bcrypt.generate_password_hash(emp_data['password']).decode('utf-8')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (name, email, password, role, employee_role) VALUES (%s, %s, %s, 'employee', %s)",
                       (emp_data['name'], email, hashed_pw, emp_data.get('employee_role')))
        user_id = cursor.lastrowid
        conn.commit()
        cursor.close()
        conn.close()
        
        emp_id_str = f"EMP-{str(user_id).zfill(3)}"
        
        # Send Credentials Email
        trigger_email_service_async({
            "employeeEmail": email,
            "employeeName": emp_data['name'],
            "employeePassword": emp_data['password'],
            "employeeId": emp_id_str,
            "category": "Employee Credentials",
            "complaintId": "EMP-CREDS"
        })
        
        del pending_employees[email]
        return jsonify({"success": True, "message": "Employee registered successfully and credentials emailed."})
    except Exception as e:
        print(f"EMPLOYEE OTP VERIFY ERROR: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/complaints/assign', methods=['POST'])
def assign_complaint():
    try:
        data = request.json
        complaint_id = data.get('complaintId')
        employee_id = data.get('employeeId')
        employee_name = data.get('employeeName')
        deadline_str = data.get('deadline') # ISO string format
        
        if not complaint_id or not employee_id or not employee_name:
            return jsonify({"success": False, "message": "Missing assignment fields"}), 400
            
        # Format resolution deadline if provided
        deadline = None
        if deadline_str:
            try:
                if 'T' in deadline_str:
                    deadline = datetime.datetime.strptime(deadline_str.replace('Z', ''), '%Y-%m-%dT%H:%M')
                else:
                    deadline = datetime.datetime.strptime(deadline_str, '%Y-%m-%d %H:%M:%S')
            except ValueError:
                try:
                    deadline = datetime.datetime.fromisoformat(deadline_str.replace('Z', ''))
                except Exception:
                    pass
                    
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get employee details
        cursor.execute("SELECT name, email FROM users WHERE id = %s", (employee_id,))
        employee = cursor.fetchone()
        if not employee:
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Employee not found"}), 404
            
        # Update complaint assignment
        cursor.execute("SELECT status, title, description, category, student_email FROM complaints WHERE id = %s", (complaint_id,))
        comp = cursor.fetchone()
        if not comp:
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Complaint not found"}), 404
            
        # Decrypt complaint details
        comp = decrypt_complaint_dict(comp)
        
        new_status = 'In Progress' if comp['status'] == 'Pending' else comp['status']
        
        cursor.execute("""
            UPDATE complaints 
            SET assigned_to = %s, assigned_to_name = %s, resolution_deadline = %s, status = %s 
            WHERE id = %s
        """, (employee_id, employee['name'], deadline, new_status, complaint_id))
        
        # Insert Notification for Employee
        deadline_msg = f" Deadline: {deadline.strftime('%Y-%m-%d %H:%M')}" if deadline else ""
        cursor.execute("""
            INSERT INTO notifications (user_id, complaint_id, message) 
            VALUES (%s, %s, %s)
        """, (employee_id, complaint_id, f"📋 Complaint '{comp['title']}' has been assigned to you.{deadline_msg}"))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        # Send Email to Worker
        trigger_email_service_async({
            "employeeEmail": employee['email'],
            "employeeName": employee['name'],
            "category": "Worker Assignment",
            "title": comp['title'],
            "description": comp['description'],
            "complaintId": complaint_id,
            "deadline": deadline_str,
            "category_name": comp['category']
        })
        
        return jsonify({"success": True, "message": "Complaint assigned successfully."})
    except Exception as e:
        print(f"ASSIGN ERROR: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/admin/users', methods=['GET'])
def admin_get_users():
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name, email, role FROM users WHERE role != 'employee' ORDER BY name ASC")
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

@app.route('/api/complaints/<string:complaint_id>', methods=['DELETE'])
def delete_complaint(complaint_id):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 1. Delete notifications related to the complaint
        cursor.execute("DELETE FROM notifications WHERE complaint_id = %s", (complaint_id,))
        
        # 2. Delete the complaint itself
        cursor.execute("DELETE FROM complaints WHERE id = %s", (complaint_id,))
        
        conn.commit()
        return jsonify({"success": True, "message": "Complaint deleted successfully"})
    except Exception as e:
        return jsonify({"success": False, "message": f"Database error: {str(e)}"}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route('/api/change-password', methods=['POST'])
def change_password():
    try:
        data = request.json
        user_id = data.get('user_id')
        current_password = data.get('currentPassword')
        new_password = data.get('newPassword')

        if not user_id or not current_password or not new_password:
            return jsonify({"success": False, "message": "Missing fields"}), 400

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT password FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "User not found"}), 404

        # Verify current password
        if not bcrypt.check_password_hash(user['password'], current_password):
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "Incorrect current password"}), 401

        # Hash and update new password
        hashed_pw = bcrypt.generate_password_hash(new_password).decode('utf-8')
        cursor.execute("UPDATE users SET password = %s WHERE id = %s", (hashed_pw, user_id))
        conn.commit()
        
        cursor.close()
        conn.close()
        return jsonify({"success": True, "message": "Password updated successfully"})
    except Exception as e:
        print(f"CHANGE PASSWORD ERROR: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/complaints/overdue-notify', methods=['POST'])
def overdue_notify():
    """Called by the frontend countdown timer when a deadline expires."""
    data = request.json
    complaint_id = data.get('complaintId')
    if not complaint_id:
        return jsonify({"success": False, "message": "Missing complaintId"}), 400

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Only notify if complaint is still active (not yet resolved / under review)
        cursor.execute(
            "SELECT id, title, assigned_to, assigned_to_name, resolution_deadline, status FROM complaints WHERE id = %s",
            (complaint_id,)
        )
        comp = cursor.fetchone()
        if not comp:
            return jsonify({"success": False, "message": "Complaint not found"}), 404

        # Decrypt complaint details
        comp = decrypt_complaint_dict(comp)

        if comp['status'] in ('Resolved', 'Under Review'):
            return jsonify({"success": True, "message": "Complaint already resolved/under review — no alert needed."})

        # Build overdue notification for all admins
        cursor.execute("SELECT id FROM users WHERE role = 'admin'")
        admins = cursor.fetchall()

        deadline_str = ""
        if comp['resolution_deadline']:
            if isinstance(comp['resolution_deadline'], (datetime.datetime, datetime.date)):
                deadline_str = comp['resolution_deadline'].strftime('%Y-%m-%d %H:%M')
            else:
                deadline_str = str(comp['resolution_deadline'])

        overdue_msg = (
            f"⚠️ OVERDUE ALERT! Complaint '{comp['title']}' assigned to "
            f"{comp['assigned_to_name'] or 'an employee'} has exceeded its deadline"
            f"{' (' + deadline_str + ')' if deadline_str else ''}. Immediate action required."
        )

        for admin in admins:
            cursor.execute(
                "INSERT INTO notifications (user_id, complaint_id, message) VALUES (%s, %s, %s)",
                (admin['id'], complaint_id, overdue_msg)
            )
        conn.commit()

        # Send admin alert email
        trigger_email_service_async({
            "category": "Deadline Overdue",
            "complaintId": complaint_id,
            "title": comp['title'],
            "employeeName": comp['assigned_to_name'] or "Assigned Employee",
            "deadline": deadline_str,
            "status": comp['status']
        })

        return jsonify({"success": True, "message": "Overdue alert sent to admins."})
    except Exception as e:
        print(f"OVERDUE NOTIFY ERROR: {e}")
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


if __name__ == '__main__':
    app.run(debug=True, port=5000)

