import type { PiiType } from '../redact/patterns';

/**
 * Synthetic evaluation set. Every person, address, organisation and number here
 * is invented; card/IBAN numbers are public test values. Never add real data.
 *
 * Each label's `value` must appear verbatim in `text`; every occurrence counts.
 * Not labelled (public, not personal): government bodies, courts, tax authorities,
 * job titles and departments. Detecting them counts as a false positive.
 */
export interface Label {
  type: PiiType;
  value: string;
}
export interface EvalDoc {
  id: string;
  kind: 'medical' | 'legal' | 'tax' | 'hr' | 'housing' | 'insurance';
  text: string;
  labels: Label[];
}

const L = (type: PiiType, value: string): Label => ({ type, value });

export const DATASET: EvalDoc[] = [
  {
    id: 'med-01',
    kind: 'medical',
    text: `LAKESIDE MULTISPECIALITY CLINIC
Discharge summary
Patient: Priya Raman   DOB: 14/02/1988   MRN: LKC-448291
Address: 42 Lake View Road, Kolkata 700091
Phone: +91 98765 43210

Ms. Raman was admitted on 2026-10-21 with uncontrolled Type 2 diabetes. HbA1c 9.4%.
Started on metformin 500 mg twice daily. Review with Dr. Arjun Mehta on March 3, 2026.`,
    labels: [
      L('ORG', 'LAKESIDE MULTISPECIALITY CLINIC'),
      L('PERSON', 'Priya Raman'), L('PERSON', 'Raman'), L('DATE', '14/02/1988'), L('ID', 'LKC-448291'),
      L('ADDRESS', '42 Lake View Road, Kolkata 700091'), L('PHONE', '+91 98765 43210'),
      L('DATE', '2026-10-21'), L('PERSON', 'Arjun Mehta'), L('DATE', 'March 3, 2026'),
    ],
  },
  {
    id: 'med-02',
    kind: 'medical',
    text: `Patient name: Daniel O'Connor
Date of birth: 07/09/1979
Insurance member ID: BCX-55102-77
Referring physician: Dr. Helen Park, Riverside Family Practice

Daniel reports chest pain on exertion for 3 weeks. ECG shows nonspecific ST changes.
Plan: stress test, lipid panel. Contact patient at daniel.oconnor@example.com or (212) 555-0187.`,
    labels: [
      L('PERSON', "Daniel O'Connor"), L('PERSON', 'Daniel'), L('DATE', '07/09/1979'), L('ID', 'BCX-55102-77'),
      L('PERSON', 'Helen Park'), L('ORG', 'Riverside Family Practice'),
      L('EMAIL', 'daniel.oconnor@example.com'), L('PHONE', '(212) 555-0187'),
    ],
  },
  {
    id: 'med-03',
    kind: 'medical',
    text: `Lab report — Sunrise Diagnostics, 18 Park Street, Pune 411001
Patient: Ananya Iyer (F, 34)   Sample ID: SD/2026/88213
Collected: 5 November 2026

TSH: 6.8 mIU/L (high). Free T4: 0.9 ng/dL (normal).
Comment: suggestive of subclinical hypothyroidism. Please correlate clinically.`,
    labels: [
      L('ORG', 'Sunrise Diagnostics'), L('ADDRESS', '18 Park Street, Pune 411001'),
      L('PERSON', 'Ananya Iyer'), L('ID', 'SD/2026/88213'), L('DATE', '5 November 2026'),
    ],
  },
  {
    id: 'med-04',
    kind: 'medical',
    text: `Dear Mr. Thomas Becker,
Your appointment at St. Agnes Hospital cardiology unit is confirmed for Nov 28, 2026 at 09:30.
Please bring your Aadhaar card (2345 6789 0124) and previous reports.
Booking reference: SAH-APT-30917.
For changes call +91 98300 12345.`,
    labels: [
      L('PERSON', 'Thomas Becker'), L('ORG', 'St. Agnes Hospital'), L('DATE', 'Nov 28, 2026'),
      L('AADHAAR', '2345 6789 0124'), L('ID', 'SAH-APT-30917'), L('PHONE', '+91 98300 12345'),
    ],
  },
  {
    id: 'med-05',
    kind: 'medical',
    text: `Prescription
Dr. Kavita Rao, MBBS MD — Reg. No. KMC-58821
Patient: Rohan Gupta, age 52
Rx: Amlodipine 5 mg once daily x 30 days. Atorvastatin 10 mg at night.
Next visit after 4 weeks. Bill paid by card ending 4111 1111 1111 1111.`,
    labels: [
      L('PERSON', 'Kavita Rao'), L('ID', 'KMC-58821'), L('PERSON', 'Rohan Gupta'),
      L('CARD', '4111 1111 1111 1111'),
    ],
  },
  {
    id: 'legal-01',
    kind: 'legal',
    text: `IN THE COURT OF THE CIVIL JUDGE, BENGALURU
Case No. OS 1482/2026

Meera Krishnan ... Plaintiff
versus
Brightline Builders Pvt Ltd ... Defendant

NOTICE: The defendant is directed to appear on 12/01/2027. The plaintiff, residing at
7 Residency Road, Bengaluru 560025, claims a refund of Rs. 18,40,000 for a delayed flat.`,
    labels: [
      L('ID', 'OS 1482/2026'), L('PERSON', 'Meera Krishnan'), L('ORG', 'Brightline Builders Pvt Ltd'),
      L('DATE', '12/01/2027'), L('ADDRESS', '7 Residency Road, Bengaluru 560025'),
    ],
  },
  {
    id: 'legal-02',
    kind: 'legal',
    text: `Hartwell & Lowe LLP
1200 Market Street, Suite 400, San Francisco, CA 94102

Re: Demand for unpaid wages — our client James Whitaker

Dear Ms. Laura Chen,
We represent Mr. Whitaker regarding wages owed by Copperleaf Analytics Inc. for the period ending
September 30, 2026. Please respond to j.morales@hartwell-lowe.example by 2026-11-30.
Sincerely, Javier Morales`,
    labels: [
      L('ORG', 'Hartwell & Lowe LLP'), L('ADDRESS', '1200 Market Street, Suite 400, San Francisco, CA 94102'),
      L('PERSON', 'James Whitaker'), L('PERSON', 'Whitaker'), L('PERSON', 'Laura Chen'),
      L('ORG', 'Copperleaf Analytics Inc.'), L('DATE', 'September 30, 2026'),
      L('EMAIL', 'j.morales@hartwell-lowe.example'), L('DATE', '2026-11-30'), L('PERSON', 'Javier Morales'),
    ],
  },
  {
    id: 'legal-03',
    kind: 'legal',
    text: `LEGAL NOTICE
To: Mr. Suresh Nair, Flat 302, Palm Grove Apartments, Kochi 682016
From: Advocate Deepa Menon, on behalf of Coastal Finance Ltd.

You have defaulted on loan account CFL-LN-0093312. A sum of Rs. 2,45,600 is outstanding.
Kindly pay within 15 days of this notice dated 03/11/2026, failing which legal proceedings will begin.`,
    labels: [
      L('PERSON', 'Suresh Nair'), L('ADDRESS', 'Flat 302, Palm Grove Apartments, Kochi 682016'),
      L('PERSON', 'Deepa Menon'), L('ORG', 'Coastal Finance Ltd.'), L('ID', 'CFL-LN-0093312'),
      L('DATE', '03/11/2026'),
    ],
  },
  {
    id: 'legal-04',
    kind: 'legal',
    text: `Witness statement of Olivia Grant
I, Olivia Grant, of 14 Elm Close, Oxford OX2 6HT, state as follows.
On 22 August 2026 I saw a blue van collide with a cyclist outside Greenway Pharmacy.
The driver gave his name as Mark Doyle. I can be reached on +44 20 7946 0958.`,
    labels: [
      L('PERSON', 'Olivia Grant'), L('ADDRESS', '14 Elm Close, Oxford OX2 6HT'), L('DATE', '22 August 2026'),
      L('ORG', 'Greenway Pharmacy'), L('PERSON', 'Mark Doyle'), L('PHONE', '+44 20 7946 0958'),
    ],
  },
  {
    id: 'tax-01',
    kind: 'tax',
    text: `INCOME TAX DEPARTMENT — Intimation u/s 143(1)
Name: Sayan Mukherjee
PAN: BNZPM2501F
Assessment Year: 2026-27

A demand of Rs. 12,480 has been determined due to a mismatch in TDS claimed.
Refund bank account: DE89 3704 0044 0532 0130 00. Communication address: 9 Salt Lake Sector V, Kolkata 700091.`,
    labels: [
      L('PERSON', 'Sayan Mukherjee'), L('PAN', 'BNZPM2501F'), L('IBAN', 'DE89 3704 0044 0532 0130 00'),
      L('ADDRESS', '9 Salt Lake Sector V, Kolkata 700091'),
    ],
  },
  {
    id: 'tax-02',
    kind: 'tax',
    text: `Internal Revenue Service — Notice CP2000
Taxpayer: Rebecca Lyons
SSN: 123-45-6789
Tax year: 2025

We found income reported by Northwind Bank that you did not include on your return.
Proposed amount due: $1,842. Respond by December 15, 2026. Mail to 455 Oak Avenue, Austin, TX 78701.`,
    labels: [
      L('PERSON', 'Rebecca Lyons'), L('SSN', '123-45-6789'), L('ORG', 'Northwind Bank'),
      L('DATE', 'December 15, 2026'), L('ADDRESS', '455 Oak Avenue, Austin, TX 78701'),
    ],
  },
  {
    id: 'tax-03',
    kind: 'tax',
    text: `HM Revenue & Customs
Simple Assessment for Ahmed Siddiqui, Unique Taxpayer Reference 84721 93056
Address: 3 Canal Street, Manchester M1 3HE

You owe £640 for the tax year ending 5 April 2026. Pay by 31 January 2027.
Payments from account GB82 WEST 1234 5698 7654 32 are accepted.`,
    labels: [
      L('PERSON', 'Ahmed Siddiqui'), L('ID', '84721 93056'),
      L('ADDRESS', '3 Canal Street, Manchester M1 3HE'), L('DATE', '5 April 2026'), L('DATE', '31 January 2027'),
      L('IBAN', 'GB82 WEST 1234 5698 7654 32'),
    ],
  },
  {
    id: 'tax-04',
    kind: 'tax',
    text: `Form 16 summary — employer: Zenith Softech Pvt Ltd (TAN: BLRZ04412E)
Employee: Nikhil Verma, PAN ABCPE1234F, Aadhaar 4987 1234 5605
Gross salary: Rs. 14,20,000. Tax deducted: Rs. 1,38,400.
Contact HR at payroll@zenithsoftech.example.`,
    labels: [
      L('ORG', 'Zenith Softech Pvt Ltd'), L('ID', 'BLRZ04412E'), L('PERSON', 'Nikhil Verma'),
      L('PAN', 'ABCPE1234F'), L('AADHAAR', '4987 1234 5605'), L('EMAIL', 'payroll@zenithsoftech.example'),
    ],
  },
  {
    id: 'hr-01',
    kind: 'hr',
    text: `CONFIDENTIAL — HR complaint
Complainant: Fatima Sheikh, Employee ID EMP-20417, Marketing
Against: Raj Malhotra, Senior Manager

On 9/10/2026 and again on 16/10/2026, Mr. Malhotra made comments about my religion in team meetings.
Witnesses: Aditi Bose. I request a formal inquiry. Reach me at fatima.s@example.org.`,
    labels: [
      L('PERSON', 'Fatima Sheikh'), L('ID', 'EMP-20417'), L('PERSON', 'Raj Malhotra'), L('PERSON', 'Malhotra'),
      L('DATE', '9/10/2026'), L('DATE', '16/10/2026'), L('PERSON', 'Aditi Bose'), L('EMAIL', 'fatima.s@example.org'),
    ],
  },
  {
    id: 'hr-02',
    kind: 'hr',
    text: `Offer of employment
Dear Kevin Tran,
Bluepeak Logistics is pleased to offer you the role of Operations Analyst, starting January 5, 2027,
at an annual salary of $78,000. Please sign and return by 2026-12-01.
For payroll setup we need your SSN (219-09-9999) and a voided check.
— Sarah Kim, People Team, Bluepeak Logistics`,
    labels: [
      L('PERSON', 'Kevin Tran'), L('ORG', 'Bluepeak Logistics'), L('DATE', 'January 5, 2027'),
      L('DATE', '2026-12-01'), L('SSN', '219-09-9999'), L('PERSON', 'Sarah Kim'),
    ],
  },
  {
    id: 'hr-03',
    kind: 'hr',
    text: `Termination letter
Employee: Grace Liu (ID 77-1903)
Effective date: 30/11/2026
Reason: role eliminated in restructuring.
Final settlement will be paid to card 5555 5555 5555 4444 within 30 days.
Signed: Peter Novak, HR Director, Orchard Retail Group`,
    labels: [
      L('PERSON', 'Grace Liu'), L('ID', '77-1903'), L('DATE', '30/11/2026'),
      L('CARD', '5555 5555 5555 4444'), L('PERSON', 'Peter Novak'), L('ORG', 'Orchard Retail Group'),
    ],
  },
  {
    id: 'housing-01',
    kind: 'housing',
    text: `Notice to vacate
To tenant: Carlos Mendes, Unit 5B, 88 Harbor Drive, Seattle, WA 98101
Landlord: Pinecrest Property Management

Your lease (Tenant account PPM-T-6610) ends on December 31, 2026 and will not be renewed.
Your deposit of $2,100 will be returned to card 3782 822463 10005 after inspection.`,
    labels: [
      L('PERSON', 'Carlos Mendes'), L('ADDRESS', 'Unit 5B, 88 Harbor Drive, Seattle, WA 98101'),
      L('ORG', 'Pinecrest Property Management'), L('ID', 'PPM-T-6610'), L('DATE', 'December 31, 2026'),
      L('CARD', '3782 822463 10005'),
    ],
  },
  {
    id: 'housing-02',
    kind: 'housing',
    text: `Rent agreement — key terms
Owner: Shalini Desai. Tenant: Vikram Joshi.
Property: B-14, Green Park Extension, New Delhi 110016
Monthly rent Rs. 32,000, due by the 5th. Security deposit Rs. 64,000.
Tenant Aadhaar: 5820 3917 4650. Owner phone: +91 99100 22334.`,
    labels: [
      L('PERSON', 'Shalini Desai'), L('PERSON', 'Vikram Joshi'), L('ADDRESS', 'B-14, Green Park Extension, New Delhi 110016'),
      L('AADHAAR', '5820 3917 4650'), L('PHONE', '+91 99100 22334'),
    ],
  },
  {
    id: 'ins-01',
    kind: 'insurance',
    text: `Claim rejection letter — Shieldwell Health Insurance
Policy holder: Lakshmi Pillai, Policy No. SWH-9920-4471
Claim ID: CLM-2026-55810

Your claim for hospitalisation at Apollo Crest Hospital from 02/09/2026 to 06/09/2026 is rejected
because the condition falls under the 2-year waiting period for pre-existing diseases.`,
    labels: [
      L('ORG', 'Shieldwell Health Insurance'), L('PERSON', 'Lakshmi Pillai'), L('ID', 'SWH-9920-4471'),
      L('ID', 'CLM-2026-55810'), L('ORG', 'Apollo Crest Hospital'), L('DATE', '02/09/2026'), L('DATE', '06/09/2026'),
    ],
  },
  {
    id: 'ins-02',
    kind: 'insurance',
    text: `Auto claim acknowledgement
Hi Emily Rhodes,
We received your claim #AC-4471209 for the collision on Oct 30, 2026.
An adjuster, Brian Foster, will contact you at emily.rhodes@example.net or +1 (415) 555-0132.
Vehicle garaged at 2210 Pine Lane, Denver, CO 80203.
— Meridian Mutual Insurance`,
    labels: [
      L('PERSON', 'Emily Rhodes'), L('ID', 'AC-4471209'), L('DATE', 'Oct 30, 2026'), L('PERSON', 'Brian Foster'),
      L('EMAIL', 'emily.rhodes@example.net'), L('PHONE', '+1 (415) 555-0132'),
      L('ADDRESS', '2210 Pine Lane, Denver, CO 80203'), L('ORG', 'Meridian Mutual Insurance'),
    ],
  },
];
