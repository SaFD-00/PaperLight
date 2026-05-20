"""Object store for original PDFs — S3/MinIO/R2 or in-process local backend.

PRD §7.3: 원본 PDF는 presigned URL(TTL 10분)로만 클라이언트에 전달. 직접 키/URL 노출 금지.
env `S3_ENDPOINT_URL` 가 있으면 S3 호환(MinIO/R2), 없으면 in-process Local 백엔드
(dev/test 오프라인 — presigned = HMAC 서명된 가드 라우트 URL).
"""

from __future__ import annotations

import contextlib
import hashlib
import hmac
import os
import time
from typing import Protocol
from urllib.parse import urlencode

PDF_KEY_TEMPLATE = "papers/{paper_id}/original.pdf"
DEFAULT_TTL_SECONDS = 10 * 60


def pdf_key(paper_id: str) -> str:
    return PDF_KEY_TEMPLATE.format(paper_id=paper_id)


def _token_secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if secret and secret != "change-me-in-production":
        return secret
    if os.environ.get("APP_ENV", "development") == "development":
        return "dev-secret-do-not-use-in-production"
    raise RuntimeError("JWT_SECRET must be set in non-development environments")


def _public_base_url() -> str:
    return os.environ.get("PAPERLIGHT_PUBLIC_URL", "http://localhost:8000").rstrip("/")


def sign_pdf_token(paper_id: str, expires_at: int) -> str:
    msg = f"{paper_id}:{expires_at}".encode()
    return hmac.new(_token_secret().encode(), msg, hashlib.sha256).hexdigest()


def verify_pdf_token(paper_id: str, expires_at: int, signature: str) -> bool:
    if expires_at < int(time.time()):
        return False
    return hmac.compare_digest(sign_pdf_token(paper_id, expires_at), signature)


class ObjectStore(Protocol):
    def put_pdf(self, key: str, data: bytes) -> None: ...
    def get_pdf(self, key: str) -> bytes: ...
    def presigned_get(self, key: str, ttl: int = DEFAULT_TTL_SECONDS) -> str: ...


class LocalObjectStore:
    """In-process store for dev/test without docker. Presigned = HMAC 가드 라우트 URL."""

    def __init__(self) -> None:
        self._blobs: dict[str, bytes] = {}

    def put_pdf(self, key: str, data: bytes) -> None:
        self._blobs[key] = data

    def get_pdf(self, key: str) -> bytes:
        try:
            return self._blobs[key]
        except KeyError as err:
            raise FileNotFoundError(key) from err

    def presigned_get(self, key: str, ttl: int = DEFAULT_TTL_SECONDS) -> str:
        paper_id = key.split("/")[1]
        exp = int(time.time()) + ttl
        qs = urlencode({"exp": exp, "sig": sign_pdf_token(paper_id, exp)})
        return f"{_public_base_url()}/api/papers/{paper_id}/pdf?{qs}"


class S3ObjectStore:
    def __init__(self) -> None:
        import boto3

        self._bucket = os.environ.get("S3_BUCKET", "paperlight-pdf")
        self._client = boto3.client(
            "s3",
            endpoint_url=os.environ.get("S3_ENDPOINT"),
            aws_access_key_id=os.environ.get("S3_ACCESS_KEY"),
            aws_secret_access_key=os.environ.get("S3_SECRET_KEY"),
            region_name=os.environ.get("S3_REGION", "auto"),
        )
        with contextlib.suppress(Exception):
            if self._bucket not in {b["Name"] for b in self._client.list_buckets()["Buckets"]}:
                self._client.create_bucket(Bucket=self._bucket)

    def put_pdf(self, key: str, data: bytes) -> None:
        self._client.put_object(
            Bucket=self._bucket, Key=key, Body=data, ContentType="application/pdf"
        )

    def get_pdf(self, key: str) -> bytes:
        return self._client.get_object(Bucket=self._bucket, Key=key)["Body"].read()

    def presigned_get(self, key: str, ttl: int = DEFAULT_TTL_SECONDS) -> str:
        return self._client.generate_presigned_url(
            "get_object", Params={"Bucket": self._bucket, "Key": key}, ExpiresIn=ttl
        )


_store: ObjectStore | None = None


def get_object_store() -> ObjectStore:
    global _store
    if _store is None:
        _store = S3ObjectStore() if os.environ.get("S3_ENDPOINT") else LocalObjectStore()
    return _store


def reset_object_store() -> None:
    """Test-only: drop the singleton so the next call rebuilds from env."""
    global _store
    _store = None
