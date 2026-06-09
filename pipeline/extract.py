"""
extract.py
Extracts text from PDF or plain text files.
"""

import pathlib


def from_pdf(path: str) -> str:
    """Extract text from a PDF file using pypdf."""
    try:
        import pypdf
    except ImportError:
        raise ImportError("pypdf not installed. Run: pip install pypdf")

    reader = pypdf.PdfReader(path)
    pages = []
    for page in reader.pages[:40]:  # cap at 40 pages
        text = page.extract_text()
        if text:
            pages.append(text.strip())
    return "\n".join(pages)


def from_txt(path: str) -> str:
    """Read plain text file."""
    return pathlib.Path(path).read_text(encoding="utf-8")


def extract(path: str) -> str:
    """
    Auto-detect file type and extract text.
    Supports: .pdf, .txt
    """
    p = pathlib.Path(path)
    if not p.exists():
        raise FileNotFoundError(f"File not found: {path}")

    suffix = p.suffix.lower()
    if suffix == ".pdf":
        return from_pdf(path)
    elif suffix in (".txt", ".md"):
        return from_txt(path)
    else:
        raise ValueError(f"Unsupported file type: {suffix}. Use .pdf or .txt")
