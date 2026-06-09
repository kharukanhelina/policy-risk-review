# PolicyDesk

A briefing tool for policy and legal professionals who need to understand what a piece of legislation or treaty actually means — not just what it says.

PolicyDesk surfaces the things that matter when reading a new document: what changes, what it overlooks, who it affects, what it could trigger, and what else you should be reading. No legal definitions, no academic framing — just the broad implications and blind spots a professional needs to act.

Built by [Anhelina Kharuk](https://www.linkedin.com/in/anhelinakharuk) — international policy and human rights professional, SAIS MAIR, currently working on AI model evaluation at Mercor Intelligence.

---

## What it produces

For any legislation or treaty, PolicyDesk returns a structured briefing note covering:

- **What changes** — what is new or different from existing frameworks
- **What it overlooks** — blind spots tied to specific provisions
- **Downstream effects** — concrete actions this could trigger: legislation, negotiations, court cases, compliance obligations
- **Who it affects** — key stakeholders and how
- **Enforcement mechanism** — how it is implemented and what happens if it is not
- **Gaps vs international standards** — what is missing
- **Political implications** — context and likely reactions
- **What to review** — related laws, treaties, and provisions to read alongside it

---

## Project Structure

```
policydesk/
├── pipeline/
│   ├── __init__.py
│   ├── extract.py      — extracts text from PDF and TXT files
│   ├── analyze.py      — calls Claude API, returns structured briefing JSON
│   └── cli.py          — command-line interface
├── api/
│   └── analyze.js      — Vercel serverless function (API proxy)
├── data/
│   ├── raw/            — place source documents here
│   └── processed/      — briefing outputs saved as JSON
├── styles/
│   └── main.css
├── scripts/
│   └── app.js
├── index.html
├── requirements.txt
└── .gitignore
```

---

## Setup

**1. Clone the repo**
```bash
git clone https://github.com/kharukanhelina/policydesk
cd policydesk
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
export ANTHROPIC_API_KEY=your_key_here
```

---

## Run the Pipeline

**Analyze a document:**
```bash
python -m pipeline.cli analyze --file data/raw/document.pdf --type legislation
python -m pipeline.cli analyze --file data/raw/treaty.pdf --type treaty --name "UN Convention on X"
```

**List all analyses:**
```bash
python -m pipeline.cli list
```

Results are saved as JSON in `data/processed/`.

---

## Frontend

Open `index.html` in your browser or visit the live deployment.

Features: upload PDF or paste text, compare two documents side by side, export briefing as PDF.

---

## Built with

- [Claude API](https://anthropic.com) — AI analysis (claude-sonnet-4-5)
- [pypdf](https://pypdf.readthedocs.io) — PDF text extraction
- [PDF.js](https://mozilla.github.io/pdf.js/) — frontend PDF handling
- [jsPDF](https://github.com/parallax/jsPDF) — PDF export
- Python 3.9+ · Vanilla HTML/CSS/JS · Vercel

---

## License

MIT
