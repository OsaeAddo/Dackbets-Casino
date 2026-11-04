"""Signature verification for inbound webhooks."""

import hashlib
import hmac

# Tatum signs the raw body with HMAC-SHA512 and sends `x-payload-hash`.
# The generic `X-Webhook-Signature` header accepts `sha256=<hex>` or bare hex.
TATUM_SIGNATURE_HEADER = "x-payload-hash"
GENERIC_SIGNATURE_HEADER = "x-webhook-signature"


def _extract_signature(headers) -> tuple[str, str] | None:
    payload_hash = headers.get(TATUM_SIGNATURE_HEADER)
    if payload_hash:
        return "sha512", payload_hash.strip()

    signature = headers.get(GENERIC_SIGNATURE_HEADER)
    if signature:
        signature = signature.strip()
        if signature.lower().startswith("sha256="):
            signature = signature[7:]
        return "sha256", signature

    return None


def verify_webhook_signature(raw_body: bytes, headers, secret: str) -> bool:
    """Return True only when the body matches a supported signature header."""
    candidate = _extract_signature(headers)
    if candidate is None:
        return False

    algorithm, provided = candidate
    if not provided:
        return False

    digest = hmac.new(
        secret.encode("utf-8"),
        raw_body,
        getattr(hashlib, algorithm),
    ).hexdigest()
    return hmac.compare_digest(digest, provided.lower())
