from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from validate import validate_contract  # noqa: E402


def valid_input() -> dict:
    return {
        "requirement_hash": "abcdef123456",
        "requirements": [{"id": "REQ-ONE", "text": "경계값을 검증한다."}],
    }


def valid_artifact() -> dict:
    return {
        "requirement_hash": "abcdef123456",
        "iteration": 0,
        "generator_session_id": "gen-session",
        "unit_tests": [{
            "id": "UT-ONE",
            "title": "경계값",
            "requirement_ids": ["REQ-ONE"],
            "system_under_test": "calculate",
            "arrange": ["값을 준비한다"],
            "act": "calculate를 호출한다",
            "assertions": [{"actual": "result", "matcher": "toBe", "expected": 0}],
            "mocks": [],
        }],
        "gherkin_scenarios": [{
            "id": "GH-ONE",
            "title": "경계값",
            "requirement_ids": ["REQ-ONE"],
            "given": ["값이 0이다"],
            "when": ["계산한다"],
            "then": [{"observable": "결과", "expected": 0}],
        }],
        "generated_files": [
            {"kind": "vitest", "path": "generated/test.ts", "content": "expect(result).toBe(0)"},
            {"kind": "gherkin", "path": "generated/test.feature", "content": "Then 결과는 0이다"},
        ],
    }


def valid_verdict() -> dict:
    return {
        "requirement_hash": "abcdef123456",
        "evaluator_session_id": "eval-session",
        "weighted_total": 4.2,
        "rubric_verdict": "PASS",
    }


class ContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.schema = json.loads((ROOT / "schemas/scenarios.schema.json").read_text(encoding="utf-8"))

    def test_valid_contract_passes(self) -> None:
        result = validate_contract(valid_input(), valid_artifact(), valid_verdict(), self.schema, 2)
        self.assertEqual(result["verdict"], "PASS")
        self.assertEqual(result["contract_errors"], [])

    def test_vague_assertion_is_rejected(self) -> None:
        artifact = valid_artifact()
        artifact["gherkin_scenarios"][0]["then"][0]["observable"] = "should work"
        result = validate_contract(valid_input(), artifact, valid_verdict(), self.schema, 2)
        self.assertEqual(result["verdict"], "REJECT")
        self.assertTrue(any(error.startswith("banned:") for error in result["contract_errors"]))

    def test_uncovered_requirement_is_rejected(self) -> None:
        pipeline_input = valid_input()
        pipeline_input["requirements"].append({"id": "REQ-TWO", "text": "실패를 검증한다."})
        result = validate_contract(pipeline_input, valid_artifact(), valid_verdict(), self.schema, 2)
        self.assertEqual(result["verdict"], "REJECT")
        self.assertTrue(any("uncovered requirements" in error for error in result["contract_errors"]))

    def test_low_rubric_score_is_rejected(self) -> None:
        verdict = valid_verdict()
        verdict["rubric_verdict"] = "REJECT"
        verdict["weighted_total"] = 3.5
        result = validate_contract(valid_input(), valid_artifact(), verdict, self.schema, 2)
        self.assertEqual(result["verdict"], "REJECT")
        self.assertTrue(any(error.startswith("quality:") for error in result["contract_errors"]))


if __name__ == "__main__":
    unittest.main()
