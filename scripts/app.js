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
let currentMode    = 'single';

// ── Mode Toggle ──
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    document.getElementById('singleMode').classList.toggle('active', currentMode === 'single');
    document.getElementById('compareMode').classList.toggle('active', currentMode === 'compare');
  });
});

// ── Single Mode: Doc Type ──
document.querySelectorAll('#singleMode .doc-type').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#singleMode .doc-type').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedType = btn.dataset.type;
  });
});

// ── Compare Mode: Doc Type ──
document.querySelectorAll('#compareMode .doc-type').forEach(btn => {
  btn.addEventListener('click', () => {
    const side = btn.dataset.side;
    document.querySelectorAll(`#compareMode .doc-type[data-side="${side}"]`).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (side === 'A') selectedTypeA = btn.dataset.type;
    else selectedTypeB = btn.dataset.type;
  });
});

// ── Single: Textarea ──
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

// ── Compare: Textarea ──
document.getElementById('docInputA').addEventListener('input', checkCompareReady);
document.getElementById('docInputB').addEventListener('input', checkCompareReady);

function checkCompareReady() {
  const aReady = document.getElementById('docInputA').value.trim().length > 50 || extractedTextA.length > 50;
  const bReady = document.getElementById('docInputB').value.trim().length > 50 || extractedTextB.length > 50;
  document.getElementById('compareBtn').disabled = !(aReady && bReady);
}

// ── PDF Processing ──
async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 40); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map(i => i.str).join(' ') + '\n';
  }
  return { text: fullText.trim(), pages: pdf.numPages };
}

// Single upload
const pdfInput   = document.getElementById('pdfInput');
const uploadZone = document.getElementById('uploadZone');
const fileName   = document.getElementById('fileName');

pdfInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) await handleUpload(file, 'single');
});

uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file?.type === 'application/pdf') await handleUpload(file, 'single');
});

// Compare uploads
document.querySelectorAll('.compare-pdf-input').forEach(input => {
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const side = input.dataset.side;
    if (file) await handleUpload(file, side);
  });
});

['A', 'B'].forEach(side => {
  const zone = document.getElementById(`uploadZone${side}`);
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') await handleUpload(file, side);
  });
});

async function handleUpload(file, target) {
  const fnEl   = target === 'single' ? fileName : document.getElementById(`fileName${target}`);
  const zoneEl = target === 'single' ? uploadZone : document.getElementById(`uploadZone${target}`);

  fnEl.textContent = 'Reading ' + file.name + '...';
  fnEl.style.display = 'block';
  zoneEl.classList.add('has-file');

  try {
    const { text, pages } = await extractPdfText(file);
    if (target === 'single') {
      extractedText = text;
      charCount.textContent = text.length.toLocaleString();
      // auto-fill doc name
      const nameInput = document.getElementById('docName');
      if (!nameInput.value) nameInput.value = file.name.replace('.pdf', '');
      checkReady();
    } else if (target === 'A') {
      extractedTextA = text;
      const nameInput = document.getElementById('docNameA');
      if (!nameInput.value) nameInput.value = file.name.replace('.pdf', '');
      checkCompareReady();
    } else {
      extractedTextB = text;
      const nameInput = document.getElementById('docNameB');
      if (!nameInput.value) nameInput.value = file.name.replace('.pdf', '');
      checkCompareReady();
    }
    fnEl.textContent = file.name + ' — ' + pages + ' pages';
  } catch (err) {
    fnEl.textContent = 'Failed to read PDF. Try pasting text.';
    zoneEl.classList.remove('has-file');
  }
}

// ── Single: Analyze ──
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
    renderSingleResults(lastResult);
  } catch (err) {
    showError('errorMsg', err.message);
  } finally {
    document.getElementById('loadingState').classList.remove('visible');
    document.getElementById('analyzeBtn').disabled = false;
  }
});

