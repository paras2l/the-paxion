import json
import sys


def main() -> None:
    payload = {"objective": "strengthen paxion"}
    raw = sys.stdin.read().strip()
    if raw:
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"objective": raw}

    objective = str(payload.get("objective", "strengthen paxion"))
    print(
        json.dumps(
            {
                "language": "python",
                "role": "ai-orchestration",
                "strengths": ["ML ecosystem", "automation", "rapid experimentation"],
                "recommendation": f"Use Python for adaptive reasoning tools, model orchestration, and data pipelines around: {objective}",
                "focusAreas": ["agent tools", "data processing", "prompt workflows"],
            }
        )
    )


if __name__ == "__main__":
    main()