import os

import pytest

# Settings requires these values at import time. Use placeholders so unit tests
# never depend on a real Supabase project or network access.
os.environ.setdefault("SUPABASE_URL", "https://placeholder.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "placeholder-anon-key")
os.environ.setdefault("SUPABASE_SECRET_KEY", "placeholder-service-role-key")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key")


@pytest.fixture(autouse=True)
def insecure_test_cookies():
    """The ASGI test client talks plain HTTP, so Secure cookies would not stick."""
    from app.config import settings

    original = settings.cookie_secure
    settings.cookie_secure = False
    yield
    settings.cookie_secure = original
