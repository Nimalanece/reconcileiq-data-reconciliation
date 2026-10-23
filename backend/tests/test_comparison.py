import unittest

import pandas as pd

from backend.reports.generator import build_report
from backend.services.comparison import ComparisonOptions, compare_frames


class CompareFramesTests(unittest.TestCase):
    def test_composite_keys_report_record_level_summary_and_cell_differences(self):
        source = pd.DataFrame([
            {"REGION": "east", "EMPID": "1", "NAME": "Ava", "AMOUNT": 10},
            {"REGION": "west", "EMPID": "2", "NAME": "Noah", "AMOUNT": 20},
        ])
        target = pd.DataFrame([
            {"REGION": "east", "EMPID": "1", "NAME": "AVA", "AMOUNT": 10},
            {"REGION": "west", "EMPID": "2", "NAME": "Noah", "AMOUNT": 30},
            {"REGION": "north", "EMPID": "3", "NAME": "Mia", "AMOUNT": 40},
        ])

        results, summary = compare_frames(
            source, target, ["REGION", "EMPID"], ComparisonOptions(ignore_case=True)
        )

        self.assertEqual(summary, {
            "total_records": 3,
            "matched": 1,
            "mismatched": 1,
            "missing_source": 1,
            "missing_target": 0,
            "success_rate": 33.3333,
        })
        mismatch = results[results["STATUS"] == "Mismatched"].iloc[0]
        self.assertEqual(mismatch["COLUMN"], "AMOUNT")
        self.assertEqual(set(results["STATUS"]), {"Mismatched", "Missing in Source"})

    def test_normalization_and_null_options(self):
        source = pd.DataFrame([{"EMPID": 1, "VALUE": "  Alpha "}, {"EMPID": 2, "VALUE": None}])
        target = pd.DataFrame([{"EMPID": 1, "VALUE": "alpha"}, {"EMPID": 2, "VALUE": "filled"}])

        results, summary = compare_frames(
            source,
            target,
            ["EMPID"],
            ComparisonOptions(ignore_case=True, ignore_whitespace=True, ignore_null_differences=True),
        )

        self.assertTrue(results.empty)
        self.assertEqual(summary["matched"], 2)

    def test_duplicate_keys_are_rejected(self):
        duplicate = pd.DataFrame([{"EMPID": 1, "VALUE": "a"}, {"EMPID": 1, "VALUE": "b"}])
        with self.assertRaisesRegex(ValueError, "duplicate primary key"):
            compare_frames(duplicate, duplicate, ["EMPID"], ComparisonOptions())

    def test_empty_primary_keys_are_rejected_and_integer_float_keys_match(self):
        empty_key = pd.DataFrame([{"EMPID": "", "VALUE": "a"}])
        with self.assertRaisesRegex(ValueError, "empty primary key"):
            compare_frames(empty_key, empty_key, ["EMPID"], ComparisonOptions())

        source = pd.DataFrame([{"EMPID": 1.0, "VALUE": "same"}])
        target = pd.DataFrame([{"EMPID": 1, "VALUE": "same"}])
        results, summary = compare_frames(source, target, ["EMPID"], ComparisonOptions())
        self.assertTrue(results.empty)
        self.assertEqual(summary["matched"], 1)

    def test_reports_are_generated_in_each_supported_format(self):
        comparison = {
            "results": pd.DataFrame([{
                "PRIMARY_KEY": "1", "COLUMN": "NAME", "SOURCE_VALUE": "A",
                "TARGET_VALUE": "B", "STATUS": "Mismatched", "DIFFERENCE_TYPE": "Value changed",
            }]),
            "summary": {"total_records": 1, "matched": 0, "mismatched": 1, "missing_source": 0, "missing_target": 0, "success_rate": 0.0},
            "metadata": {
                "timestamp": "2026-01-01T00:00:00+00:00",
                "source_file_name": "source.csv",
                "target_file_name": "target.csv",
                "primary_keys": ["EMPID"],
                "execution_duration_ms": 10,
                "source_columns": ["EMPID", "NAME"],
                "target_columns": ["EMPID", "NAME"],
            },
        }

        for file_format, expected_signature in [
            ("xlsx", b"PK"), ("csv", b"\xef\xbb\xbf"), ("json", b"{"), ("pdf", b"%PDF"),
        ]:
            with self.subTest(file_format=file_format):
                content, _media_type, extension = build_report(comparison, file_format, None)
                self.assertTrue(content.startswith(expected_signature))
                if file_format == "csv":
                    self.assertIn(b"PRIMARY_KEY", content)
                self.assertEqual(extension, file_format)


if __name__ == "__main__":
    unittest.main()
