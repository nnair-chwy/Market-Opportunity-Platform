"use client";

import { useMemo, useState } from "react";
import {
  buildResultOutputRows,
  defaultResultOutputColumns,
  formatResultCsv,
  inferPreferredOutputFormat,
  parseRequestedOutputColumns,
  resultCsvFilename,
  type ResultOutputFormat,
} from "@/lib/planning/result-output";
import {
  downloadDecisionBrief,
  type ReviewableActionPacket,
} from "@/lib/planning/reviewable-packet";

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ResultOutputBuilder({ packet }: { packet: ReviewableActionPacket }) {
  const initialFormat = inferPreferredOutputFormat(packet.originalQuestion);
  const defaults = defaultResultOutputColumns(packet);
  const [format, setFormat] = useState<ResultOutputFormat>(initialFormat);
  const [columnText, setColumnText] = useState(defaults.join(", "));
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const rows = useMemo(() => buildResultOutputRows(packet), [packet]);
  const columns = parseRequestedOutputColumns(columnText);
  const previewRows = rows.slice(0, 3);

  async function exportResult() {
    if (!confirmed) {
      setConfirmed(true);
      setStatus(format === "csv_market_table"
        ? `Structure confirmed for ${rows.length} market row${rows.length === 1 ? "" : "s"}. Review the sample, then download.`
        : "Word report structure confirmed. Review the included sections, then download.");
      return;
    }
    if (format === "csv_market_table") {
      downloadCsv(formatResultCsv(rows, columns), resultCsvFilename(packet));
      setStatus("CSV downloaded with the confirmed columns and visible blanks for unsupported values.");
      return;
    }
    setStatus("Generating the Word report…");
    try {
      await downloadDecisionBrief(packet);
      setStatus("Word report downloaded.");
    } catch {
      setStatus("The Word report could not be generated. Please retry.");
    }
  }

  return (
    <section className="result-output-builder" aria-labelledby="result-output-title">
      <div className="result-output-heading">
        <div>
          <div className="section-label">Output structure</div>
          <h2 id="result-output-title">Choose how this result should be delivered</h2>
          <p>The structure is confirmed before the full file is generated. Unsupported values remain blank and their data gap stays visible.</p>
        </div>
        <div className="result-output-format" role="radiogroup" aria-label="Output format">
          <button type="button" role="radio" aria-checked={format === "docx_report"} onClick={() => { setFormat("docx_report"); setConfirmed(false); setStatus(null); }}>Word report</button>
          <button type="button" role="radio" aria-checked={format === "csv_market_table"} onClick={() => { setFormat("csv_market_table"); setConfirmed(false); setStatus(null); }}>CSV by market</button>
        </div>
      </div>

      {format === "csv_market_table" ? (
        <>
          <label className="result-output-columns">
            <span>Columns, in order</span>
            <input value={columnText} onChange={(event) => { setColumnText(event.target.value); setConfirmed(false); setStatus(null); }} aria-describedby="result-output-column-help" />
            <small id="result-output-column-help">Available: market ID, market name, signal, evidence detail, recommended action, confidence, evidence status, current spend, proposed adjustment percent, proposed spend, and data gap.</small>
          </label>
          <div className="result-output-preview">
            <strong>Sample · first {previewRows.length} of {rows.length} rows</strong>
            <div className="result-output-table-wrap">
              <table>
                <thead><tr>{columns.map((column) => <th key={column}>{column.replaceAll("_", " ")}</th>)}</tr></thead>
                <tbody>{previewRows.map((row, index) => <tr key={`${row.market_id}:${index}`}>{columns.map((column) => <td key={column}>{row[column] || <span className="output-missing">Blank—unsupported</span>}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="result-output-preview report-preview">
          <strong>Word report sample structure</strong>
          <ol>
            <li>Recommendation and accountable owner</li>
            <li>Evidence-supported answer and regional signals</li>
            <li>Unknowns and checks that could change the conclusion</li>
            <li>Recommended next action, sources, and review record</li>
          </ol>
          <small>Generated as a genuine .docx file with report headings, lists, page footer, and evidence boundaries.</small>
        </div>
      )}

      <div className="result-output-actions">
        {status ? <p role="status">{status}</p> : <span />}
        <button className="primary-action" type="button" disabled={format === "csv_market_table" && (!columns.length || !rows.length)} onClick={() => void exportResult()}>
          {confirmed ? `Download ${format === "csv_market_table" ? "CSV" : "Word report"}` : "Confirm output structure"}
        </button>
      </div>
    </section>
  );
}
