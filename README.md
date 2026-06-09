# Policy Risk Review

An AI-powered tool that identifies blind spots, weaknesses, and unintended consequences in legislation and treaties — built by an international policy and human rights professional.

## What it does

Most policy analysis tools summarize what a document intends to do. This tool does the opposite: it reads the document and flags what it gets wrong, overlooks, or creates unintentionally.

Each risk is tied to a specific article, section, or provision and scored across six categories:

| Category | Default Level |
|---|---|
| Human Rights Exposure | High |
| Jurisdictional Conflict | High |
| Enforcement Gap | Medium |
| Implementation Gap | Medium |
| Definitional Ambiguity | Low |
| Sunset/Review Gap | Low |

Scores can escalate based on severity but never downgrade — a methodology built on real policy and legal analysis practice.

---

## Project Structure

```
policy-risk-review/
├── pipeline/
│   ├── __init__.py
│   ├── extract.py      — extracts text from PDF and TXT files
│   ├── analyze.py      — calls Claude API, returns structured risk JSON
│   └── cli.py          — command-line interface
├── data/
│   ├── raw/            — place your source documents here
│   └── processed/      — analysis outputs saved as JSON
├── frontend/
│   ├── index.html
│   ├── styles/main.css
│   └── scripts/app.js
├── requirements.txt
├── README.md
└── .gitignore
```

---

## Setup

**1. Clone the repo**
```bash
git clone https://github.com/kharukanhelina/policy-risk-review
cd policy-risk-review
```

**2. Create a virtual environment**
```bash
python3 -m venv .venv
source .venv/bin/activate        # Mac/Linux
.venv\Scripts\activate           # Windows
```

**3. Install dependencies**
```bash
pip install -r requirements.txt
```

**4. Set your Anthropic API key**
```bash
export ANTHROPIC_API_KEY=your_key_here   # Mac/Linux
set ANTHROPIC_API_KEY=your_key_here      # Windows
```

---

## Run the Pipeline

**Analyze a document:**
```bash
python -m pipeline.cli analyze --file data/raw/your_document.pdf --type legislation
```

```bash
python -m pipeline.cli analyze --file data/raw/treaty.pdf --type treaty --name "UN Convention on X"
```

**List all processed analyses:**
```bash
python -m pipeline.cli list
```

Results are saved as JSON in `data/processed/`.

---

## Frontend

Open `index.html` in your browser to use the interactive tool directly — upload PDFs, paste text, compare two documents side by side, and export PDF reports.

No build step required.

---

## Built with

- [Claude API](https://anthropic.com) — AI analysis (claude-sonnet-4-20250514)
- [pypdf](https://pypdf.readthedocs.io) — PDF text extraction (Python pipeline)
- [PDF.js](https://mozilla.github.io/pdf.js/) — PDF extraction (frontend)
- [jsPDF](https://github.com/parallax/jsPDF) — PDF report export
- [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) — Typography
- Python 3.9+ · Vanilla HTML/CSS/JS

---

## Background

Built by [Anhelina Kharuk](https://www.linkedin.com/in/anhelinakharuk) — international policy and human rights professional, SAIS MAIR, currently working on AI model evaluation at Mercor Intelligence.

This is part of an ongoing project exploring how AI tools can support serious policy and legal work.

## License

MIT
