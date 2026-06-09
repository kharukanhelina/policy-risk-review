pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── State ──
let selectedType   = 'Legislation';
let selectedTypeA  = 'Legislation';
let selectedTypeB  = 'Legislation';
let extractedText  = '';
let extractedTextA = '';
let extractedTextB = '';
let lastResult     = null;
let lastResultA    = null;
let lastResultB    = null;

// ── Mode Toggle ──
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const mode = btn.dataset.mode;
    document.getElementById('singleMode').classList.toggle('active', mode === 'single');
    document.getElementById('compareMode').classList.toggle('active', mode === 'compare');
  });
});

// ── Doc Type: Single ──
document.querySelectorAll('#singleMode .doc-type').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#singleMode .doc-type').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedType = btn.dataset.type;
  });
});

// ── Doc Type: Compare ──
document.querySelectorAll('#compareMode .doc-type').forEach(btn => {
  btn.addEventListener('click', () => {
    const side = btn.dataset.side;
    document.querySelectorAll('#compareMode .doc-type[data-side="' + side + '"]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (side === 'A') selectedTypeA = btn.dataset.type;
    else selectedTypeB = btn.dataset.type;
  });
});

// ── Textarea ──
const docInput = document.getElementById('docInput');
const charCount = document.getElementById('charCount');
docInput.addEventListener('input', () => {
  charCount.textContent = docInput.value.length.toLocaleString();
  checkReady();
});

function checkReady() {
  document.getElementById('analyzeBtn').disabled =
    !(docInput.value.trim().length > 50 || extractedText.length > 50);
}

document.getElementById('docInputA').addEventListener('input', checkCompareReady);
document.getElementById('docInputB').addEventListener('input', checkCompareReady);

function checkCompareReady() {
  const aOk = document.getElementById('docInputA').value.trim().length > 50 || extractedTextA.length > 50;
  const bOk = document.getElementById('docInputB').value.trim().length > 50 || extractedTextB.length > 50;
  document.getElementById('compareBtn').disabled = !(aOk && bOk);
}

// ── PDF Extraction ──
async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 40); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(x => x.str).join(' ') + '\n';
  }
  return { text: text.trim(), pages: pdf.numPages };
}

async function handleUpload(file, target) {
  const fnEl   = target === 'single' ? document.getElementById('fileName') : document.getElementById('fileName' + target);
  const zoneEl = target === 'single' ? document.getElementById('uploadZone') : document.getElementById('uploadZone' + target);
  fnEl.textContent = 'Reading ' + file.name + '...';
  fnEl.style.display = 'block';
  zoneEl.classList.add('has-file');
  try {
    const { text, pages } = await extractPdfText(file);
    if (target === 'single') {
      extractedText = text;
      charCount.textContent = text.length.toLocaleString();
      const n = document.getElementById('docName');
      if (!n.value) n.value = file.name.replace('.pdf', '');
      checkReady();
    } else if (target === 'A') {
      extractedTextA = text;
      const n = document.getElementById('docNameA');
      if (!n.value) n.value = file.name.replace('.pdf', '');
      checkCompareReady();
    } else {
      extractedTextB = text;
      const n = document.getElementById('docNameB');
      if (!n.value) n.value = file.name.replace('.pdf', '');
      checkCompareReady();
    }
    fnEl.textContent = file.name + ' — ' + pages + ' pages';
  } catch (e) {
    fnEl.textContent = 'Failed to read PDF. Try pasting text.';
    zoneEl.classList.remove('has-file');
  }
}

// Single upload
document.getElementById('pdfInput').addEventListener('change', async e => {
  if (e.target.files[0]) await handleUpload(e.target.files[0], 'single');
});
const uz = document.getElementById('uploadZone');
uz.addEventListener('dragover', e => { e.preventDefault(); uz.classList.add('dragover'); });
uz.addEventListener('dragleave', () => uz.classList.remove('dragover'));
uz.addEventListener('drop', async e => {
  e.preventDefault(); uz.classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (f && f.type === 'application/pdf') await handleUpload(f, 'single');
});

