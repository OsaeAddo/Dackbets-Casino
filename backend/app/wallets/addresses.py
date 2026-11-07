"""Chain-valid address generation and validation for the demo wallet.

The casino is play-money only, so these addresses are **not** derived from a
custody key and nobody can spend funds sent to them. They are, however,
syntactically valid for their chain:

- BTC: base58check P2PKH (version byte ``0x00``, 20-byte hash160)
- ETH / USDT / USDC / BNB: 20-byte EVM account with an EIP-55 checksum
- SOL: base58-encoded 32-byte public key

Before accepting real deposits, replace this module with a custody provider
(e.g. Tatum or an HD wallet) that can derive addresses from a key you control.

Everything here is stdlib-only: base58 and Keccak-256 are implemented locally so
the backend does not gain a dependency just to format addresses.
"""

import hashlib
import re
import secrets

_BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
_BASE58_INDEX = {char: index for index, char in enumerate(_BASE58_ALPHABET)}

_EVM_CURRENCIES = frozenset({"ETH", "USDT", "USDC", "BNB"})
_EVM_ADDRESS = re.compile(r"0x[0-9a-fA-F]{40}")

# Keccak-f[1600] rotation offsets, indexed as _ROTATIONS[x][y].
_ROTATIONS = (
    (0, 36, 3, 41, 18),
    (1, 44, 10, 45, 2),
    (62, 6, 43, 15, 61),
    (28, 55, 25, 21, 56),
    (27, 20, 39, 8, 14),
)

# Round constants for Keccak-f[1600].
_ROUND_CONSTANTS = (
    0x0000000000000001,
    0x0000000000008082,
    0x800000000000808A,
    0x8000000080008000,
    0x000000000000808B,
    0x0000000080000001,
    0x8000000080008081,
    0x8000000000008009,
    0x000000000000008A,
    0x0000000000000088,
    0x0000000080008009,
    0x000000008000000A,
    0x000000008000808B,
    0x800000000000008B,
    0x8000000000008089,
    0x8000000000008003,
    0x8000000000008002,
    0x8000000000000080,
    0x000000000000800A,
    0x800000008000000A,
    0x8000000080008081,
    0x8000000000008080,
    0x0000000080000001,
    0x8000000080008008,
)

_MASK_64 = (1 << 64) - 1
_KECCAK_RATE = 136  # 1088 bits for Keccak-256


def _rol(value: int, shift: int) -> int:
    shift %= 64
    return ((value << shift) | (value >> (64 - shift))) & _MASK_64


def _keccak_f1600(state: list[int]) -> None:
    for round_constant in _ROUND_CONSTANTS:
        # Theta
        columns = [
            state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20]
            for x in range(5)
        ]
        deltas = [
            columns[(x - 1) % 5] ^ _rol(columns[(x + 1) % 5], 1) for x in range(5)
        ]
        for x in range(5):
            for y in range(5):
                state[x + 5 * y] ^= deltas[x]

        # Rho and pi
        lanes = [0] * 25
        for x in range(5):
            for y in range(5):
                lanes[y + 5 * ((2 * x + 3 * y) % 5)] = _rol(
                    state[x + 5 * y], _ROTATIONS[x][y]
                )

        # Chi
        for x in range(5):
            for y in range(5):
                state[x + 5 * y] = lanes[x + 5 * y] ^ (
                    (~lanes[(x + 1) % 5 + 5 * y]) & lanes[(x + 2) % 5 + 5 * y]
                )

        # Iota
        state[0] ^= round_constant


