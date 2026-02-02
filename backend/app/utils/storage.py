from functools import lru_cache
from typing import Optional
from urllib.parse import urlparse

import boto3
from botocore.client import Config

from config import SUPABASE_OBJECT_STORAGE

@lru_cache(maxsize=1)
def _get_s3_client():
    access_key = SUPABASE_OBJECT_STORAGE.get("access_key_id")
    secret_key = SUPABASE_OBJECT_STORAGE.get("secret_access_key")
    endpoint = SUPABASE_OBJECT_STORAGE.get("s3_endpoint")
    region = SUPABASE_OBJECT_STORAGE.get("s3_region", "ap-southeast-1")

    if not (access_key and secret_key and endpoint):
        return None

    return boto3.client(
        "s3",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        endpoint_url=endpoint,
        region_name=region,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def _normalize_key(key: str, bucket: str) -> str:
    if key.startswith(f"{bucket}/"):
        return key[len(bucket) + 1 :]
    return key


def _strip_endpoint(key: str, endpoint: str, bucket: str) -> Optional[str]:
    parsed = urlparse(key)
    if not parsed.scheme or not parsed.netloc:
        return None

    endpoint_parsed = urlparse(endpoint)
    if parsed.netloc != endpoint_parsed.netloc:
        return None

    path = parsed.path.lstrip("/")
    endpoint_path = endpoint_parsed.path.strip("/")
    if endpoint_path and path.startswith(endpoint_path + "/"):
        path = path[len(endpoint_path) + 1 :]

    if path.startswith(f"{bucket}/"):
        path = path[len(bucket) + 1 :]

    return path or None


def build_signed_url(
    key: Optional[str],
    bucket: str,
    expires_in: int = 3600,
) -> Optional[str]:
    if not key:
        return None

    endpoint = SUPABASE_OBJECT_STORAGE.get("s3_endpoint")
    if key.startswith("http://") or key.startswith("https://"):
        if endpoint:
            stripped = _strip_endpoint(key, endpoint, bucket)
            if stripped:
                key = stripped
            else:
                return key
        else:
            return key

    client = _get_s3_client()
    if client is None:
        return None

    object_key = _normalize_key(key, bucket)
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": object_key},
        ExpiresIn=expires_in,
    )
