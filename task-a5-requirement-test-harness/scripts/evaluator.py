"""Calculate a deterministic weighted verdict from an independent Eval assessment.

Adapted from the Phase 0 evaluator. The important boundary is retained: this file
calculates scores but never generates or rewrites tests.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import yaml


def load_rubric(path: Path) -> dict:
    rubric = yaml.safe_load(path.read_text(encoding="utf-8"))
    parent_name = rubric.get("extends")
    hard_gates: list[str] = []
    if parent_name:
        parent = yaml.safe_load((path.parent / parent_name).read_text(encoding="utf-8"))
        hard_gates.extend(parent.get("hard_gates", []))
    hard_gates.extend(rubric.get("hard_gates", []))
    rubric["hard_gates"] = hard_gates

    axes = rubric.get("axes", [])
    total_weight = sum(float(axis["weight"]) for axis in axes)
    if abs(total_weight - 1.0) > 1e-9:
        raise ValueError(f"rubric weights must sum to 1.0, got {total_weight}")
    return rubric


def normalize_evidence(value: object) -> str:
    """Accept one evidence sentence or a list and store one deterministic string."""
    if isinstance(value, list):
        return " ".join(str(item).strip() for item in value if str(item).strip())
    return str(value).strip()


def evaluate(artifact_path: Path, rubric_path: Path, assessment_path: Path, verdict_path: Path) -> dict:
    artifact = json.loads(artifact_path.read_text(encoding="utf-8"))
    rubric = load_rubric(rubric_path)
    assessment = json.loads(assessment_path.read_text(encoding="utf-8"))
    axes = {axis["name"]: axis for axis in rubric["axes"]}
    scores = assessment.get("scores", {})
    raw_evidence = assessment.get("evidence", {})
    evidence = {name: normalize_evidence(raw_evidence.get(name, "")) for name in axes}

    if set(scores) != set(axes) or set(raw_evidence) != set(axes):
        raise ValueError("assessment must contain scores and evidence for every rubric axis")
    if any(not isinstance(score, int) or not 1 <= score <= 5 for score in scores.values()):
        raise ValueError("scores must be integers from 1 to 5")
    if any(not str(evidence[name]).strip() for name in axes):
        raise ValueError("every score requires concrete evidence")
    if assessment.get("requirement_hash") != artifact.get("requirement_hash"):
        raise ValueError("requirement_hash differs between artifact and assessment")
    if assessment.get("evaluator_session_id") == artifact.get("generator_session_id"):
        raise ValueError("Gen and Eval session IDs must differ")

    weights = {name: float(axis["weight"]) for name, axis in axes.items()}
    weighted_total = round(sum(scores[name] * weights[name] for name in axes), 3)
    min_total = float(rubric["min_total"])
    min_axis = int(rubric.get("min_axis", 1))
    passed = weighted_total >= min_total and all(score >= min_axis for score in scores.values())
    verdict = {
        "requirement_hash": artifact["requirement_hash"],
        "iteration": artifact["iteration"],
        "rubric_version": rubric["version"],
        "weights": weights,
        "scores": scores,
        "evidence": evidence,
        "weighted_total": weighted_total,
        "rubric_verdict": "PASS" if passed else "REJECT",
        "verdict": "PASS" if passed else "REJECT",
        "priority_fixes": assessment.get("priority_fixes", []),
        "contract_errors": [],
        "evaluator_model": assessment.get("evaluator_model", "independent-review-session"),
        "evaluator_session_id": assessment["evaluator_session_id"],
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
    }
    verdict_path.parent.mkdir(parents=True, exist_ok=True)
    verdict_path.write_text(json.dumps(verdict, ensure_ascii=False, indent=2), encoding="utf-8")
    return verdict


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("artifact_json", type=Path)
    parser.add_argument("rubric_yaml", type=Path)
    parser.add_argument("assessment_json", type=Path)
    parser.add_argument("verdict_json", type=Path)
    args = parser.parse_args()
    verdict = evaluate(args.artifact_json, args.rubric_yaml, args.assessment_json, args.verdict_json)
    print(json.dumps({"weighted_total": verdict["weighted_total"], "verdict": verdict["verdict"]}))


if __name__ == "__main__":
    main()
