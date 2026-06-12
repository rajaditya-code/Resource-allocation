"""
Input validators — reusable validation helpers.

Used across routes to validate file uploads, inputs, etc.
"""

from fastapi import HTTPException, UploadFile

# Allowed image types and max size
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_IMAGE_SIZE_MB = 3
MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024


def validate_image(file: UploadFile) -> None:
    """
    Validate an uploaded image file.
    Checks file extension and content type. Size is checked after reading.
    Raises HTTPException if the file is invalid.
    """
    # Check content type
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image format: {content_type}. Allowed: jpg, jpeg, png, webp",
        )

    # Check file extension
    filename = (file.filename or "").lower()
    if filename:
        ext = "." + filename.rsplit(".", 1)[-1] if "." in filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file extension: {ext}. Allowed: .jpg, .jpeg, .png, .webp",
            )


async def validate_image_with_size(file: UploadFile) -> bytes:
    """
    Validate an image and also check its size.
    Returns the file bytes if everything is valid.
    """
    validate_image(file)
    contents = await file.read()

    if len(contents) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Image too large. Maximum size is {MAX_IMAGE_SIZE_MB} MB",
        )

    return contents
