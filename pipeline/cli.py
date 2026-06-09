"""
cli.py
Command-line interface for the Policy Risk Review pipeline.

Usage:
    python -m pipeline.cli analyze --file path/to/doc.pdf --type legislation
    python -m pipeline.cli analyze --file path/to/doc.pdf --type treaty --name "My Treaty"
    python -m pipeline.cli list
"""

import argparse
import json
import pathlib
import sys
import datetime

from pipeline.extract import extract
from pipeline.analyze import analyze


DATA_DIR = pathlib.Path("data/processed")


def cmd_analyze(args):
    """Run analysis on a single document."""

    print(f"\n[1/3] Reading file: {args.file}")
    try:
        text = extract(args.file)
    except (FileNotFoundError, ValueError, ImportError) as e:
        print(f"Error: {e}")
        sys.exit(1)

    if len(text.strip()) < 100:
        print("Error: Extracted text is too short. Check your file.")
        sys.exit(1)

    print(f"      Extracted {len(text):,} characters")

    doc_type = args.type.capitalize()
    if doc_type not in ("Legislation", "Treaty"):
        print("Error: --type must be 'legislation' or 'treaty'")
        sys.exit(1)

    print(f"[2/3] Analyzing as {doc_type} with Claude...")
    try:
        result = analyze(text, doc_type)
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)

    # Build output record
    file_path = pathlib.Path(args.file)
    doc_name = args.name or file_path.stem.replace("_", " ").replace("-", " ").title()

    record = {
        "doc_name": doc_name,
        "doc_type": doc_type,
        "source_file": str(file_path),
        "analyzed_at": datetime.datetime.utcnow().isoformat() + "Z",
        "char_count": len(text),
        **result,
    }

    # Save to data/processed/
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = file_path.stem.lower().replace(" ", "_")
    timestamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    out_path = DATA_DIR / f"{safe_name}_{timestamp}.json"

    out_path.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"[3/3] Saved result to: {out_path}")
    print(f"\nWhat changes:\n{record.get('what_changes', '')}")
    print(f"\nWhat it overlooks:\n{record.get('what_it_overlooks', '')}")
    print(f"\nDownstream effects:\n{record.get('downstream_effects', '')}")
    print(f"\nWhat to review:\n{record.get('what_to_review', '')}")
    print(f"\nDone.")


def cmd_list(args):
    """List all processed analyses."""
    if not DATA_DIR.exists():
        print("No analyses found. Run: python -m pipeline.cli analyze --file <path>")
        return

    files = sorted(DATA_DIR.glob("*.json"), key=lambda f: f.stat().st_mtime, reverse=True)
    if not files:
        print("No analyses found.")
        return

    print(f"\n{'Document':<40} {'Type':<12} {'Date'}")
    print("-" * 70)
    for f in files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            name = data.get("doc_name", f.stem)[:38]
            dtype = data.get("doc_type", "?")
            date = data.get("analyzed_at", "")[:10]
            print(f"{name:<40} {dtype:<12} {date}")
        except Exception:
            print(f"{f.name} (could not read)")


def main():
    parser = argparse.ArgumentParser(
        prog="policy-risk-review",
        description="Policy Risk Review — AI-powered document analysis pipeline"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # analyze command
    p_analyze = subparsers.add_parser("analyze", help="Analyze a document")
    p_analyze.add_argument("--file", required=True, help="Path to PDF or TXT file")
    p_analyze.add_argument(
        "--type", required=True,
        choices=["legislation", "treaty"],
        help="Document type"
    )
    p_analyze.add_argument("--name", default=None, help="Document name (optional)")
    p_analyze.set_defaults(func=cmd_analyze)

    # list command
    p_list = subparsers.add_parser("list", help="List all processed analyses")
    p_list.set_defaults(func=cmd_list)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()