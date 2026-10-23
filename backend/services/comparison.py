from dataclasses import dataclass
import json

import pandas as pd


@dataclass(frozen=True)
class ComparisonOptions:
    ignore_case: bool = False
    ignore_whitespace: bool = True
    ignore_null_differences: bool = False


def compare_frames(
    source: pd.DataFrame,
    target: pd.DataFrame,
    key_columns: list[str],
    options: ComparisonOptions,
) -> tuple[pd.DataFrame, dict[str, int | float]]:
    for label, frame in (("Source", source), ("Target", target)):
        missing = [column for column in key_columns if column not in frame.columns]
        if missing:
            raise ValueError(f"{label} file is missing primary key column(s): {', '.join(missing)}")
        key_values = frame[key_columns]
        empty_values = key_values.isna() | key_values.astype(str).apply(lambda column: column.str.strip().eq(""))
        if empty_values.any().any():
            raise ValueError(f"{label} file contains empty primary key values.")
        if frame.duplicated(subset=key_columns).any():
            raise ValueError(f"{label} file contains duplicate primary key values.")

    source = source.copy()
    target = target.copy()
    source["__key"] = source[key_columns].apply(_key_for_row, axis=1)
    target["__key"] = target[key_columns].apply(_key_for_row, axis=1)
    source_keys = set(source["__key"])
    target_keys = set(target["__key"])
    source_only = [key for key in source["__key"] if key not in target_keys]
    target_only = [key for key in target["__key"] if key not in source_keys]
    shared = [key for key in source["__key"] if key in target_keys]

    source_indexed = source.set_index("__key", drop=False)
    target_indexed = target.set_index("__key", drop=False)
    non_key_columns = list(dict.fromkeys(
        [column for column in source.columns if column not in key_columns and column != "__key"]
        + [column for column in target.columns if column not in key_columns and column != "__key"]
    ))
    records: list[dict] = []
    mismatched_keys: set[str] = set()
    key_labels = {
        **dict(zip(source["__key"], source[key_columns].apply(_display_key, axis=1))),
        **dict(zip(target["__key"], target[key_columns].apply(_display_key, axis=1))),
    }

    for key in source_only:
        records.append(_missing_record(key_labels[key], "Missing in Target"))
    for key in target_only:
        records.append(_missing_record(key_labels[key], "Missing in Source"))

    for column in non_key_columns:
        left = source_indexed.loc[list(shared), column] if column in source.columns else pd.Series(index=list(shared), dtype=object)
        right = target_indexed.loc[list(shared), column] if column in target.columns else pd.Series(index=list(shared), dtype=object)
        left = left.reindex(list(shared))
        right = right.reindex(list(shared))
        normalized_left = left.map(lambda value: _normalize(value, options))
        normalized_right = right.map(lambda value: _normalize(value, options))
        different = normalized_left.ne(normalized_right)
        if options.ignore_null_differences:
            nulls = left.isna() | right.isna() | left.eq("") | right.eq("")
            different &= ~nulls
        for key in different.index[different]:
            mismatched_keys.add(key)
            records.append({
                "PRIMARY_KEY": key_labels[key],
                "COLUMN": column,
                "SOURCE_VALUE": _display_value(left.loc[key]),
                "TARGET_VALUE": _display_value(right.loc[key]),
                "STATUS": "Mismatched",
                "DIFFERENCE_TYPE": "Value changed" if column in source.columns and column in target.columns else "Column missing",
            })

    total = len(source_keys | target_keys)
    matched = len(set(shared) - mismatched_keys)
    mismatched = len(mismatched_keys)
    summary = {
        "total_records": total,
        "matched": matched,
        "mismatched": mismatched,
        "missing_source": len(target_only),
        "missing_target": len(source_only),
        "success_rate": round(matched / total * 100, 4) if total else 100.0,
    }
    result_columns = ["PRIMARY_KEY", "COLUMN", "SOURCE_VALUE", "TARGET_VALUE", "STATUS", "DIFFERENCE_TYPE"]
    return pd.DataFrame.from_records(records, columns=result_columns), summary


def _key_for_row(row: pd.Series) -> str:
    values = []
    for value in row:
        if pd.isna(value):
            values.append("")
        elif isinstance(value, float) and value.is_integer():
            values.append(str(int(value)))
        else:
            values.append(str(value).strip())
    return json.dumps(values, ensure_ascii=False, separators=(",", ":"))


def _display_key(row: pd.Series) -> str:
    return " | ".join(_display_value(value) for value in row)


def _normalize(value, options: ComparisonOptions) -> str:
    if pd.isna(value):
        return ""
    if isinstance(value, float) and value.is_integer():
        normalized = str(int(value))
    else:
        normalized = str(value)
    if options.ignore_whitespace:
        normalized = "".join(normalized.split())
    if options.ignore_case:
        normalized = normalized.casefold()
    return normalized


def _display_value(value) -> str:
    return "" if pd.isna(value) else str(value)


def _missing_record(key: str, status: str) -> dict[str, str]:
    source_exists = status == "Missing in Source"
    return {
        "PRIMARY_KEY": key,
        "COLUMN": "—",
        "SOURCE_VALUE": "Exists" if source_exists else "",
        "TARGET_VALUE": "" if source_exists else "Exists",
        "STATUS": status,
        "DIFFERENCE_TYPE": "Record missing",
    }
