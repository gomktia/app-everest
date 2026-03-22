import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Use local worker bundled by Vite (avoids CSP issues with external CDN)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Extracts all text from a PDF at the given URL.
 * Pages are separated by double newlines.
 */
export async function extractTextFromPDF(pdfUrl: string): Promise<string> {
  const loadingTask = pdfjsLib.getDocument(pdfUrl);
  const pdf = await loadingTask.promise;

  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim();
    pageTexts.push(pageText);
  }

  return pageTexts.join('\n\n');
}

/**
 * Extracts text from a PDF at the given URL, truncated to maxChars.
 * Appends "[... texto truncado]" when the text exceeds the limit.
 */
export async function extractTextFromPDFWithLimit(
  pdfUrl: string,
  maxChars = 50000
): Promise<string> {
  const fullText = await extractTextFromPDF(pdfUrl);

  if (fullText.length <= maxChars) {
    return fullText;
  }

  return fullText.slice(0, maxChars) + '[... texto truncado]';
}
