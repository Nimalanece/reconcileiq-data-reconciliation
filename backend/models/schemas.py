from pydantic import BaseModel


class ComparisonSummary(BaseModel):
    total_records: int
    matched: int
    mismatched: int
    missing_source: int
    missing_target: int
    success_rate: float


class ComparisonOptionsRequest(BaseModel):
    primary_keys: list[str]
    ignore_case: bool = False
    ignore_whitespace: bool = True
    ignore_null_differences: bool = False
