
import os
import jwt

from datetime import datetime, timedelta, timezone
from pwdlib import PasswordHash
from dotenv import load_dotenv

from saved_jobs import get_connection

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(
    os.getenv("JWT_EXPIRE_MINUTES", "1440")
)

if not JWT_SECRET or len(JWT_SECRET) < 32:
    raise RuntimeError(
        "Set a strong JWT_SECRET of at least 32 characters in .env"
    )

password_hasher = PasswordHash.recommended()


def initialize_auth_database():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)


def create_user(name, email, password):
    name = name.strip()
    email = email.strip().lower()

    if not name:
        raise ValueError("Name is required.")

    if len(password) < 8:
        raise ValueError("Password must contain at least 8 characters.")

    password_hash = password_hasher.hash(password)
    created_at = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        cursor = connection.execute("""
            INSERT INTO users (name, email, password_hash, created_at)
            VALUES (?, ?, ?, ?)
        """, (name, email, password_hash, created_at))

        user_id = cursor.lastrowid

    return get_user_by_id(user_id)


def get_user_by_email(email):
    with get_connection() as connection:
        row = connection.execute(
            "SELECT * FROM users WHERE email = ?",
            (email.strip().lower(),)
        ).fetchone()

    return dict(row) if row else None


def get_user_by_id(user_id):
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, name, email, created_at
            FROM users WHERE id = ?
            """,
            (user_id,)
        ).fetchone()

    return dict(row) if row else None


def verify_password(password, password_hash):
    return password_hasher.verify(password, password_hash)


def create_access_token(user_id):
    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES)
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM
    )


def decode_access_token(token):
    payload = jwt.decode(
        token,
        JWT_SECRET,
        algorithms=[JWT_ALGORITHM]
    )

    user_id = payload.get("sub")

    if not user_id:
        raise ValueError("Invalid authentication token.")

    return int(user_id)


initialize_auth_database()
