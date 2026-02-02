import os
from functools import lru_cache
from typing import Optional

import boto3
from botocore.client import Config


@lru_cache(maxsize=1)
def _get_s3_client():
    access_key = os.getenv("SUPABASE_ACCESS_KEY_ID")
    secret_key = os.getenv("SUPABASE_SECRET_ACCESS_KEY")
    endpoint = os.getenv("SUPABASE_S3_ENDPOINT")
    region = os.getenv("SUPABASE_S3_REGION", "ap-southeast-1")

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


def build_signed_url(key: Optional[str], expires_in: int = 3600) -> Optional[str]:
    if not key:
        return None
    if key.startswith("http://") or key.startswith("https://"):
        return key

    bucket = os.getenv("SUPABASE_S3_BUCKET", "treatment")
    client = _get_s3_client()
    if client is None:
        return None

    object_key = _normalize_key(key, bucket)
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": object_key},
        ExpiresIn=expires_in,
    )
