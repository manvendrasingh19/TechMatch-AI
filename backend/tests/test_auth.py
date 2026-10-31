
import os
import sqlite3
from datetime import datetime, timedelta, timezone

import jwt
import pytest


# Use a test-only JWT secret. This does not modify the .env file.
os.environ["JWT_SECRET"] = "pytest-only-secret-for-authentication-tests-123456"
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["JWT_EXPIRE_MINUTES"] = "1440"


# Redirect database initialization during auth.py import to memory.
_original_connect = sqlite3.connect


def isolated_import_connection(database, *args, **kwargs):
    return _original_connect(":memory:", *args, **kwargs)


sqlite3.connect = isolated_import_connection

try:
    import auth
finally:
    sqlite3.connect = _original_connect


# Give every test its own temporary SQLite database.
@pytest.fixture
def isolated_auth_db(tmp_path, monkeypatch):
    database_path = tmp_path / "auth_test.db"

    def get_test_connection():
        connection = sqlite3.connect(database_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    monkeypatch.setattr(auth, "get_connection", get_test_connection)

    auth.initialize_auth_database()

    return database_path


# -------------------------------------------------
# User registration tests
# -------------------------------------------------

def test_create_user_success(isolated_auth_db):
    user = auth.create_user(
        "Manvendra Singh",
        "manvendra@example.com",
        "StrongPassword123"
    )

    assert user["name"] == "Manvendra Singh"
    assert user["email"] == "manvendra@example.com"
    assert "id" in user
    assert "password_hash" not in user


def test_create_user_normalizes_name_and_email(isolated_auth_db):
    user = auth.create_user(
        "  Manvendra Singh  ",
        "  MANVENDRA@EXAMPLE.COM  ",
        "StrongPassword123"
    )

    assert user["name"] == "Manvendra Singh"
    assert user["email"] == "manvendra@example.com"


def test_create_user_rejects_empty_name(isolated_auth_db):
    with pytest.raises(ValueError, match="Name is required"):
        auth.create_user(
            "   ",
            "test@example.com",
            "StrongPassword123"
        )


def test_create_user_rejects_short_password(isolated_auth_db):
    with pytest.raises(ValueError, match="at least 8 characters"):
        auth.create_user(
            "Test User",
            "test@example.com",
            "short"
        )


def test_create_user_rejects_duplicate_email(isolated_auth_db):
    auth.create_user(
        "First User",
        "test@example.com",
        "StrongPassword123"
    )

    with pytest.raises(sqlite3.IntegrityError):
        auth.create_user(
            "Second User",
            "TEST@example.com",
            "StrongPassword456"
        )


# -------------------------------------------------
# User retrieval tests
# -------------------------------------------------

def test_get_user_by_email(isolated_auth_db):
    created_user = auth.create_user(
        "Test User",
        "test@example.com",
        "StrongPassword123"
    )

    retrieved_user = auth.get_user_by_email("TEST@EXAMPLE.COM")

    assert retrieved_user["id"] == created_user["id"]
    assert retrieved_user["email"] == "test@example.com"


def test_get_user_by_id(isolated_auth_db):
    created_user = auth.create_user(
        "Test User",
        "test@example.com",
        "StrongPassword123"
    )

    retrieved_user = auth.get_user_by_id(created_user["id"])

    assert retrieved_user["name"] == "Test User"


def test_get_nonexistent_user(isolated_auth_db):
    assert auth.get_user_by_email("unknown@example.com") is None
    assert auth.get_user_by_id(99999) is None


# -------------------------------------------------
# Password security tests
# -------------------------------------------------

def test_password_is_stored_as_hash(isolated_auth_db):
    auth.create_user(
        "Test User",
        "test@example.com",
        "StrongPassword123"
    )

    user = auth.get_user_by_email("test@example.com")

    assert user["password_hash"] != "StrongPassword123"


def test_verify_correct_password(isolated_auth_db):
    auth.create_user(
        "Test User",
        "test@example.com",
        "StrongPassword123"
    )

    user = auth.get_user_by_email("test@example.com")

    assert auth.verify_password(
        "StrongPassword123",
        user["password_hash"]
    ) is True


def test_verify_incorrect_password(isolated_auth_db):
    auth.create_user(
        "Test User",
        "test@example.com",
        "StrongPassword123"
    )

    user = auth.get_user_by_email("test@example.com")

    assert auth.verify_password(
        "WrongPassword123",
        user["password_hash"]
    ) is False


# -------------------------------------------------
# JWT authentication tests
# -------------------------------------------------

def test_create_and_decode_access_token():
    token = auth.create_access_token(123)

    user_id = auth.decode_access_token(token)

    assert user_id == 123


def test_decode_invalid_token():
    with pytest.raises(jwt.InvalidTokenError):
        auth.decode_access_token("invalid.token.value")


def test_decode_expired_token():
    expired_payload = {
        "sub": "123",
        "iat": datetime.now(timezone.utc) - timedelta(hours=2),
        "exp": datetime.now(timezone.utc) - timedelta(hours=1)
    }

    expired_token = jwt.encode(
        expired_payload,
        auth.JWT_SECRET,
        algorithm=auth.JWT_ALGORITHM
    )

    with pytest.raises(jwt.ExpiredSignatureError):
        auth.decode_access_token(expired_token)


def test_decode_token_without_user_id():
    payload = {
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=1)
    }

    token = jwt.encode(
        payload,
        auth.JWT_SECRET,
        algorithm=auth.JWT_ALGORITHM
    )

    with pytest.raises(ValueError, match="Invalid authentication token"):
        auth.decode_access_token(token)

def test_auth_rejects_missing_jwt_secret():
    import runpy

    from pathlib import Path

    auth_file = Path(__file__).resolve().parents[1] / "auth.py"

    with pytest.MonkeyPatch.context() as monkeypatch:
        monkeypatch.setenv("JWT_SECRET", "too-short")

        with pytest.raises(
            RuntimeError,
            match="JWT_SECRET of at least 32 characters"
        ):
            runpy.run_path(str(auth_file))
