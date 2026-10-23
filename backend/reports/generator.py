from io import BytesIO, StringIO
import json

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle


def build_report(comparison: dict, file_format: str, selected_indices: list[int] | None):
    frame: pd.DataFrame = comparison["results"]
    if selected_indices is not None:
        if any(index < 0 or index >= len(frame) for index in selected_indices):
            raise ValueError("One or more selected rows are no longer available.")
        frame = frame.iloc[selected_indices]
    metadata = comparison["metadata"]
    summary = comparison["summary"]
    file_format = file_format.lower()

    if file_format == "csv":
        return frame.to_csv(index=False).encode("utf-8-sig"), "text/csv", "csv"
    if file_format == "json":
        json_frame = frame.astype(object).where(frame.notna(), None)
        payload = {"metadata": metadata, "summary": summary, "results": json_frame.to_dict(orient="records")}
        return json.dumps(payload, ensure_ascii=False, default=str, indent=2).encode("utf-8"), "application/json", "json"
    if file_format == "xlsx":
        buffer = BytesIO()
        with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
            pd.DataFrame([summary]).to_excel(writer, sheet_name="Summary", index=False)
            frame.to_excel(writer, sheet_name="Differences", index=False)
            excel_metadata = {
                key: ", ".join(map(str, value)) if isinstance(value, list) else value
                for key, value in metadata.items()
            }
            pd.DataFrame([excel_metadata]).to_excel(writer, sheet_name="Metadata", index=False)
        return buffer.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"
    if file_format == "pdf":
        buffer = BytesIO()
        document = SimpleDocTemplate(buffer, pagesize=landscape(letter))
        summary_rows = [
            ["Reconciliation Report", ""],
            ["Run timestamp", metadata["timestamp"]],
            ["Source", metadata["source_file_name"]],
            ["Target", metadata["target_file_name"]],
            ["Primary key", ", ".join(metadata["primary_keys"])],
            ["Execution duration", f'{metadata["execution_duration_ms"]} ms'],
            ["Total records", summary["total_records"]],
            ["Matched / mismatched", f'{summary["matched"]} / {summary["mismatched"]}'],
            ["Missing source / target", f'{summary["missing_source"]} / {summary["missing_target"]}'],
        ]
        summary_table = Table(summary_rows, colWidths=[150, 570])
        summary_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#183b63")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#ccd6e0")),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        result_rows = [list(frame.columns), *frame.fillna("").astype(str).values.tolist()]
        result_table = Table(result_rows, repeatRows=1)
        result_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eef5")),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#ccd6e0")),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        document.build([summary_table, result_table])
        return buffer.getvalue(), "application/pdf", "pdf"
    raise ValueError("Unsupported report format. Choose XLSX, CSV, JSON, or PDF.")
