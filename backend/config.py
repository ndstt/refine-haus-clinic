import os
from dotenv import load_dotenv

load_dotenv()

POSTGRES = {
    "database": os.getenv("DB_NAME"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "host": os.getenv("DB_HOST"),
    "port": os.getenv("DB_PORT"),
}

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

SUPABASE_OBJECT_STORAGE = {
    "access_key_id": os.getenv("SUPABASE_ACCESS_KEY_ID"),
    "secret_access_key": os.getenv("SUPABASE_SECRET_ACCESS_KEY"),
    "s3_endpoint": os.getenv("SUPABASE_S3_ENDPOINT"),
    "s3_region": os.getenv("SUPABASE_S3_REGION", "ap-southeast-1"),
}
