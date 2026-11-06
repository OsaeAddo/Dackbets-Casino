"""Chain-valid demo addresses: generation, checksums and withdrawal validation."""

import re
from types import SimpleNamespace

import pytest
from app.models import casino_models
from app.wallets.addresses import (
    base58_decode,
    base58_encode,
    generate_address,
    keccak256,
    normalize_address,
)
from app.wallets.service import WalletService, wallet_service

EVM_ADDRESS = re.compile(r"0x[0-9a-fA-F]{40}")


class FakeTable:
    """Minimal stand-in for a Supabase table query."""

    def __init__(self, rows):
        self.rows = rows
        self.payload = None

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def insert(self, payload):
        self.payload = payload
        return self

    def execute(self):
        if self.payload is not None:
            return SimpleNamespace(data=[{**self.payload, "id": "wallet-1"}])
        return SimpleNamespace(data=self.rows)


def test_keccak256_matches_known_vectors():
    assert (
        keccak256(b"").hex()
        == "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
    )
    assert (
        keccak256(b"abc").hex()
        == "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45"
    )


def test_base58_round_trips_leading_zero_bytes():
    data = b"\x00\x00hello"

    assert base58_decode(base58_encode(data)) == data


@pytest.mark.parametrize("currency", ["BTC", "ETH", "USDT", "USDC", "SOL", "BNB"])
def test_generated_addresses_are_valid_for_their_chain(currency):
    address = generate_address(currency)

    assert normalize_address(currency, address) == address


def test_btc_addresses_are_base58check_p2pkh():
    address = generate_address("BTC")

    assert address.startswith("1")
    assert 26 <= len(address) <= 35


def test_evm_addresses_are_eip55_checksummed():
    address = generate_address("ETH")

    assert EVM_ADDRESS.fullmatch(address)
    # Lowercase input has no checksum; normalization restores EIP-55 casing.
    assert normalize_address("ETH", address.lower()) == address


def test_sol_addresses_decode_to_32_bytes():
    address = generate_address("SOL")

    assert len(base58_decode(address)) == 32


def test_unknown_currency_is_rejected():
    with pytest.raises(ValueError, match="Unsupported currency"):
        generate_address("DOGE")

    with pytest.raises(ValueError, match="Unsupported currency"):
        normalize_address("DOGE", "whatever")


def test_evm_mixed_case_checksum_is_enforced():
    address = generate_address("ETH")
    body = address[2:]
    index = next(i for i, char in enumerate(body) if char.isalpha())
    tampered = body[:index] + body[index].swapcase() + body[index + 1 :]

    with pytest.raises(ValueError, match="checksum"):
        normalize_address("ETH", f"0x{tampered}")


def test_btc_checksum_typo_is_rejected():
    address = generate_address("BTC")
    replacement = "2" if address[-1] != "2" else "3"

    with pytest.raises(ValueError, match="checksum"):
        normalize_address("BTC", address[:-1] + replacement)


def test_sol_wrong_length_is_rejected():
    with pytest.raises(ValueError, match="32 bytes"):
        normalize_address("SOL", base58_encode(b"\x01" * 31))


def test_evm_non_hex_is_rejected():
    with pytest.raises(ValueError, match="40 hex"):
        normalize_address("ETH", "0xnot-an-address")


@pytest.mark.asyncio
async def test_get_or_create_wallet_stores_a_chain_valid_address(monkeypatch):
    table = FakeTable(rows=[])
    fake_client = SimpleNamespace(table=lambda _name: table)
    monkeypatch.setattr(WalletService, "client", property(lambda _self: fake_client))

    wallet = await wallet_service.get_or_create_wallet("user-1", "BTC")

    assert normalize_address("BTC", wallet["address"]) == wallet["address"]
    assert table.payload["user_id"] == "user-1"
    assert table.payload["currency"] == "BTC"


@pytest.mark.asyncio
async def test_create_withdrawal_rejects_a_malformed_address(monkeypatch):
    async def unexpected(*_args, **_kwargs):
        raise AssertionError("validation must happen before any database call")

    monkeypatch.setattr(casino_models, "get_user_profile", unexpected)

    with pytest.raises(ValueError, match="40 hex"):
        await wallet_service.create_withdrawal("user-1", "ETH", 1.0, "0xnope")


@pytest.mark.asyncio
async def test_create_withdrawal_normalizes_the_destination(monkeypatch):
    captured = {}

    async def get_user_profile(_user_id):
        return {"balance": {"ETH": 5.0}}

    async def create_transaction(**kwargs):
        captured.update(kwargs)

    async def update_user_balance(*_args, **_kwargs):
        return None

    monkeypatch.setattr(casino_models, "get_user_profile", get_user_profile)
    monkeypatch.setattr(casino_models, "create_transaction", create_transaction)
    monkeypatch.setattr(casino_models, "update_user_balance", update_user_balance)

    lowercase = "0x" + "ab" * 20
    withdrawal = await wallet_service.create_withdrawal("user-1", "ETH", 1.0, lowercase)

    expected = normalize_address("ETH", lowercase)
    assert withdrawal["address"] == expected
    assert captured["metadata"]["to_address"] == expected
