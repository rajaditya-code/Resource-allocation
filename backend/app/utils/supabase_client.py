"""
Supabase storage client — handles file uploads and deletions.

All image/file storage goes through Supabase Storage. This module
provides a clean interface so route handlers don't need to know
the upload mechanics.
"""

import uuid
from typing import Optional

from supabase import create_client, Client

from app.config import settings


def _get_client() -> Client:
    """Create a Supabase client using the service role key (full access)."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def upload_file(
    file_bytes: bytes,
    filename: str,
    folder: str = "assets",
    content_type: str = "image/png",
    bucket: Optional[str] = None,
) -> str:
    """
    Upload a file to Supabase Storage and return its public URL.

    Args:
        file_bytes: Raw file content
        filename: Original filename (we prepend a UUID to avoid collisions)
        folder: Subfolder inside the bucket (e.g., 'assets', 'qr-codes', 'returns')
        content_type: MIME type of the file
        bucket: Storage bucket name (defaults to settings)

    Returns:
        Public URL of the uploaded file
    """
    client = _get_client()
    bucket_name = bucket or settings.SUPABASE_STORAGE_BUCKET

    # Generate a unique path to prevent filename collisions
    unique_name = f"{uuid.uuid4().hex}_{filename}"
    file_path = f"{folder}/{unique_name}"

    # Upload the file
    client.storage.from_(bucket_name).upload(
        path=file_path,
        file=file_bytes,
        file_options={"content-type": content_type},
    )

    # Build and return the public URL
    public_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/{bucket_name}/{file_path}"
    return public_url


def delete_file(file_url: str, bucket: Optional[str] = None) -> bool:
    """
    Delete a file from Supabase Storage by its public URL.

    Args:
        file_url: The full public URL of the file
        bucket: Storage bucket name (defaults to settings)

    Returns:
        True if deletion was successful
    """
    client = _get_client()
    bucket_name = bucket or settings.SUPABASE_STORAGE_BUCKET

    # Extract the file path from the URL
    # URL format: {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
    prefix = f"{settings.SUPABASE_URL}/storage/v1/object/public/{bucket_name}/"
    if file_url.startswith(prefix):
        file_path = file_url[len(prefix):]
    else:
        # Fallback — just use the last part of the URL
        file_path = file_url.split(f"{bucket_name}/")[-1]

    try:
        client.storage.from_(bucket_name).remove([file_path])
        return True
    except Exception:
        return False


def upload_multiple_files(
    files: list,
    folder: str = "assets",
    bucket: Optional[str] = None,
) -> list[str]:
    """
    Upload multiple files and return their public URLs.

    Args:
        files: List of tuples (file_bytes, filename, content_type)
        folder: Subfolder inside the bucket
        bucket: Storage bucket name

    Returns:
        List of public URLs
    """
    urls = []
    for file_bytes, filename, content_type in files:
        url = upload_file(file_bytes, filename, folder, content_type, bucket)
        urls.append(url)
    return urls
