import json
import logging
from datetime import datetime
from time import perf_counter
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from backend.reports.generator import build_report
from backend.models.schemas import ComparisonSummary
from backend.services.comparison import ComparisonOptions, compare_frames
from backend.services.storage import get_comparison, store_comparison
from backend.utils.files import read_upload

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/preview")
async def preview_file(file: UploadFile = File(...)):
    try:
        frame = await read_upload(file)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        logger.exception("Could not read uploaded preview file")
        raise HTTPException(status_code=422, detail="The uploaded file could not be read.") from error

    return {
        "file_name": file.filename,
        "size_bytes": file.size,
        "record_count": len(frame),
        "columns": frame.columns.tolist(),
        "last_modified": None,
        "rows": frame.head(10).astype(object).where(frame.head(10).notna(), None).to_dict(orient="records"),
    }


@router.post("/compare")
async def compare_files(
    source: UploadFile = File(...),
    target: UploadFile = File(...),
    primary_keys: str = Form('["EMPID"]'),
    ignore_case: bool = Form(False),
    ignore_whitespace: bool = Form(True),
    ignore_null_differences: bool = Form(False),
):
    started_at = perf_counter()
    try:
        key_columns = json.loads(primary_keys)
        if not isinstance(key_columns, list) or not key_columns or not all(
            isinstance(column, str) and column.strip() for column in key_columns
        ):
            raise ValueError("Choose at least one valid primary key column.")
        source_frame, target_frame = await read_upload(source), await read_upload(target)
        result_frame, summary = compare_frames(
            source_frame,
            target_frame,
            key_columns,
            ComparisonOptions(ignore_case, ignore_whitespace, ignore_null_differences),
        )
        summary = ComparisonSummary.model_validate(summary).model_dump()
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        logger.exception("Comparison failed")
        raise HTTPException(status_code=422, detail="Comparison failed while reading or processing the files.") from error

    comparison_id = str(uuid4())
    duration_ms = round((perf_counter() - started_at) * 1000, 2)
    metadata = {
        "comparison_id": comparison_id,
        "timestamp": datetime.now().astimezone().isoformat(),
        "source_file_name": source.filename or "source",
        "target_file_name": target.filename or "target",
        "primary_keys": key_columns,
        "execution_duration_ms": duration_ms,
        "source_columns": source_frame.columns.tolist(),
        "target_columns": target_frame.columns.tolist(),
        "source_record_count": len(source_frame),
        "target_record_count": len(target_frame),
    }
    comparison_data = {
        "results": result_frame,
        "source_preview": source_frame,
        "target_preview": target_frame,
        "metadata": metadata,
        "summary": summary,
        "column_differences": [
            {"column": str(column), "count": int(count)}
            for column, count in result_frame[result_frame["STATUS"] == "Mismatched"]["COLUMN"].value_counts().items()
        ],
    }
    store_comparison(comparison_id, comparison_data)

    return {
        "summary": summary,
        "metadata": metadata,
        "columns": result_frame.columns.tolist(),
        "results": _page_records(result_frame.head(100)),
        "result_count": len(result_frame),
        "column_differences": comparison_data["column_differences"],
    }


@router.get("/comparisons/{comparison_id}/results")
def get_results(
    comparison_id: str,
    offset: int = 0,
    limit: int = 50,
    search: str = "",
    status: str = "",
    column: str = "",
    sort_by: str = "",
    descending: bool = False,
):
    comparison = _get_comparison(comparison_id)
    frame = comparison["results"]
    if status:
        frame = frame[frame["STATUS"].str.casefold() == status.casefold()]
    if column:
        frame = frame[frame["COLUMN"].str.casefold() == column.casefold()]
    if search:
        mask = frame.astype(str).apply(
            lambda values: values.str.contains(search, case=False, regex=False)
        ).any(axis=1)
        frame = frame[mask]
    if sort_by in frame.columns:
        frame = frame.sort_values(sort_by, ascending=not descending, kind="stable")
    limit = min(max(limit, 1), 500)
    page = frame.iloc[max(offset, 0):max(offset, 0) + limit]
    return {
        "total": len(frame),
        "offset": max(offset, 0),
        "limit": limit,
        "results": _page_records(page),
    }


@router.get("/comparisons/{comparison_id}/preview/{side}")
def get_preview(comparison_id: str, side: str, offset: int = 0, limit: int = 10):
    comparison = _get_comparison(comparison_id)
    if side not in {"source", "target"}:
        raise HTTPException(status_code=400, detail="Side must be 'source' or 'target'.")
    frame = comparison[f"{side}_preview"]
    limit = min(max(limit, 1), 100)
    page = frame.iloc[max(offset, 0):max(offset, 0) + limit]
    return {
        "total": comparison["metadata"][f"{side}_record_count"],
        "columns": frame.columns.tolist(),
        "rows": page.astype(object).where(page.notna(), None).to_dict(orient="records"),
    }


@router.get("/comparisons/{comparison_id}/report/{file_format}")
def download_report(comparison_id: str, file_format: str, selected: str = ""):
    comparison = _get_comparison(comparison_id)
    selected_indices = None
    if selected:
        try:
            selected_indices = [int(value) for value in selected.split(",")]
        except ValueError as error:
            raise HTTPException(status_code=400, detail="Selected row indexes must be integers.") from error

    try:
        content, media_type, extension = build_report(comparison, file_format, selected_indices)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="reconciliation_report.{extension}"'},
    )


@router.get("/comparisons/{comparison_id}/metadata")
def get_metadata(comparison_id: str):
    comparison = _get_comparison(comparison_id)
    return {"metadata": comparison["metadata"], "summary": comparison["summary"]}


def _get_comparison(comparison_id: str):
    comparison = get_comparison(comparison_id)
    if comparison is None:
        raise HTTPException(status_code=404, detail="Comparison not found or expired.")
    return comparison


def _page_records(frame):
    records = frame.astype(object).where(frame.notna(), None).to_dict(orient="records")
    for position, record in zip(frame.index, records):
        record["__row_id"] = int(position)
    return records
