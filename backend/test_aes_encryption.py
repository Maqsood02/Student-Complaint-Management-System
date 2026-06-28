import os
import sys

# Ensure backend directory is in the import path
sys.path.append(os.path.dirname(__file__))

from app import cipher_helper, decrypt_complaint_dict, encrypt_complaint_dict

def test_aes_encryption():
    print("=== RUNNING AES-256 SANITY TESTS ===")
    
    # Test 1: Simple string encryption/decryption
    test_str = "Hello World! This is a sensitive student complaint description."
    encrypted = cipher_helper.encrypt(test_str)
    decrypted = cipher_helper.decrypt(encrypted)
    
    print(f"Original: {test_str}")
    print(f"Encrypted (Base64): {encrypted}")
    print(f"Decrypted: {decrypted}")
    
    assert decrypted == test_str, "Error: Decrypted text does not match original!"
    print("Test 1 Passed: Encryption and Decryption match perfectly!")
    
    # Test 2: Fallback decryption for legacy plain text
    legacy_plain = "Legacy unencrypted complaint text stored in DB"
    decrypted_legacy = cipher_helper.decrypt(legacy_plain)
    print(f"\nLegacy Plaintext: {legacy_plain}")
    print(f"Decrypted Output (should be identical): {decrypted_legacy}")
    
    assert decrypted_legacy == legacy_plain, "Error: Legacy decryption fallback failed!"
    print("Test 2 Passed: Legacy plain-text fallback works perfectly!")
    
    # Test 3: Dictionary encryption and decryption
    test_complaint = {
        "id": "CMP-XYZ123",
        "student_name": "John Doe",
        "student_email": "john.doe@scms.edu",
        "title": "Unfair Grading Issue",
        "description": "Grading criteria was changed without notification.",
        "category": "Academic",
        "priority": "High",
        "status": "Pending",
        "attached_file": "proof.png",
        "admin_reply": "We will review it.",
        "worker_notes": "None yet",
        "worker_evidence": None
    }
    
    encrypted_comp = encrypt_complaint_dict(test_complaint)
    print("\nEncrypted Dictionary:")
    for k, v in encrypted_comp.items():
        if k in ('student_name', 'student_email', 'title', 'description', 'attached_file', 'admin_reply', 'worker_notes'):
            print(f"  {k}: {v[:30]}...")
            
    decrypted_comp = decrypt_complaint_dict(encrypted_comp)
    print("\nDecrypted Dictionary:")
    for k, v in decrypted_comp.items():
        if k in ('student_name', 'student_email', 'title', 'description', 'attached_file', 'admin_reply', 'worker_notes'):
            print(f"  {k}: {v}")
            
    for field in ('student_name', 'student_email', 'title', 'description', 'attached_file', 'admin_reply', 'worker_notes'):
        assert decrypted_comp[field] == test_complaint[field], f"Field {field} mismatch!"
        
    print("Test 3 Passed: Dictionary encryption and decryption work perfectly!")
    print("\nAll AES-256 Encryption tests passed successfully!")

if __name__ == '__main__':
    try:
        test_aes_encryption()
    except Exception as e:
        print(f"Test Execution Failed: {e}")
        sys.exit(1)