function renderSingleResults(data) {
  const meta = document.getElementById('resultsMeta');
  meta.textContent = `${data.docName} · ${data.type} · ${formatDate(data.date)}`;

  // Clear previous results
  const summary = document.getElementById('summaryText');
  const riskListEl = document.getElementById('riskList');
  summary.innerHTML = '';
  riskListEl.innerHTML = '';

  // Briefing sections
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
    block.innerHTML = `
      <div class="briefing-label">${label}</div>
      <div class="briefing-text">${data[key]}</div>
    `;
    summary.appendChild(block);
  });

  // What it overlooks — structured list
  if (data.what_it_overlooks && data.what_it_overlooks.length) {
    data.what_it_overlooks.forEach(item => {
      const el = document.createElement('div');
      el.className = 'risk-item medium';
      el.innerHTML = `
        <div class="risk-header">
          <div class="risk-category">${item.category}</div>
          <div class="risk-reference">${item.reference}</div>
        </div>
        <div class="risk-text">${item.gap}</div>
      `;
      riskListEl.appendChild(el);
    });
  }

  document.getElementById('resultsPanel').classList.add('visible');
}

// ── Compare: Analyze ──
document.getElementById('compareBtn').addEventListener('click', async () => {
  const textA = extractedTextA || document.getElementById('docInputA').value.trim();
  const textB = extractedTextB || document.getElementById('docInputB').value.trim();
  if (!textA || !textB) return;

  const nameA = document.getElementById('docNameA').value.trim() || 'Document A';
  const nameB = document.getElementById('docNameB').value.trim() || 'Document B';

  document.getElementById('compareResults').style.display = 'none';
  document.getElementById('compareErrorMsg').classList.remove('visible');
  document.getElementById('compareLoadingState').classList.add('visible');
  document.getElementById('compareBtn').disabled = true;

  try {
    const [resultA, resultB] = await Promise.all([
      analyzeDoc(textA, selectedTypeA),
      analyzeDoc(textB, selectedTypeB)
    ]);

    const insights = await generateInsights(resultA, resultB, nameA, nameB);

    lastResultA = { ...resultA, docName: nameA, type: selectedTypeA };
    lastResultB = { ...resultB, docName: nameB, type: selectedTypeB };

    renderCompareResults(lastResultA, lastResultB, insights);
  } catch (err) {
    showError('compareErrorMsg', err.message);
  } finally {
    document.getElementById('compareLoadingState').classList.remove('visible');
    document.getElementById('compareBtn').disabled = false;
  }
});

function renderCompareResults(dataA, dataB, insights) {
  const date = formatDate(new Date());
  document.getElementById('compareResultsMeta').textContent = `${dataA.docName} vs ${dataB.docName} · ${date}`;
  document.getElementById('colHeaderA').textContent = dataA.docName;
  document.getElementById('colHeaderB').textContent = dataB.docName;

  document.getElementById('summaryA').textContent = dataA.summary;
  document.getElementById('summaryB').textContent = dataB.summary;
  renderRiskList(document.getElementById('riskListA'), dataA.risks);
  renderRiskList(document.getElementById('riskListB'), dataB.risks);
  document.getElementById('insightsText').textContent = insights;

  document.getElementById('compareResults').style.display = 'flex';
  document.getElementById('compareResults').style.flexDirection = 'column';
  document.getElementById('compareResults').style.gap = '24px';
}

// ── API Calls ──
async function analyzeDoc(text, docType) {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: buildPrompt(text, docType) }]
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'API error');

  const raw = data.content.map(i => i.text || '').join('');
  const clean = raw.replace(/```json|```/g, '').trim();
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse response.');

  return JSON.parse(jsonMatch[0]);
}

async function generateInsights(resultA, resultB, nameA, nameB) {
  const prompt = `You are a policy analyst comparing two documents.

Document A (${nameA}) risks: ${JSON.stringify(resultA.risks.map(r => ({ level: r.level, category: r.category })))}
Document B (${nameB}) risks: ${JSON.stringify(resultB.risks.map(r => ({ level: r.level, category: r.category })))}

Write 3-4 sentences comparing the two documents' risk profiles. Focus on: which has higher overall risk, which categories overlap, and what each document handles better or worse. Plain language, no jargon, no em dashes. Return only the text, no JSON.`;

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  return data.content.map(i => i.text || '').join('').trim();
}