// Compare uploads
document.querySelectorAll('.compare-pdf-input').forEach(input => {
  input.addEventListener('change', async e => {
    if (e.target.files[0]) await handleUpload(e.target.files[0], input.dataset.side);
  });
});
['A','B'].forEach(side => {
  const z = document.getElementById('uploadZone' + side);
  z.addEventListener('dragover', e => { e.preventDefault(); z.classList.add('dragover'); });
  z.addEventListener('dragleave', () => z.classList.remove('dragover'));
  z.addEventListener('drop', async e => {
    e.preventDefault(); z.classList.remove('dragover');
    const f = e.dataTransfer.files[0];
    if (f && f.type === 'application/pdf') await handleUpload(f, side);
  });
});

// ── API Call ──
async function analyzeDoc(text, docType) {
  const prompt = buildPrompt(text, docType);
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  const raw = data.content.map(i => i.text || '').join('');
  const clean = raw.replace(/```json|```/g, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not parse response from Claude.');
  return JSON.parse(match[0]);
}

async function generateInsights(rA, rB, nameA, nameB) {
  const prompt = `Compare these two documents as a policy analyst.
Document A (${nameA}): ${JSON.stringify({ what_changes: rA.what_changes, what_it_overlooks: rA.what_it_overlooks })}
Document B (${nameB}): ${JSON.stringify({ what_changes: rB.what_changes, what_it_overlooks: rB.what_it_overlooks })}
Write 3 plain sentences comparing their scope, blind spots, and which raises more concern. No jargon. No em dashes. Return only the text.`;

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await response.json();
  return data.content.map(i => i.text || '').join('').trim();
}

// ── Prompt ──
function buildPrompt(text, docType) {
  return `You are a policy analyst writing a briefing note for a senior professional who needs to act fast.

Analyze this ${docType} and return exactly this JSON with no extra text:

{
  "what_changes": "1-2 plain sentences on what is new or different from existing frameworks.",
  "what_it_overlooks": [
    {
      "category": "Enforcement Gap | Definitional Ambiguity | Jurisdictional Conflict | Implementation Gap | Human Rights Exposure | Review Gap",
      "reference": "specific article or section e.g. Article 4(2)",
      "gap": "1-2 plain sentences on what this provision misses or gets wrong and why it matters."
    }
  ],
  "downstream_effects": "2-3 plain sentences on concrete actions this could trigger: new legislation, negotiations, court cases, compliance obligations.",
  "what_to_review": "1-2 sentences listing specific related laws, treaties, or provisions to read alongside this.",
  "who_it_affects": "1-2 sentences on the key stakeholders and how they are impacted.",
  "enforcement": "1-2 sentences on how this is implemented and what happens if it is not.",
  "gaps_vs_standards": "1-2 sentences on what is missing compared to relevant international standards.",
  "political_implications": "1-2 sentences on the political context and likely reactions."
}

Rules:
- Plain language only, no jargon, no em dashes, no buzzwords
- what_it_overlooks must have 3-5 items each tied to a real provision from this document
- downstream_effects must name concrete actions, not vague possibilities
- Return ONLY valid JSON, no markdown, no explanation

DOCUMENT:
${text.substring(0, 9000)}`;
}

// ── Render ──
function renderBriefing(container, data) {
  container.innerHTML = '';
  const sections = [
    { key: 'what_changes', label: 'What Changes' },
    { key: 'who_it_affects', label: 'Who It Affects' },
    { key: 'enforcement', label: 'Enforcement Mechanism' },
    { key: 'downstream_effects', label: 'Downstream Effects' },
    { key: 'gaps_vs_standards', label: 'Gaps vs International Standards' },
    { key: 'political_implications', label: 'Political Implications' },
    { key: 'what_to_review', label: 'What to Review' },
  ];
  sections.forEach(({ key, label }) => {
    if (!data[key]) return;
    const block = document.createElement('div');
    block.className = 'briefing-block';
    block.innerHTML = '<div class="briefing-label">' + label + '</div><div class="briefing-text">' + data[key] + '</div>';
    container.appendChild(block);
  });
}

function renderOverlooks(container, items) {
  container.innerHTML = '';
  if (!items || !items.length) return;
  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'risk-item';
    el.innerHTML = `
      <div class="risk-header">
        <div class="risk-category">${item.category}</div>
        <div class="risk-reference">${item.reference}</div>
      </div>
      <div class="risk-text">${item.gap}</div>
    `;
    container.appendChild(el);
  });
}

