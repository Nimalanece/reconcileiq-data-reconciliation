from pathlib import Path

import pandas as pd
from fastapi import UploadFile

SUPPORTED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".txt"}
MAX_UPLOAD_BYTES = 100 * 1024 * 1024


async def read_upload(upload: UploadFile) -> pd.DataFrame:
    extension = Path(upload.filename or "").suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported file format: {extension or 'unknown'}. Use CSV, XLSX, XLS, or TXT.")
    if upload.size is not None and upload.size > MAX_UPLOAD_BYTES:
        raise ValueError("File exceeds the 100 MB upload limit.")
    content = await upload.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise ValueError("File exceeds the 100 MB upload limit.")
    if not content:
        raise ValueError(f"{upload.filename or 'Uploaded file'} is empty.")
    from io import BytesIO

    stream = BytesIO(content)
    if extension in {".xlsx", ".xls"}:
        return pd.read_excel(stream)
    if extension == ".txt":
        return pd.read_csv(stream, sep=None, engine="python")
    return pd.read_csv(stream)