// ── Prompt Builder ──
function buildPrompt(text, docType) {
  return `You are an expert policy and legal analyst specializing in international relations, human rights law, and public policy.

Your task is to identify blind spots, weaknesses, and unintended consequences in the following ${docType} — NOT to summarize what it intends to do, but to find what it gets wrong, misses, or creates unintentionally.

Return a JSON object with exactly this structure:
{
  "summary": "3-4 sentences on what this document sets out to do and its overall scope.",
  "risks": [
    {
      "level": "high" | "medium" | "low",
      "category": "Must be one of: Enforcement Gap | Definitional Ambiguity | Jurisdictional Conflict | Implementation Gap | Human Rights Exposure | Sunset/Review Gap",
      "reference": "Exact citation e.g. Article 4(2), Section 12, Paragraph 7 — must exist in the document",
      "description": "3 sentences with a clear logical spine. S1: state plainly what the provision does wrong or overlooks. S2: state the direct consequence in practice. S3: explain what the provision therefore fails to achieve. Simple direct language. No jargon. No em dashes. Supporting references in brackets e.g. (ICCPR Art. 26)."
    }
  ]
}

Rules:
- Identify 4-7 risks ordered from highest to lowest severity
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
  * Sunset/Review Gap → low

Return ONLY valid JSON. No markdown, no explanation.

DOCUMENT:
${text.substring(0, 9000)}`;
}

