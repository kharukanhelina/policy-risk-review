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

PROMPT_TEMPLATE = """You are a policy and legal analyst. Analyze this {doc_type} and identify exactly 5 blind spots or weaknesses — things the document gets wrong, overlooks, or creates unintentionally.

Return ONLY this JSON, nothing else:
{{
  "summary": "3 sentences on what this document does and its scope.",
  "risks": [
    {{
      "level": "high or medium or low",
      "category": "one of: Enforcement Gap | Definitional Ambiguity | Jurisdictional Conflict | Implementation Gap | Human Rights Exposure | Review Gap",
      "reference": "specific article or section from the document",
      "description": "3 plain sentences. What is wrong. What happens because of it. What the document fails to achieve as a result."
    }}
  ]
}}

Rules:
- Identify at least 4 risks ordered from highest to lowest severity
- Every risk must be grounded in a specific provision
- Focus only on what the document fails to do, overlooks, or creates as an unintended consequence
- Use only the 6 categories listed above
- Category-specific rules:
  * Human Rights Exposure: cite the relevant instrument in brackets e.g. (ICCPR Art. 7), no elaboration
  * Jurisdictional Conflict: give a concrete example between legal systems or bodies, no specific countries
  * Enforcement Gap: third sentence states the real consequence in practice, not a future prediction
  * Implementation Gap: third sentence states the real consequence in practice, not a future prediction
  * Never name specific countries
- Risk level hierarchy — never downgrade, only escalate if severe:
  * Human Rights Exposure → high
  * Jurisdictional Conflict → high
  * Enforcement Gap → medium
  * Implementation Gap → medium
  * Definitional Ambiguity → low
  * Review Gap → low

Return ONLY valid JSON. No markdown, no explanation.

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
    if "summary" not in result or "risks" not in result:
        raise ValueError("Response missing required fields: summary, risks")

    return result
