#main.py
import os
import jwt as pyjwt
import bcrypt
from datetime import datetime, UTC, timedelta
import pymongo
import base64
import secrets
from b2sdk.v2 import InMemoryAccountInfo, B2Api
from flask import Flask, request, jsonify
from flask_pymongo import PyMongo
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from functools import wraps
from dotenv import load_dotenv
import requests
from werkzeug.security import check_password_hash, generate_password_hash
from flask_cors import CORS
from pymongo import MongoClient
from urllib.parse import urlparse
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from flask import send_file, jsonify, send_from_directory
from io import BytesIO
import mimetypes
from bson import ObjectId
from cryptography.hazmat.primitives import padding
# Load environment variables
load_dotenv()
app = Flask(__name__)
CORS(app)

# MongoDB Connection
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/SecureCloudDB")
app.config["MONGO_URI"] = MONGO_URI

try:
    mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    db_name = urlparse(MONGO_URI).path.strip("/")

    if "?" in db_name:
        db_name = db_name.split("?")[0]

    if not db_name:
        raise ValueError("Database name is missing in MONGO_URI!")

    db = mongo_client[db_name]
    mongo_client.server_info()
    print("Successfully connected to MongoDB!")
except Exception as e:
    print(f"MongoDB connection error: {e}")
    print("Switching to Local MongoDB...")
    MONGO_URI = "mongodb://localhost:27017/SecureCloudDB"
    os.environ["MONGO_URI"] = MONGO_URI
    mongo_client = MongoClient(MONGO_URI)
    db = mongo_client["SecureCloudDB"]
    print("Connected to Local MongoDB!")

mongo = PyMongo(app)

# Backblaze B2 Configuration
B2_KEY_ID = os.getenv("B2_APPLICATION_KEY_ID")
B2_APP_KEY = os.getenv("B2_APPLICATION_KEY")
B2_BUCKET_NAME = os.getenv("BUCKET_NAME")
BUCKET_ID = os.getenv("MY_BUCKET_ID")

# Initialize B2 API
info = InMemoryAccountInfo()
b2_api = B2Api(info)
b2_api.authorize_account("production", B2_KEY_ID, B2_APP_KEY)
bucket = b2_api.get_bucket_by_name(B2_BUCKET_NAME)

users_collection = db["users"]
files_collection = db["files"]
keys_collection = db["encryptionkeys"]

# JWT Authentication
app.config["SECRET_KEY"] = os.getenv("JWT_SECRET")

