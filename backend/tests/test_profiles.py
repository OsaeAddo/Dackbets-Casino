from types import SimpleNamespace

import pytest

from app.models import casino_models


class _EmptyProfileQuery:
    def select(self, *args, **kwargs):
        return self

    def eq(self, *args, **kwargs):
        return self

    def execute(self):
        return SimpleNamespace(data=[])


class _EmptyProfileClient:
    def table(self, name):
        assert name == "casino_profiles"
        return _EmptyProfileQuery()


@pytest.mark.asyncio
async def test_get_user_profile_returns_none_when_missing(monkeypatch):
    """A missing profile must return None, not raise TypeError."""
    monkeypatch.setattr(casino_models, "admin_client", _EmptyProfileClient())

    profile = await casino_models.get_user_profile("missing-user-id")

    assert profile is None
