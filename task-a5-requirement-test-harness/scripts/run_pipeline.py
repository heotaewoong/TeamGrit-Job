"""Finalize one externally separated Gen/Critique/Eval iteration and retain its log."""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

from evaluator import evaluate
from generator import package_artifact
from validate import schema_errors, validate_contract


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def assert_schema(document: dict, schema_path: Path, label: str) -> None:
    schema = load_json(schema_path)
    errors = schema_errors(document, schema, label)
    if errors:
        raise ValueError("; ".join(errors))


def write_execution_log(run_dir: Path, pipeline_input: dict, artifact: dict, critique: dict, verdict: dict, max_iterations: int) -> None:
    log = {
        "requirement_hash": pipeline_input["requirement_hash"],
        "task": pipeline_input["task"],
        "iteration": artifact["iteration"],
        "max_iterations": max_iterations,
        "generator_session_id": artifact["generator_session_id"],
        "critic_session_id": critique["critic_session_id"],
        "evaluator_session_id": verdict["evaluator_session_id"],
        "weighted_total": verdict["weighted_total"],
        "rubric_verdict": verdict["rubric_verdict"],
        "contract_verdict": verdict["verdict"],
        "contract_errors": verdict["contract_errors"],
        "converged": verdict["verdict"] == "PASS" and not verdict.get("priority_fixes"),
        "recorded_at": datetime.now(timezone.utc).isoformat(),
    }
    (run_dir / "EXECUTION-LOG.json").write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")
    markdown = f"""# 실행 로그

- task: {log['task']}
- iteration: {log['iteration']} / MAX_ITERATIONS {max_iterations}
- Gen session: `{log['generator_session_id']}`
- Critique session: `{log['critic_session_id']}`
- Eval session: `{log['evaluator_session_id']}`
- weighted total: {log['weighted_total']}
- rubric: {log['rubric_verdict']}
- contract: {log['contract_verdict']}
- converged: {str(log['converged']).lower()}
- contract errors: {json.dumps(log['contract_errors'], ensure_ascii=False)}
"""
    (run_dir / "EXECUTION-LOG.md").write_text(markdown, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--draft", required=True, type=Path)
    parser.add_argument("--critique", required=True, type=Path)
    parser.add_argument("--assessment", required=True, type=Path)
    parser.add_argument("--run-dir", required=True, type=Path)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--max-iterations", type=int, default=2)
    args = parser.parse_args()

    root = args.root.resolve()
    run_dir = args.run_dir.resolve()
    run_dir.mkdir(parents=True, exist_ok=True)
    input_schema = root / "schemas/input.schema.json"
    scenario_schema = root / "schemas/scenarios.schema.json"
    critique_schema = root / "schemas/critique.schema.json"
    verdict_schema = root / "schemas/verdict.schema.json"
    rubric = root / "rubrics/test-generation.yaml"

    pipeline_input = load_json(args.input)
    assert_schema(pipeline_input, input_schema, "input")
    shutil.copy2(args.input, run_dir / "01_input.json")

    artifact = package_artifact(
        args.input,
        args.draft,
        scenario_schema,
        run_dir / "02_output.json",
        root,
    )
    critique = load_json(args.critique)
    assert_schema(critique, critique_schema, "critique")
    if critique["requirement_hash"] != pipeline_input["requirement_hash"]:
        raise ValueError("Critique requirement_hash differs from input")
    shutil.copy2(args.critique, run_dir / "03_critique.json")

    verdict = evaluate(run_dir / "02_output.json", rubric, args.assessment, run_dir / "04_verdict.json")
    verdict = validate_contract(pipeline_input, artifact, verdict, load_json(scenario_schema), args.max_iterations)
    (run_dir / "04_verdict.json").write_text(json.dumps(verdict, ensure_ascii=False, indent=2), encoding="utf-8")
    assert_schema(verdict, verdict_schema, "verdict")
    shutil.copy2(args.assessment, run_dir / "03a_assessment.json")
    write_execution_log(run_dir, pipeline_input, artifact, critique, verdict, args.max_iterations)
    print(json.dumps({"run_dir": str(run_dir), "verdict": verdict["verdict"], "iteration": artifact["iteration"]}, ensure_ascii=False))
    raise SystemExit(0 if verdict["verdict"] == "PASS" else 2)


if __name__ == "__main__":
    main()