def generate_jwt(user):
    payload = {
        "userId": str(user['_id']),
        "exp": datetime.now(UTC) + timedelta(hours=1)
    }
    return pyjwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def auth_required(func):
    @wraps(func)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization")
        if not token:
            return jsonify({"message": "Access denied. No token provided."}), 401
        token = token.replace("Bearer ", "").strip()  # Remove "Bearer" prefix
        
        try:
            decoded = pyjwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            request.user = decoded
        except ExpiredSignatureError:
            return jsonify({"message": "Token expired."}), 401
        except InvalidTokenError:
            return jsonify({"message": "Invalid token."}), 401
        return func(*args, **kwargs)
    return decorated

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    if users_collection.find_one({"email": email}):
        return jsonify({"message": "Email already exists"}), 400

    hashed_password = generate_password_hash(password)
    users_collection.insert_one({"email": email, "password": hashed_password})
    return jsonify({"message": "User registered successfully"}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    user = users_collection.find_one({"email": email})
    if user and check_password_hash(user["password"], password):
        token = generate_jwt(user)
        return jsonify({"message": "Login successful", "token": token}), 200
    return jsonify({"message": "Invalid credentials"}), 401

def encrypt_file(file_data, key):
    iv = os.urandom(16)  
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    padder = padding.PKCS7(128).padder()
    padded_data = padder.update(file_data) + padder.finalize()
    encrypted_data = encryptor.update(padded_data) + encryptor.finalize()
    return encrypted_data, iv

UPLOAD_FOLDER = "./uploads"
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
files_collection = db["files"]

@app.route("/api/upload", methods=["POST"])
@auth_required
def upload_file():
    if "file" not in request.files:
        return jsonify({"message": "No file uploaded"}), 400

    file = request.files['file']
    filename = file.filename  
    user_id = request.user['userId']
    key_str = request.form.get("encryption_key")  

    if not key_str or len(key_str) != 32:
        return jsonify({"message": "Invalid encryption key! Must be 32 characters."}), 400

    key = key_str.encode()
    file_data = file.read()
    encrypted_data, iv = encrypt_file(file_data, key)
    stored_file_name = f"uploads/{secrets.token_hex(8)}_{filename}"
    file_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    with open(file_path, "wb") as f:
        f.write(file_data)
    
    try:
        bucket.upload_bytes(encrypted_data, stored_file_name)

        files_collection.insert_one({
            "filename": filename,
            "storedFileName": stored_file_name, 
            "fileSize": len(encrypted_data),
            "contentType": file.content_type,
            "uploadedBy": user_id,
            "uploadedDate": datetime.utcnow()
            
        })
        keys_collection.insert_one({
            "userId": user_id,
            "field": "filename",
            "encryptedKey": key_str,
            "iv": base64.b64encode(iv).decode()
            
        })

        return jsonify({"message": "File uploaded successfully!"}), 201
    except Exception as e:
        return jsonify({"message": f"File upload failed: {str(e)}"}), 500

def decrypt_file(encrypted_data, key, iv):
    try:
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
        decryptor = cipher.decryptor()
        decrypted_padded_data = decryptor.update(encrypted_data) + decryptor.finalize()

        unpadder = padding.PKCS7(128).unpadder()
        decrypted_data = unpadder.update(decrypted_padded_data) + unpadder.finalize()

        print(f"First 20 bytes of decrypted file: {decrypted_data[:20].hex()}")  # Debugging

        return decrypted_data
    except Exception as e:
        print("Decryption error:", str(e))
        return None


@app.route("/api/files", methods=["GET"])
@auth_required
def list_files():
    files = list(files_collection.find({}, {"filename": 1, "fileSize": 1, "uploadedBy": 1, "uploadedDate": 1}))
    
    for file in files:
        file["_id"] = str(file["_id"])  
        file["uploadedDate"] = file["uploadedDate"].isoformat()
    print("Files being sent to frontend:", files)  
    return jsonify(files)

def get_b2_auth():
    auth_res = requests.get(
        "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
        auth=(B2_KEY_ID, B2_APP_KEY)
    ).json()
    
    return {
        "api_url": auth_res["apiUrl"],
        "download_url": auth_res["downloadUrl"],
        "auth_token": auth_res["authorizationToken"]
    }

def generate_presigned_url(filename):
    try:
        auth_res = get_b2_auth()  # Fetch Backblaze B2 authorization info
        if not auth_res:
            raise Exception("Failed to authenticate with B2")

        # Generate download URL
        download_url = f"{auth_res['download_url']}/file/{B2_BUCKET_NAME}/{filename}"
        return download_url

    except Exception as e:
        print("Presigned URL Generation Error:", str(e))
        return None

@app.route("/api/download/<file_id>", methods=["GET"])
@auth_required
def get_download_url(file_id):
    try:
        file_data = db.files.find_one({'_id': ObjectId(file_id)})
        if not file_data:
            return jsonify({'error': 'File not found'}), 404

        filename = file_data.get('filename')  # Use 'filename' instead of 'storedFileName'
        if not filename:
            return jsonify({'error': 'Filename not found in database'}), 400

        # Assuming files are stored in a specific directory
        file_path = os.path.join(UPLOAD_FOLDER, filename)

        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found on server'}), 404

        mimetype, _ = mimetypes.guess_type(file_path)
        mimetype = mimetype or "application/octet-stream"

        print(f"Serving file: {filename} with MIME type: {mimetype}") 
        return send_file(file_path, as_attachment=True, mimetype=mimetype)

    except Exception as e:
        print(f"Error in Download Endpoint: {e}")
        return jsonify({'error': 'Failed to generate download link'}), 500

@app.route("/api/download/<file_id>", methods=["POST"])
@auth_required
def download_file(file_id):
    file_metadata = files_collection.find_one({"_id": ObjectId(file_id)})
    if not file_metadata:
        return jsonify({"message": "File not found"}), 404
    filename = file_metadata["filename"]
    encryption_key_entry = keys_collection.find_one({"userId": request.user['userId'], "field": filename})

    if not encryption_key_entry:
        return jsonify({"message": "Unauthorized to decrypt this file"}), 403
    
    stored_key = encryption_key_entry["encryptionKey"].encode()
    file_iv = base64.b64decode(encryption_key_entry["iv"])
    user_provided_key = request.form.get("encryption_key").encode()
    
    if stored_key != user_provided_key:
        return jsonify({"message": "Incorrect decryption key!"}), 403
    
    stored_filename = file_metadata.get("storedFileName", None)
    downloaded_file = bucket.download_file_by_name(stored_filename)
    encrypted_data = downloaded_file.download_as_bytes()
    decrypted_data = decrypt_file(encrypted_data, stored_key, file_iv)
    if decrypted_data is None:
            return jsonify({"message": "Decryption failed"}), 500

    return send_file(BytesIO(decrypted_data), mimetype=file_metadata["contentType"], as_attachment=True, download_name=file_metadata["filename"])
    

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