// ── Render Helpers ──
function renderRiskList(container, risks) {
  container.innerHTML = '';
  risks.forEach(risk => {
    const item = document.createElement('div');
    item.className = `risk-item ${risk.level}`;
    item.innerHTML = `
      <div class="risk-header">
        <div class="risk-score">${risk.level}</div>
        <div class="risk-category">${risk.category}</div>
        <div class="risk-reference">${risk.reference}</div>
      </div>
      <div class="risk-text">${risk.description}</div>
    `;
    container.appendChild(item);
  });
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = 'Analysis failed: ' + (msg || 'Unknown error.');
  el.classList.add('visible');
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── PDF Export ──
document.getElementById('exportBtn').addEventListener('click', () => {
  if (lastResult) exportToPDF([lastResult]);
});

document.getElementById('compareExportBtn').addEventListener('click', () => {
  if (lastResultA && lastResultB) exportToPDF([lastResultA, lastResultB], true);
});

function exportToPDF(results, isComparison = false) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const W = 210;
  const margin = 20;
  const colW = W - margin * 2;
  let y = margin;

  const levelColors = { high: [245, 91, 91], medium: [245, 166, 35], low: [76, 175, 125] };

  function checkPage(needed = 10) {
    if (y + needed > 280) { doc.addPage(); y = margin; }
  }

  function addText(text, x, size, style, color, maxW) {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    doc.setTextColor(...(color || [255, 255, 255]));
    const lines = doc.splitTextToSize(String(text), maxW || colW);
    doc.text(lines, x, y);
    y += lines.length * (size * 0.4) + 2;
    return lines.length;
  }

  // Dark background
  doc.setFillColor(10, 10, 20);
  doc.rect(0, 0, W, 297, 'F');

  // Header bar
  doc.setFillColor(17, 17, 31);
  doc.rect(0, 0, W, 22, 'F');

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Policy Risk Review', margin, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(152, 152, 192);
  doc.text('by Anhelina Kharuk', W - margin, 14, { align: 'right' });

  y = 32;

  // Report title
  const title = isComparison
    ? `Comparative Risk Report: ${results[0].docName} vs ${results[1].docName}`
    : `Risk Assessment Report: ${results[0].docName}`;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(98, 114, 245);
  const titleLines = doc.splitTextToSize(title, colW);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 5 + 3;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(152, 152, 192);
  doc.text(`Generated: ${formatDate(new Date())}  ·  Tool: Policy Risk Review`, margin, y);
  y += 10;

  // Divider
  doc.setDrawColor(30, 30, 53);
  doc.line(margin, y, W - margin, y);
  y += 8;

  // Render each result
  results.forEach((result, idx) => {
    if (idx > 0) {
      checkPage(20);
      doc.setDrawColor(30, 30, 53);
      doc.line(margin, y, W - margin, y);
      y += 10;
    }

    if (isComparison) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(98, 114, 245);
      doc.text(result.docName.toUpperCase(), margin, y);
      y += 8;
    }

    // Summary
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(98, 114, 245);
    doc.text('SUMMARY', margin, y);
    y += 5;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(220, 220, 240);
    const summaryLines = doc.splitTextToSize(result.summary, colW);
    summaryLines.forEach(line => {
      checkPage(6);
      doc.text(line, margin, y);
      y += 5;
    });
    y += 6;

    // Risk Assessment
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(98, 114, 245);
    doc.text('RISK ASSESSMENT', margin, y);
    y += 6;

    result.risks.forEach(risk => {
      checkPage(30);

      // Risk card bg
      doc.setFillColor(17, 17, 31);
      const cardStartY = y;

      // Level badge
      const col = levelColors[risk.level] || [150, 150, 150];
      doc.setFillColor(...col.map(c => Math.round(c * 0.15)));
      doc.rect(margin, y, 18, 5, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...col);
      doc.text(risk.level.toUpperCase(), margin + 9, y + 3.5, { align: 'center' });

      // Category
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(200, 200, 232);
      doc.text(risk.category.toUpperCase(), margin + 22, y + 3.5);

      // Reference
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(98, 114, 245);
      doc.text(risk.reference, W - margin, y + 3.5, { align: 'right' });

      y += 8;

      // Description
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(230, 230, 245);
      const descLines = doc.splitTextToSize(risk.description, colW - 4);
      descLines.forEach(line => {
        checkPage(6);
        doc.text(line, margin + 2, y);
        y += 5;
      });

      // Left border line for risk level
      doc.setDrawColor(...col);
      doc.setLineWidth(0.5);
      doc.line(margin, cardStartY, margin, y);
      doc.setLineWidth(0.2);

      y += 4;
    });
  });

  // Footer
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 90);
  doc.text('Policy Risk Review · github.com/kharukanhelina · linkedin.com/in/anhelinakharuk', W / 2, 290, { align: 'center' });

  const safeName = (results[0].docName || 'report').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`policy-risk-review_${safeName}_${Date.now()}.pdf`);
}

// ── Reset ──
document.getElementById('resetBtn').addEventListener('click', () => {
  docInput.value = '';
  extractedText = '';
  lastResult = null;
  charCount.textContent = '0';
  document.getElementById('analyzeBtn').disabled = true;
  fileName.style.display = 'none';
  uploadZone.classList.remove('has-file');
  pdfInput.value = '';
  document.getElementById('docName').value = '';
  document.getElementById('emptyState').style.display = 'flex';
  document.getElementById('resultsPanel').classList.remove('visible');
  document.getElementById('loadingState').classList.remove('visible');
  document.getElementById('errorMsg').classList.remove('visible');
});

document.getElementById('compareResetBtn').addEventListener('click', () => {
  ['A', 'B'].forEach(side => {
    document.getElementById(`docInput${side}`).value = '';
    document.getElementById(`docName${side}`).value = '';
    document.getElementById(`fileName${side}`).style.display = 'none';
    document.getElementById(`uploadZone${side}`).classList.remove('has-file');
  });
  extractedTextA = '';
  extractedTextB = '';
  lastResultA = null;
  lastResultB = null;
  document.getElementById('compareResults').style.display = 'none';
  document.getElementById('compareBtn').disabled = true;
});