// ── Single Analyze ──
document.getElementById('analyzeBtn').addEventListener('click', async () => {
  const text = extractedText || docInput.value.trim();
  if (!text) return;
  const docName = document.getElementById('docName').value.trim() || selectedType;

  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('resultsPanel').classList.remove('visible');
  document.getElementById('errorMsg').classList.remove('visible');
  document.getElementById('loadingState').classList.add('visible');
  document.getElementById('analyzeBtn').disabled = true;

  try {
    const result = await analyzeDoc(text, selectedType);
    lastResult = { ...result, docName, type: selectedType, date: new Date() };

    document.getElementById('resultsMeta').textContent =
      docName + ' · ' + formatDate(lastResult.date);

    renderBriefing(document.getElementById('briefingContent'), result);
    renderOverlooks(document.getElementById('riskList'), result.what_it_overlooks);

    document.getElementById('resultsPanel').classList.add('visible');
  } catch (err) {
    document.getElementById('errorMsg').textContent = 'Analysis failed: ' + err.message;
    document.getElementById('errorMsg').classList.add('visible');
    document.getElementById('emptyState').style.display = 'flex';
  } finally {
    document.getElementById('loadingState').classList.remove('visible');
    document.getElementById('analyzeBtn').disabled = false;
  }
});

// ── Compare Analyze ──
document.getElementById('compareBtn').addEventListener('click', async () => {
  const textA = extractedTextA || document.getElementById('docInputA').value.trim();
  const textB = extractedTextB || document.getElementById('docInputB').value.trim();
  if (!textA || !textB) return;
  const nameA = document.getElementById('docNameA').value.trim() || 'Document A';
  const nameB = document.getElementById('docNameB').value.trim() || 'Document B';

  document.getElementById('compareResults').style.display = 'none';
  document.getElementById('compareErrorMsg').classList.remove('visible');
  document.getElementById('compareLoadingState').style.display = 'flex';
  document.getElementById('compareBtn').disabled = true;

  try {
    const [rA, rB] = await Promise.all([
      analyzeDoc(textA, selectedTypeA),
      analyzeDoc(textB, selectedTypeB)
    ]);
    const insights = await generateInsights(rA, rB, nameA, nameB);

    lastResultA = { ...rA, docName: nameA, type: selectedTypeA };
    lastResultB = { ...rB, docName: nameB, type: selectedTypeB };

    document.getElementById('compareResultsMeta').textContent = nameA + ' vs ' + nameB + ' · ' + formatDate(new Date());
    document.getElementById('colHeaderA').textContent = nameA;
    document.getElementById('colHeaderB').textContent = nameB;

    renderBriefing(document.getElementById('briefingA'), rA);
    renderOverlooks(document.getElementById('riskListA'), rA.what_it_overlooks);
    renderBriefing(document.getElementById('briefingB'), rB);
    renderOverlooks(document.getElementById('riskListB'), rB.what_it_overlooks);
    document.getElementById('insightsText').textContent = insights;

    document.getElementById('compareResults').style.display = 'flex';
    document.getElementById('compareResults').style.flexDirection = 'column';
    document.getElementById('compareResults').style.gap = '24px';
  } catch (err) {
    document.getElementById('compareErrorMsg').textContent = 'Analysis failed: ' + err.message;
    document.getElementById('compareErrorMsg').classList.add('visible');
  } finally {
    document.getElementById('compareLoadingState').style.display = 'none';
    document.getElementById('compareBtn').disabled = false;
  }
});

// ── Reset ──
document.getElementById('resetBtn').addEventListener('click', () => {
  docInput.value = '';
  extractedText = '';
  lastResult = null;
  charCount.textContent = '0';
  document.getElementById('analyzeBtn').disabled = true;
  document.getElementById('fileName').style.display = 'none';
  document.getElementById('uploadZone').classList.remove('has-file');
  document.getElementById('pdfInput').value = '';
  document.getElementById('docName').value = '';
  document.getElementById('emptyState').style.display = 'flex';
  document.getElementById('resultsPanel').classList.remove('visible');
  document.getElementById('loadingState').classList.remove('visible');
  document.getElementById('errorMsg').classList.remove('visible');
});