def keccak256(data: bytes) -> bytes:
    """Return the original Keccak-256 digest (not NIST SHA3-256)."""
    message = bytearray(data)
    message.append(0x01)
    while len(message) % _KECCAK_RATE:
        message.append(0x00)
    message[-1] |= 0x80

    state = [0] * 25
    for offset in range(0, len(message), _KECCAK_RATE):
        block = message[offset : offset + _KECCAK_RATE]
        for lane in range(_KECCAK_RATE // 8):
            state[lane] ^= int.from_bytes(block[lane * 8 : (lane + 1) * 8], "little")
        _keccak_f1600(state)

    digest = b"".join(lane.to_bytes(8, "little") for lane in state)
    return digest[:32]


def _sha256d(data: bytes) -> bytes:
    return hashlib.sha256(hashlib.sha256(data).digest()).digest()


def base58_encode(data: bytes) -> str:
    number = int.from_bytes(data, "big")
    encoded = ""
    while number:
        number, remainder = divmod(number, 58)
        encoded = _BASE58_ALPHABET[remainder] + encoded
    leading_zeros = len(data) - len(data.lstrip(b"\x00"))
    return "1" * leading_zeros + encoded


def base58_decode(value: str) -> bytes:
    number = 0
    for char in value:
        try:
            number = number * 58 + _BASE58_INDEX[char]
        except KeyError:
            raise ValueError(f"Invalid base58 character: {char!r}") from None
    decoded = number.to_bytes((number.bit_length() + 7) // 8, "big")
    leading_ones = len(value) - len(value.lstrip("1"))
    return b"\x00" * leading_ones + decoded


def _base58check_encode(payload: bytes) -> str:
    return base58_encode(payload + _sha256d(payload)[:4])


def _base58check_decode(value: str) -> bytes:
    raw = base58_decode(value)
    if len(raw) < 5:
        raise ValueError("Address is too short")
    payload, checksum = raw[:-4], raw[-4:]
    if _sha256d(payload)[:4] != checksum:
        raise ValueError("Invalid base58check checksum")
    return payload


def _evm_checksum(address_bytes: bytes) -> str:
    body = address_bytes.hex()
    digest = keccak256(body.encode("ascii")).hex()
    checksummed = "".join(
        char.upper() if int(digest[index], 16) >= 8 else char
        for index, char in enumerate(body)
    )
    return f"0x{checksummed}"


def generate_address(currency: str) -> str:
    """Return a new chain-valid address for ``currency``."""
    code = currency.upper()
    if code == "BTC":
        return _base58check_encode(b"\x00" + secrets.token_bytes(20))
    if code in _EVM_CURRENCIES:
        return _evm_checksum(secrets.token_bytes(20))
    if code == "SOL":
        return base58_encode(secrets.token_bytes(32))
    raise ValueError(f"Unsupported currency for address generation: {currency}")


def normalize_address(currency: str, address: str) -> str:
    """Validate ``address`` and return its canonical form.

    Raises ``ValueError`` when the address is malformed for the chain, which
    lets the API reject a withdrawal instead of queueing it to nowhere.
    """
    code = currency.upper()
    candidate = address.strip()

    if code == "BTC":
        payload = _base58check_decode(candidate)
        # 0x00 = P2PKH, 0x05 = P2SH; both are mainnet.
        if len(payload) != 21 or payload[0] not in (0x00, 0x05):
            raise ValueError("Not a mainnet Bitcoin address")
        return candidate

    if code in _EVM_CURRENCIES:
        if not _EVM_ADDRESS.fullmatch(candidate):
            raise ValueError("EVM addresses are 0x followed by 40 hex characters")
        body = candidate[2:]
        checksummed = _evm_checksum(bytes.fromhex(body))
        # All-lowercase and all-uppercase inputs carry no checksum; mixed case
        # must match EIP-55 so a typo cannot silently become a valid address.
        if body != body.lower() and body != body.upper() and candidate != checksummed:
            raise ValueError("Invalid EVM address checksum")
        return checksummed

    if code == "SOL":
        if len(base58_decode(candidate)) != 32:
            raise ValueError("Solana addresses decode to 32 bytes")
        return candidate

    raise ValueError(f"Unsupported currency for address validation: {currency}")
