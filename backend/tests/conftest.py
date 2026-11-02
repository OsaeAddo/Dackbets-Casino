import os

# Settings requires these values at import time. Use placeholders so unit tests
# never depend on a real Supabase project or network access.
os.environ.setdefault("SUPABASE_URL", "https://placeholder.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "placeholder-anon-key")
os.environ.setdefault("SUPABASE_SECRET_KEY", "placeholder-service-role-key")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key")
