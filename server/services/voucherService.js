import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { voucherToken } from './paymentService.js';
import { policyPreview } from './refundService.js';
import { useUnicodeFont, FONT, MONO } from './pdfFonts.js';
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';

/* ---------- palette, matching the web app's design tokens ---------- */
const GREEN = [21, 128, 61];
const GREEN_DARK = [17, 94, 46];
const INK = [24, 24, 27];
const MUTED = [113, 113, 122];
const FAINT = [161, 161, 170];
const LINE = [228, 228, 231];
const SURFACE = [249, 250, 251];
const ACCENT_SOFT = [240, 253, 244];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const rupees = (paise) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "11 Aug 2026" reads better on a printed voucher than an ISO date. */
const prettyDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
};

const weekday = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' }) : '');

const nightsBetween = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / MS_PER_DAY));
};

const CATEGORY_LABEL = { homestay: 'Homestay booking', guide: 'Guided experience', artisan: 'Craft order' };

/**
 * URL encoded into the voucher QR. It carries an HMAC so that scanning proves the
 * server issued this voucher — a booking id on its own would be trivially forgeable.
 */
export const verificationUrl = (booking) => {
  const base = process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 5000}`;
  return `${base}/api/bookings/verify/${booking._id}?t=${voucherToken(booking._id)}`;
};

/**
 * Render the e-voucher as a PDF buffer.
 *
 * Returns a Buffer so the same output can be streamed as a download, attached to
 * the confirmation email, and archived to Cloudinary without being regenerated
 * differently in each place.
 */
export const buildVoucherPdf = async (booking, listing, operatorProfile, tourist) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  // Must precede any drawing: the base-14 fonts cannot render the rupee sign.
  useUnicodeFont(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 16;
  const right = pageW - 16;
  const contentW = right - left;

  /* ---------- small drawing helpers ---------- */
  const setText = (rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setFill = (rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setDraw = (rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

  const label = (text, x, y, size = 7.5) => {
    doc.setFont(FONT, 'bold');
    doc.setFontSize(size);
    setText(MUTED);
    doc.text(String(text).toUpperCase(), x, y, { charSpace: 0.3 });
  };

  /** Section rule with its caption sitting on the line's left end. */
  const section = (text, y) => {
    setDraw(LINE);
    doc.line(left, y, right, y);
    label(text, left, y + 5.5);
    return y + 12.5;
  };

  /** Vertical breathing room between one block and the next section rule. */
  const GAP = 5;

  const value = (text, x, y, { size = 10.5, bold = true, colour = INK, maxWidth } = {}) => {
    doc.setFont(FONT, bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    setText(colour);
    const str = String(text ?? '—');
    if (maxWidth) {
      const lines = doc.splitTextToSize(str, maxWidth);
      doc.text(lines, x, y);
      return lines.length;
    }
    doc.text(str, x, y);
    return 1;
  };

  const card = (x, y, w, h, { fill = SURFACE, border = LINE, radius = 2.5 } = {}) => {
    setFill(fill);
    setDraw(border);
    doc.roundedRect(x, y, w, h, radius, radius, 'FD');
  };

  /* ---------- header band ---------- */
  setFill(GREEN);
  doc.rect(0, 0, pageW, 30, 'F');
  // A darker strip anchors the band and echoes the app's accent border.
  setFill(GREEN_DARK);
  doc.rect(0, 30, pageW, 1.6, 'F');

  // Brand mark — the same rounded tile and peak the web header uses, drawn as
  // vectors so the voucher carries no bitmap logo and stays crisp in print.
  setFill([255, 255, 255]);
  doc.roundedRect(left, 8.4, 9, 9, 2.2, 2.2, 'F');
  setFill(GREEN);
  doc.triangle(left + 2, 15.2, left + 4.5, 10.4, left + 7, 15.2, 'F');

  const brandX = left + 12.5;
  setText([255, 255, 255]);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(14.5);
  doc.text('Jharkhand Tourism', brandX, 13.8);

  doc.setFont(FONT, 'normal');
  doc.setFontSize(7.5);
  doc.text('Department of Tourism, Government of Jharkhand', brandX, 19.2);

  doc.setFont(FONT, 'bold');
  doc.setFontSize(10.5);
  doc.text('E-VOUCHER', right, 13, { align: 'right', charSpace: 0.5 });
  doc.setFont(FONT, 'normal');
  doc.setFontSize(7.5);
  doc.text(CATEGORY_LABEL[booking.category] || 'Booking', right, 18.5, { align: 'right' });

  /* ---------- reference + QR ----------
     Both sit in one band. The previous version drew the next section rule at a
     fixed offset that landed *inside* the QR card, striking a line through it
     just above the caption — the row now reports its own bottom edge. */
  const bandY = 36;
  const qrSize = 26;
  const qrPad = 5;
  const qrBoxW = qrSize + qrPad * 2;
  const qrBoxH = qrSize + qrPad * 2 + 6;   // padding top/bottom and space for caption
  const qrX = right - qrBoxW;

  label('Booking reference', left, bandY + 5);

  // Courier gives the reference the fixed-pitch look of a ticket, and keeps
  // characters like 8/B and 0/O distinguishable when read aloud at a desk.
  doc.setFont(MONO, 'bold');
  doc.setFontSize(20);
  setText(INK);
  doc.text(booking.bookingRef || String(booking._id), left, bandY + 16);

  const status = (booking.status || 'confirmed').replace('_', ' ').toUpperCase();
  doc.setFont(FONT, 'bold');
  doc.setFontSize(7.5);
  const pillW = doc.getTextWidth(status) + 9;
  setFill(ACCENT_SOFT);
  setDraw([187, 247, 208]);
  doc.roundedRect(left, bandY + 21, pillW, 7, 3.5, 3.5, 'FD');
  setText(GREEN);
  doc.text(status, left + 4.5, bandY + 25.7);

  doc.setFont(FONT, 'normal');
  doc.setFontSize(8);
  setText(FAINT);
  doc.text(CATEGORY_LABEL[booking.category] || 'Booking', left + pillW + 5, bandY + 25.7);

  // QR in its own card, so it reads as something to be scanned
  card(qrX, bandY, qrBoxW, qrBoxH, { fill: [255, 255, 255] });
  const qrDataUrl = await QRCode.toDataURL(verificationUrl(booking), { margin: 0, width: 320 });
  doc.addImage(qrDataUrl, 'PNG', qrX + qrPad, bandY + qrPad, qrSize, qrSize);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(6.5);
  setText(MUTED);
  doc.text('SCAN AT CHECK-IN', qrX + qrBoxW / 2, bandY + qrPad + qrSize + 4.5, {
    align: 'center', charSpace: 0.2,
  });

  // Whichever column is taller decides where the band ends.
  let y = Math.max(bandY + 30, bandY + qrBoxH) + GAP;

  /* ---------- the experience ---------- */
  y = section('Experience', y);

  const titleLines = value(listing?.title, left, y, { size: 14, maxWidth: contentW });
  y += titleLines * 6.0;

  doc.setFont(FONT, 'normal');
  doc.setFontSize(9);
  setText(MUTED);
  doc.text(
    [operatorProfile?.businessName, listing?.district ? `${listing.district} district` : null]
      .filter(Boolean).join('   ·   '),
    left, y
  );
  y += GAP + 1;

  /* ---------- dates / quantity block ---------- */
  if (booking.category === 'homestay' && booking.checkIn && booking.checkOut) {
    const nights = nightsBetween(booking.checkIn, booking.checkOut);
    const boxH = 26;
    const gap = 4;
    const sideW = (contentW - gap * 2) * 0.37;
    const midW = contentW - sideW * 2 - gap * 2;

    card(left, y, sideW, boxH);
    label('Check-in', left + 5, y + 7);
    value(prettyDate(booking.checkIn), left + 5, y + 15, { size: 11 });
    doc.setFont(FONT, 'normal');
    doc.setFontSize(7.5);
    setText(FAINT);
    doc.text(weekday(booking.checkIn), left + 5, y + 22);

    const midX = left + sideW + gap;
    card(midX, y, midW, boxH, { fill: ACCENT_SOFT, border: [187, 247, 208] });
    doc.setFont(FONT, 'bold');
    doc.setFontSize(15);
    setText(GREEN);
    doc.text(String(nights), midX + midW / 2, y + 13, { align: 'center' });
    doc.setFont(FONT, 'bold');
    doc.setFontSize(7);
    setText(GREEN);
    doc.text(nights === 1 ? 'NIGHT' : 'NIGHTS', midX + midW / 2, y + 19, { align: 'center', charSpace: 0.3 });

    const outX = midX + midW + gap;
    card(outX, y, sideW, boxH);
    label('Check-out', outX + 5, y + 7);
    value(prettyDate(booking.checkOut), outX + 5, y + 15, { size: 11 });
    doc.setFont(FONT, 'normal');
    doc.setFontSize(7.5);
    setText(FAINT);
    doc.text(weekday(booking.checkOut), outX + 5, y + 22);

    y += boxH + GAP;
  } else if (booking.category === 'guide' && booking.checkIn) {
    const boxH = 21;
    card(left, y, contentW, boxH);
    label('Date of experience', left + 5, y + 7);
    value(`${prettyDate(booking.checkIn)}  ·  ${weekday(booking.checkIn)}`, left + 5, y + 15, { size: 12 });
    y += boxH + GAP;
  } else {
    const boxH = 21;
    card(left, y, contentW, boxH);
    label('Order', left + 5, y + 7);
    value(`${booking.units} item${booking.units === 1 ? '' : 's'}`, left + 5, y + 15, { size: 12 });
    y += boxH + GAP;
  }

  /* ---------- guest details ---------- */
  y = section('Guest details', y);

  const detailsH = 40;
  card(left, y, contentW, detailsH, { fill: [255, 255, 255] });

  const colW = contentW / 2;
  const cell = (l, v, x, yy) => {
    label(l, x, yy);
    value(v, x, yy + 6.5, { size: 10.5, maxWidth: colW - 12 });
  };

  setDraw(LINE);
  doc.line(left + colW, y + 5, left + colW, y + detailsH - 5);
  doc.line(left + 6, y + detailsH / 2, right - 6, y + detailsH / 2);

  const row1Y = y + 10;
  const row2Y = y + detailsH / 2 + 4.5;

  cell('Guest name', booking.guestName || tourist?.name, left + 6, row1Y);
  cell(
    booking.category === 'homestay' ? 'Rooms booked' : 'Quantity',
    booking.category === 'homestay'
      ? `${booking.units} room${booking.units === 1 ? '' : 's'}`
      : booking.units,
    left + colW + 6, row1Y
  );
  cell('Contact', booking.guestPhone || tourist?.email || '—', left + 6, row2Y);
  cell('Booked on', prettyDate(booking.paidAt || booking.createdAt), left + colW + 6, row2Y);

  y += detailsH + GAP;

  /* ---------- payment summary ---------- */
  const unitPaise = booking.pricePerUnitPaise || 0;
  const qty = booking.category === 'homestay'
    ? booking.units * Math.max(1, nightsBetween(booking.checkIn, booking.checkOut))
    : booking.units;

  const lineItems = [];
  if (unitPaise > 0) {
    const unitWord = booking.category === 'homestay' ? 'room-night' : booking.category === 'guide' ? 'day' : 'item';
    lineItems.push([`${rupees(unitPaise)} x ${qty} ${unitWord}${qty === 1 ? '' : 's'}`, rupees(unitPaise * qty)]);
  }
  if (booking.refundedPaise > 0) lineItems.push(['Refunded', `- ${rupees(booking.refundedPaise)}`]);

  y = section('Payment', y);

  // The payment reference now lives inside the panel instead of floating
  // underneath it, so the receipt is one object rather than two.
  const summaryH = 32 + lineItems.length * 7;
  card(left, y, contentW, summaryH, { fill: [255, 255, 255] });

  let ly = y + 9;
  doc.setFontSize(9);
  for (const [text, amount] of lineItems) {
    doc.setFont(FONT, 'normal');
    setText(MUTED);
    doc.text(text, left + 6, ly);
    doc.setFont(FONT, 'normal');
    setText(INK);
    doc.text(amount, right - 6, ly, { align: 'right' });
    ly += 7;
  }

  setDraw(LINE);
  doc.line(left + 6, ly - 2.5, right - 6, ly - 2.5);

  const totalBarH = 13;
  setFill(GREEN_DARK);
  doc.roundedRect(left + 4, ly, contentW - 8, totalBarH, 2, 2, 'F');
  const totalTextY = ly + totalBarH / 2 + 1.5;

  doc.setFont(FONT, 'bold');
  doc.setFontSize(9);
  setText([255, 255, 255]);
  doc.text(booking.refundedPaise > 0 ? 'NET PAID' : 'TOTAL PAID', left + 10, totalTextY, { charSpace: 0.3 });
  doc.setFontSize(14);
  setText([255, 255, 255]);
  doc.text(rupees(booking.amountPaise - (booking.refundedPaise || 0)), right - 10, totalTextY + 0.6, { align: 'right' });

  doc.setFont(FONT, 'normal');
  doc.setFontSize(7);
  setText(FAINT);
  doc.text(
    `Paid ${prettyDate(booking.paidAt)}   ·   Payment ID ${booking.razorpayPaymentId || '—'}`,
    left + 6, y + summaryH - 4.5
  );

  const flowBottom = y + summaryH;

  /* ---------- host contact + arrival notes + cancellation terms ---------- */
  const notesH = 30;
  const gap = 4;
  const colN = 3;
  const cardW = (contentW - gap * (colN - 1)) / colN;
  const footerH = 16;

  const idealBlockY = pageH - 10 - footerH - notesH - 4;
  const blockY = Math.max(flowBottom + GAP, idealBlockY);

  const hostX = left;
  const goX = left + cardW + gap;
  const termsX = left + (cardW + gap) * 2;

  /* -- host -- */
  card(hostX, blockY, cardW, notesH, { fill: SURFACE });
  label('Your host', hostX + 5, blockY + 7.5);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(9);
  setText(INK);
  doc.text(
    doc.splitTextToSize(operatorProfile?.businessName || '—', cardW - 10).slice(0, 2),
    hostX + 5, blockY + 14
  );
  if (operatorProfile?.contactPhone) {
    doc.setFont(FONT, 'normal');
    doc.setFontSize(6);
    setText(FAINT);
    doc.text('CALL AHEAD', hostX + 5, blockY + 21.5, { charSpace: 0.2 });
    doc.setFont(FONT, 'bold');
    doc.setFontSize(10);
    setText(GREEN);
    doc.text(operatorProfile.contactPhone, hostX + 5, blockY + 26.5);
  }

  /* -- before you go -- */
  const bullets = [
    'Carry photo ID for each adult.',
    'Show this voucher on arrival.',
    'Call ahead if arriving late.',
  ];

  card(goX, blockY, cardW, notesH, { fill: [255, 255, 255] });
  label('Before you go', goX + 5, blockY + 7.5);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(7);
  let by = blockY + 14.5;
  for (const line of bullets) {
    setText(GREEN);
    doc.text('•', goX + 5, by);
    setText(MUTED);
    doc.text(doc.splitTextToSize(line, cardW - 14)[0], goX + 8.5, by);
    by += 5.5;
  }

  /* -- cancellation -- */
  card(termsX, blockY, cardW, notesH, { fill: [255, 255, 255] });
  label('Cancellation', termsX + 5, blockY + 7.5);
  const { bands } = policyPreview(booking.checkIn);
  let ty = blockY + 14.5;
  for (const band of bands.slice(0, 3)) {
    const short = band.label.replace(/(\d{4})-(\d{2})-(\d{2})/, (iso) =>
      new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }));
    doc.setFont(FONT, 'normal');
    doc.setFontSize(6.8);
    setText(MUTED);
    doc.text(doc.splitTextToSize(short, cardW - 26)[0], termsX + 5, ty);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(6.8);
    setText(INK);
    doc.text(band.summary, termsX + cardW - 5, ty, { align: 'right' });
    ty += 5.5;
  }

  /* ---------- footer ---------- */
  const footRuleY = blockY + notesH + 4;
  setDraw(LINE);
  doc.line(left, footRuleY, right, footRuleY);

  doc.setFont(FONT, 'bold');
  doc.setFontSize(7);
  setText(MUTED);
  doc.text('PRESENT THIS VOUCHER AT CHECK-IN', left, footRuleY + 5, { charSpace: 0.2 });

  doc.setFont(FONT, 'normal');
  doc.setFontSize(6.5);
  setText(FAINT);
  doc.text('The operator scans the QR code to verify it against our records.', left, footRuleY + 9.5);
  doc.text(`Issued ${prettyDate(new Date())}`, right, footRuleY + 9.5, { align: 'right' });

  return Buffer.from(doc.output('arraybuffer'));
};

/**
 * Archive the voucher PDF to Cloudinary and return its details.
 *
 * Deliberately isolated from the image uploads:
 *   - its own folder, `jhk-tourism/vouchers`
 *   - `resource_type: 'raw'`, because a PDF is not an image and must never be
 *     fed through the image pipeline or eager transformations
 *   - `type: 'authenticated'`, since a voucher carries a guest's name, phone
 *     number and payment reference — it needs a signed URL to open
 *   - a deterministic `public_id` with `overwrite`, so regenerating a voucher
 *     replaces that one file instead of littering the account
 *
 * Nothing here touches existing listing or KYC assets. Returns null when
 * Cloudinary is not configured, so local development is unaffected.
 */
export const archiveVoucher = async (booking, pdfBuffer) => {
  if (!isCloudinaryConfigured()) return null;

  const publicId = `voucher-${booking.bookingRef || booking._id}`;

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'jhk-tourism/vouchers',
        public_id: publicId,
        resource_type: 'raw',
        type: 'authenticated',
        overwrite: true,
        format: 'pdf',
        tags: ['voucher', booking.category].filter(Boolean),
      },
      (error, uploaded) => (error ? reject(error) : resolve(uploaded))
    );
    stream.end(pdfBuffer);
  });

  return {
    publicId: result.public_id,
    url: result.secure_url,
    bytes: result.bytes,
    version: result.version,
  };
};

/**
 * A signed, expiring link to an archived voucher. Authenticated raw assets
 * cannot be fetched from their bare URL, which is the point.
 */
export const signedVoucherUrl = (publicId, { expiresInSeconds = 3600 } = {}) => {
  if (!isCloudinaryConfigured() || !publicId) return null;
  return cloudinary.utils.private_download_url(publicId, 'pdf', {
    resource_type: 'raw',
    type: 'authenticated',
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
  });
};
