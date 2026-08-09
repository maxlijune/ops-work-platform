from cryptography.fernet import Fernet
import os
import base64

# Generate or load encryption key
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KEY_FILE = os.path.join(BASE_DIR, "data", ".encryption_key")

def _load_or_create_key():
    """Load existing key or create a new one"""
    if os.path.exists(KEY_FILE):
        with open(KEY_FILE, "rb") as f:
            return f.read()
    else:
        key = Fernet.generate_key()
        os.makedirs(os.path.dirname(KEY_FILE), exist_ok=True)
        with open(KEY_FILE, "wb") as f:
            f.write(key)
        return key

KEY = _load_or_create_key()
FERNET = Fernet(KEY)

def encrypt(plaintext: str) -> str:
    """Encrypt plaintext and return base64 encoded string"""
    if not plaintext:
        return ""
    return FERNET.encrypt(plaintext.encode('utf-8')).decode('utf-8')

def decrypt(ciphertext: str) -> str:
    """Decrypt base64 encoded string and return plaintext"""
    if not ciphertext:
        return ""
    try:
        return FERNET.decrypt(ciphertext.encode('utf-8')).decode('utf-8')
    except Exception:
        return ""
