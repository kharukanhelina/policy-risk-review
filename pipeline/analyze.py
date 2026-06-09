"""
analyze.py
Sends extracted document text to Claude API and returns structured risk assessment.
"""

import os
import json
import anthropic


RISK_CATEGORIES = [
    "Enforcement Gap",
    "Definitional Ambiguity",
    "Jurisdictional Conflict",
    "Implementation Gap",
    "Human Rights Exposure",
    "Review Gap",
]

PROMPT_TEMPLATE = """You are a policy analyst writing a briefing note for a senior professional who needs to act fast.

Analyze this {doc_type} and return exactly this JSON with no extra text:

{{
  "what_changes": "1-2 plain sentences on what is new or different from existing frameworks.",
  "what_it_overlooks": [
    {{
      "category": "Enforcement Gap | Definitional Ambiguity | Jurisdictional Conflict | Implementation Gap | Human Rights Exposure | Review Gap",
      "reference": "specific article or section e.g. Article 4(2)",
      "gap": "1-2 plain sentences on what this provision misses or gets wrong and why it matters."
    }}
  ],
  "downstream_effects": "2-3 plain sentences on what concrete actions this document could trigger — new legislation, international negotiations, court cases, policy changes, or compliance obligations.",
  "what_to_review": "1-2 plain sentences listing specific related laws, treaties, or provisions to read alongside this.",
  "who_it_affects": "1-2 plain sentences on the key stakeholders and how they are impacted.",
  "enforcement": "1-2 plain sentences on how this is implemented and what happens if it is not.",
  "gaps_vs_standards": "1-2 plain sentences on what is missing compared to relevant international standards.",
  "political_implications": "1-2 plain sentences on the political context and likely reactions."
}}

Rules:
- Plain language only, no jargon, no em dashes, no buzzwords
- what_it_overlooks must have 3-5 items each tied to a real provision
- downstream_effects must name concrete actions, not vague possibilities
- Write like a colleague briefing another colleague before a meeting
- Return ONLY valid JSON, no markdown

DOCUMENT:
{text}"""


def analyze(text: str, doc_type: str, api_key: str = None) -> dict:
    """
    Send document text to Claude and return structured risk assessment.

    Args:
        text:     Extracted document text (will be truncated to 9000 chars)
        doc_type: 'Legislation' or 'Treaty'
        api_key:  Anthropic API key (falls back to ANTHROPIC_API_KEY env var)

    Returns:
        dict with keys: summary, risks (list of risk objects)
    """
    key = api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise ValueError(
            "No API key found. Set ANTHROPIC_API_KEY environment variable "
            "or pass api_key argument."
        )

    client = anthropic.Anthropic(api_key=key)

    prompt = PROMPT_TEMPLATE.format(
        doc_type=doc_type,
        text=text[:9000]
    )

    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=2000,
        temperature=0,
        messages=[{"role": "user", "content": prompt}]
    )

    raw = "".join(
        block.text for block in message.content if hasattr(block, "text")
    )

    # Strip markdown fences if present
    clean = raw.replace("```json", "").replace("```", "").strip()

    # Extract JSON object
    start = clean.find("{")
    end = clean.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError("No valid JSON found in Claude response.")

    result = json.loads(clean[start:end])

    # Validate structure
    if "what_changes" not in result or "what_it_overlooks" not in result:
        raise ValueError("Response missing required fields.")

    return result
