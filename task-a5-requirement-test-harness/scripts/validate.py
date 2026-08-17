"""Deterministic A-5 contract gate: schema, traceability, banned assertions, quality."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Iterable

from jsonschema import Draft202012Validator, FormatChecker


BANNED_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\bshould\s+work\b",
        r"\bworks?\s+as\s+expected\b",
        r"정상\s*동작",
        r"잘\s*처리",
        r"적절히\s*처리",
        r"문제없이\s*작동",
    )
]


def schema_errors(document: dict, schema: dict, label: str) -> list[str]:
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(document), key=lambda error: list(error.path))
    return [f"{label}.schema:{'.'.join(map(str, error.path)) or '$'}: {error.message}" for error in errors]


def walk_strings(value: Any, path: str = "$") -> Iterable[tuple[str, str]]:
    if isinstance(value, str):
        yield path, value
    elif isinstance(value, dict):
        for key, child in value.items():
            yield from walk_strings(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from walk_strings(child, f"{path}[{index}]")


def check_banned(artifact: dict) -> list[str]:
    errors: list[str] = []
    for path, value in walk_strings(artifact):
        for pattern in BANNED_PATTERNS:
            if pattern.search(value):
                errors.append(f"banned:{path}: '{pattern.pattern}'")
    return errors


def check_traceability(pipeline_input: dict, artifact: dict) -> list[str]:
    errors: list[str] = []
    expected = {requirement["id"] for requirement in pipeline_input["requirements"]}
    referenced: set[str] = set()
    ids: list[str] = []
    for test in artifact["unit_tests"] + artifact["gherkin_scenarios"]:
        ids.append(test["id"])
        referenced.update(test["requirement_ids"])
        unknown = set(test["requirement_ids"]) - expected
        if unknown:
            errors.append(f"traceability:{test['id']}: unknown requirements {sorted(unknown)}")
    duplicates = sorted({test_id for test_id in ids if ids.count(test_id) > 1})
    if duplicates:
        errors.append(f"traceability: duplicate test IDs {duplicates}")
    missing = sorted(expected - referenced)
    if missing:
        errors.append(f"traceability: uncovered requirements {missing}")
    return errors


def check_mock_boundaries(artifact: dict) -> list[str]:
    errors: list[str] = []
    for test in artifact["unit_tests"]:
        subject = test["system_under_test"].strip().lower()
        for mock in test["mocks"]:
            target = mock["target"].strip().lower()
            if target == subject:
                errors.append(f"mock:{test['id']}: system under test '{target}' must not be mocked")
    return errors


def check_required_file_kinds(artifact: dict) -> list[str]:
    kinds = {generated["kind"] for generated in artifact["generated_files"]}
    missing = {"vitest", "gherkin"} - kinds
    return [f"generated_files: missing kinds {sorted(missing)}"] if missing else []


def validate_contract(
    pipeline_input: dict,
    artifact: dict,
    verdict: dict,
    scenario_schema: dict,
    max_iterations: int,
) -> dict:
    errors = schema_errors(artifact, scenario_schema, "scenario")
    hashes = {pipeline_input.get("requirement_hash"), artifact.get("requirement_hash"), verdict.get("requirement_hash")}
    if len(hashes) != 1:
        errors.append("hash: input, artifact, and verdict requirement_hash must match")
    if artifact.get("generator_session_id") == verdict.get("evaluator_session_id"):
        errors.append("separation: Gen and Eval session IDs must differ")
    if int(artifact.get("iteration", 0)) > max_iterations:
        errors.append(f"iteration: {artifact.get('iteration')} > MAX_ITERATIONS({max_iterations})")
    errors += check_banned(artifact)
    if not errors:
        errors += check_traceability(pipeline_input, artifact)
        errors += check_mock_boundaries(artifact)
        errors += check_required_file_kinds(artifact)
    if verdict.get("rubric_verdict") != "PASS":
        errors.append(f"quality: weighted_total {verdict.get('weighted_total')} below rubric gate")
    verdict["contract_errors"] = errors
    verdict["verdict"] = "REJECT" if errors else "PASS"
    return verdict


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_json", type=Path)
    parser.add_argument("artifact_json", type=Path)
    parser.add_argument("verdict_json", type=Path)
    parser.add_argument("scenario_schema", type=Path)
    parser.add_argument("--max-iterations", type=int, default=2)
    parser.add_argument("--write", type=Path)
    args = parser.parse_args()

    pipeline_input = json.loads(args.input_json.read_text(encoding="utf-8"))
    artifact = json.loads(args.artifact_json.read_text(encoding="utf-8"))
    verdict = json.loads(args.verdict_json.read_text(encoding="utf-8"))
    schema = json.loads(args.scenario_schema.read_text(encoding="utf-8"))
    result = validate_contract(pipeline_input, artifact, verdict, schema, args.max_iterations)
    destination = args.write or args.verdict_json
    destination.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"verdict": result["verdict"], "errors": result["contract_errors"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