document.getElementById('compareResetBtn').addEventListener('click', () => {
  ['A','B'].forEach(side => {
    document.getElementById('docInput' + side).value = '';
    document.getElementById('docName' + side).value = '';
    document.getElementById('fileName' + side).style.display = 'none';
    document.getElementById('uploadZone' + side).classList.remove('has-file');
  });
  extractedTextA = '';
  extractedTextB = '';
  lastResultA = null;
  lastResultB = null;
  document.getElementById('compareResults').style.display = 'none';
  document.getElementById('compareBtn').disabled = true;
});

// ── PDF Export ──
document.getElementById('exportBtn').addEventListener('click', () => {
  if (lastResult) exportPDF(lastResult);
});
document.getElementById('compareExportBtn').addEventListener('click', () => {
  if (lastResultA && lastResultB) exportPDF(lastResultA, lastResultB);
});

function exportPDF(dataA, dataB) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, margin = 20, col = W - margin * 2;
  let y = margin;

  function newPage() { doc.addPage(); y = margin; }
  function check(n) { if (y + n > 278) newPage(); }

  // Background
  doc.setFillColor(10,10,20);
  doc.rect(0,0,W,297,'F');

  // Header
  doc.setFillColor(17,17,31);
  doc.rect(0,0,W,22,'F');
  doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
  doc.text('Policy Desk', margin, 14);
  doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(152,152,192);
  doc.text('by Anhelina Kharuk', W-margin, 14, { align: 'right' });

  y = 32;

  const datasets = dataB ? [dataA, dataB] : [dataA];

  datasets.forEach((data, idx) => {
    if (idx > 0) { check(10); doc.setDrawColor(30,30,53); doc.line(margin,y,W-margin,y); y+=10; }

    if (dataB) {
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(98,114,245);
      doc.text(data.docName.toUpperCase(), margin, y); y+=8;
    }

    const sections = [
      { key: 'what_changes', label: 'WHAT CHANGES' },
      { key: 'who_it_affects', label: 'WHO IT AFFECTS' },
      { key: 'enforcement', label: 'ENFORCEMENT' },
      { key: 'downstream_effects', label: 'DOWNSTREAM EFFECTS' },
      { key: 'gaps_vs_standards', label: 'GAPS VS STANDARDS' },
      { key: 'political_implications', label: 'POLITICAL IMPLICATIONS' },
      { key: 'what_to_review', label: 'WHAT TO REVIEW' },
    ];

    sections.forEach(({ key, label }) => {
      if (!data[key]) return;
      check(20);
      doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(98,114,245);
      doc.text(label, margin, y); y+=5;
      doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(220,220,240);
      const lines = doc.splitTextToSize(data[key], col);
      lines.forEach(line => { check(6); doc.text(line, margin, y); y+=5; });
      y+=3;
    });

    if (data.what_it_overlooks && data.what_it_overlooks.length) {
      check(10);
      doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(98,114,245);
      doc.text('WHAT IT OVERLOOKS', margin, y); y+=6;
      data.what_it_overlooks.forEach(item => {
        check(20);
        doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(200,200,232);
        doc.text(item.category.toUpperCase(), margin+2, y);
        doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(98,114,245);
        doc.text(item.reference, W-margin, y, { align: 'right' });
        y+=5;
        doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(230,230,245);
        const lines = doc.splitTextToSize(item.gap, col-4);
        lines.forEach(line => { check(6); doc.text(line, margin+2, y); y+=5; });
        y+=3;
      });
    }
  });

  doc.setFontSize(7); doc.setTextColor(60,60,90);
  doc.text('Policy Desk · github.com/kharukanhelina/policy-desk · linkedin.com/in/anhelinakharuk', W/2, 290, { align:'center' });

  const name = (dataA.docName || 'report').replace(/[^a-z0-9]/gi,'_').toLowerCase();
  doc.save('policy-desk_' + name + '_' + Date.now() + '.pdf');
}

// ── Helpers ──
function formatDate(date) {
  return date.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}