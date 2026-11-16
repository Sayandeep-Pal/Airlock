// Writes public/samples/sample-medical-bill.pdf: a one-page, text-based PDF with made-up data.
// Run: node scripts/make-sample-pdf.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const LINES = [
  ['F2', 15, 'NORTHGATE GENERAL HOSPITAL'],
  ['F1', 10, '18 Elm Row, Fairview, Springfield 62704'],
  ['F1', 10, ''],
  ['F2', 12, 'Statement of account and payment reminder'],
  ['F1', 10, ''],
  ['F1', 10, 'Patient: Daniel Okafor          Patient ID: NGH-PT-0045127'],
  ['F1', 10, 'Date of birth: 22/07/1979        Statement date: 2026-11-02'],
  ['F1', 10, 'Address: 74 Brookfield Lane, Apt 5C, Springfield 62711'],
  ['F1', 10, 'Phone: +1 (217) 555-0148         Email: d.okafor@example.net'],
  ['F1', 10, ''],
  ['F1', 10, 'Dear Mr. Okafor,'],
  ['F1', 10, ''],
  ['F1', 10, 'Our records show an outstanding balance of $2,340.00 for your inpatient stay'],
  ['F1', 10, 'from 9 October 2026 to 12 October 2026 (Ward 4B, attending: Dr. Mei Lin Tan).'],
  ['F1', 10, 'Your insurer, Crestview Mutual Insurance, paid $6,180.00 under policy CMI-88-4410273.'],
  ['F1', 10, 'The remaining amount was not covered because the CT scan on 10/10/2026 was coded'],
  ['F1', 10, 'as out-of-network imaging (code 74177).'],
  ['F1', 10, ''],
  ['F1', 10, 'Please pay by December 1, 2026, or call our billing team to set up an interest-free'],
  ['F1', 10, 'payment plan. If you believe the coding is wrong, you may ask your insurer to review'],
  ['F1', 10, 'the claim. Card payments: we never ask for your full card number by email.'],
  ['F1', 10, ''],
  ['F1', 10, 'Sincerely,'],
  ['F1', 10, 'Laura Brennan'],
  ['F1', 10, 'Patient Accounts, Northgate General Hospital'],
  ['F1', 10, ''],
  ['F1', 8, 'SAMPLE DOCUMENT FOR TESTING AIRLOCK. All names, numbers and addresses are made up.'],
];

const esc = (s) => s.replace(/[\\()]/g, (c) => '\\' + c);
let y = 790;
let stream = 'BT\n';
for (const [font, size, text] of LINES) {
  stream += `/${font} ${size} Tf 1 0 0 1 56 ${y} Tm (${esc(text)}) Tj\n`;
  y -= size + 8;
}
stream += 'ET\n';

const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}endstream`,
  '<< /Title (Airlock sample medical bill) /Producer (Airlock) >>',
];

let pdf = '%PDF-1.4\n';
const offsets = [];
objects.forEach((body, i) => {
  offsets.push(Buffer.byteLength(pdf, 'latin1'));
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});
const xref = Buffer.byteLength(pdf, 'latin1');
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const o of offsets) pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

mkdirSync('public/samples', { recursive: true });
writeFileSync('public/samples/sample-medical-bill.pdf', Buffer.from(pdf, 'latin1'));
console.log('wrote public/samples/sample-medical-bill.pdf', pdf.length, 'bytes');
