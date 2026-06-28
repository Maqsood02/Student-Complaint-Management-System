import os
import sys
import mysql.connector
from dotenv import load_dotenv

# Ensure backend directory is in the import path
sys.path.append(os.path.dirname(__file__))

from app import db_config, decrypt_complaint_dict, encrypt_complaint_dict, cipher_helper

def test_integration():
    print("=== RUNNING AES-256 DB INTEGRATION TESTS ===")
    
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)
    
    # 1. Verify Legacy compatibility (CMP-TEST64)
    print("\n[Step 1] Querying legacy complaint CMP-TEST64...")
    cursor.execute("SELECT * FROM complaints WHERE id = 'CMP-TEST64'")
    legacy = cursor.fetchone()
    if not legacy:
        print("Error: CMP-TEST64 not found.")
        sys.exit(1)
        
    print(f"Direct DB title: {legacy['title']}")
    decrypted_legacy = decrypt_complaint_dict(legacy)
    print(f"Decrypted title: {decrypted_legacy['title']}")
    
    assert decrypted_legacy['title'] == "Test Base64 Image Display", "Legacy decryption mismatch!"
    print("Legacy test passed: Successfully read plain text record without decryption errors.")
    
    # 2. Verify Encryption at rest (CMP-AES256)
    print("\n[Step 2] Inserting encrypted complaint CMP-AES256...")
    cursor.execute("DELETE FROM complaints WHERE id = 'CMP-AES256'")
    conn.commit()
    
    test_comp = {
        "id": "CMP-AES256",
        "student_id": 1,
        "student_name": "Alice Green",
        "student_email": "alice.green@scms.edu",
        "title": "AES-256 Rest Security Test Title",
        "description": "AES-256 Rest Security Test Description content.",
        "category": "Facility",
        "priority": "Medium",
        "attached_file": None
    }
    
    encrypted_comp = encrypt_complaint_dict(test_comp)
    
    query = """
        INSERT INTO complaints (id, student_id, student_name, student_email, title, description, category, priority, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'Pending')
    """
    cursor.execute(query, (
        encrypted_comp['id'],
        encrypted_comp['student_id'],
        encrypted_comp['student_name'],
        encrypted_comp['student_email'],
        encrypted_comp['title'],
        encrypted_comp['description'],
        encrypted_comp['category'],
        encrypted_comp['priority']
    ))
    conn.commit()
    print("Complaint inserted successfully.")
    
    # 3. Query directly from DB to verify at rest encryption
    print("\n[Step 3] Querying DB directly to check ciphertext...")
    cursor.execute("SELECT student_name, student_email, title, description FROM complaints WHERE id = 'CMP-AES256'")
    db_raw = cursor.fetchone()
    
    print(f"Raw DB student_name: {db_raw['student_name']}")
    print(f"Raw DB student_email: {db_raw['student_email']}")
    print(f"Raw DB title: {db_raw['title']}")
    print(f"Raw DB description: {db_raw['description']}")
    
    # Ensure it's encrypted (should not be human readable)
    assert db_raw['title'] != test_comp['title'], "Error: Title stored in plain text!"
    assert db_raw['description'] != test_comp['description'], "Error: Description stored in plain text!"
    assert "Security Test" not in str(db_raw['description']), "Error: Sensitive data leaked in plain text!"
    print("Encryption-at-rest test passed: Data in DB columns is encrypted ciphertext!")
    
    # 4. Decrypt and check matching original
    print("\n[Step 4] Decrypting retrieved dictionary...")
    decrypted_comp = decrypt_complaint_dict(db_raw)
    print(f"Decrypted title: {decrypted_comp['title']}")
    print(f"Decrypted description: {decrypted_comp['description']}")
    
    assert decrypted_comp['title'] == test_comp['title'], "Decrypted title mismatch!"
    assert decrypted_comp['description'] == test_comp['description'], "Decrypted description mismatch!"
    print("Decryption test passed: Retrieved data decodes back to original text successfully!")
    
    # Clean up test complaint
    cursor.execute("DELETE FROM complaints WHERE id = 'CMP-AES256'")
    conn.commit()
    print("\nCleaned up test data.")
    
    cursor.close()
    conn.close()
    print("\nAll integration verification tests passed successfully!")

if __name__ == '__main__':
    test_integration()
