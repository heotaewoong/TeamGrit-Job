"""Package a separated Gen session result into the test-scenario contract.

Adapted from Phase 0 writing-harness/archive/task8-playbook-exercise/generator.py.
The model call stays outside this process so Eval never receives Gen conversation history.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_json(document: dict, schema: dict, label: str) -> None:
    errors = sorted(
        Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(document),
        key=lambda error: list(error.path),
    )
    if errors:
        details = "; ".join(f"{'.'.join(map(str, error.path)) or '$'}: {error.message}" for error in errors)
        raise ValueError(f"{label} schema failed: {details}")


def safe_output_path(root: Path, relative: str) -> Path:
    destination = (root / relative).resolve()
    resolved_root = root.resolve()
    if destination != resolved_root and resolved_root not in destination.parents:
        raise ValueError(f"generated path escapes run directory: {relative}")
    return destination


def package_artifact(
    input_path: Path,
    draft_path: Path,
    scenario_schema_path: Path,
    output_path: Path,
    materialize_root: Path,
) -> dict:
    pipeline_input = load_json(input_path)
    artifact = load_json(draft_path)
    if artifact.get("requirement_hash") != pipeline_input.get("requirement_hash"):
        raise ValueError("requirement_hash differs between input and Gen output")

    schema = load_json(scenario_schema_path)
    validate_json(artifact, schema, "scenario")
    artifact["packaged_at"] = datetime.now(timezone.utc).isoformat()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(artifact, ensure_ascii=False, indent=2), encoding="utf-8")

    for generated in artifact["generated_files"]:
        destination = safe_output_path(materialize_root, generated["path"])
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(generated["content"], encoding="utf-8")
    return artifact


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_json", type=Path)
    parser.add_argument("draft_json", type=Path)
    parser.add_argument("scenario_schema", type=Path)
    parser.add_argument("output_json", type=Path)
    parser.add_argument("materialize_root", type=Path)
    args = parser.parse_args()
    result = package_artifact(
        args.input_json,
        args.draft_json,
        args.scenario_schema,
        args.output_json,
        args.materialize_root,
    )
    print(json.dumps({"iteration": result["iteration"], "output": str(args.output_json)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
