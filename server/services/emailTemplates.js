/**
 * Transactional email templates.
 *
 * Deliberately table-based with inline styles rather than the flexbox and CSS variables
 * the web app uses — Outlook and several Indian webmail clients still strip <style>
 * blocks and ignore modern layout. Every template also returns a plain-text version,
 * which matters both for accessibility and for spam scoring.
 */

const BRAND = '#15803D';
const INK = '#18181b';
const MUTED = '#6b7280';
const LINE = '#e8e8ea';

export const rupees = (paise) =>
  `₹${((paise || 0) / 100).toLocaleString('en-IN')}`;

export const asDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
};

const escape = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

/**
 * Shared shell. `rows` renders as a label/value table, which is what nearly every
 * transactional message in this system needs.
 */
const layout = ({ heading, intro, rows = [], callout, cta, footNote, accent = BRAND }) => {
  const rowsHtml = rows.length ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:20px 0;">
      ${rows.map(([label, value]) => `
        <tr>
          <td style="padding:9px 0;border-bottom:1px solid ${LINE};color:${MUTED};font-size:14px;">${escape(label)}</td>
          <td style="padding:9px 0;border-bottom:1px solid ${LINE};color:${INK};font-size:14px;font-weight:600;text-align:right;">${escape(value)}</td>
        </tr>`).join('')}
    </table>` : '';

  const calloutHtml = callout ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:20px 0;">
      <tr>
        <td style="background:${callout.tone === 'warn' ? '#fffbeb' : callout.tone === 'bad' ? '#fef2f2' : '#f0fdf4'};
                   border:1px solid ${callout.tone === 'warn' ? '#fde68a' : callout.tone === 'bad' ? '#fecaca' : '#bbf7d0'};
                   border-radius:8px;padding:14px 16px;color:${callout.tone === 'warn' ? '#b45309' : callout.tone === 'bad' ? '#b91c1c' : '#15803d'};
                   font-size:14px;line-height:1.5;">${callout.html}</td>
      </tr>
    </table>` : '';

  const ctaHtml = cta ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="background:${accent};border-radius:8px;">
          <a href="${escape(cta.url)}" style="display:inline-block;padding:12px 22px;color:#ffffff;
             text-decoration:none;font-size:14px;font-weight:600;">${escape(cta.label)}</a>
        </td>
      </tr>
    </table>` : '';

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:12px;overflow:hidden;
                    font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr>
          <td style="background:${accent};padding:18px 28px;">
            <span style="color:#ffffff;font-size:15px;font-weight:700;letter-spacing:-0.2px;">Jharkhand Tourism</span>
            <div style="color:rgba(255,255,255,0.85);font-size:11px;margin-top:2px;">Department of Tourism, Government of Jharkhand</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <h1 style="margin:0 0 10px;font-size:20px;line-height:1.3;color:${INK};font-weight:700;">${escape(heading)}</h1>
            <p style="margin:0;font-size:15px;line-height:1.6;color:${MUTED};">${intro}</p>
            ${rowsHtml}
            ${calloutHtml}
            ${ctaHtml}
            ${footNote ? `<p style="margin:18px 0 0;font-size:12.5px;line-height:1.6;color:${MUTED};">${footNote}</p>` : ''}
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid ${LINE};padding:16px 28px;">
            <p style="margin:0;font-size:11.5px;color:#a1a1aa;line-height:1.5;">
              This is an automated message from the Jharkhand Tourism platform.
              Please do not reply to this address.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
};

const plain = (heading, intro, rows = [], footNote = '') =>
  [
    'JHARKHAND TOURISM',
    'Department of Tourism, Government of Jharkhand',
    '',
    heading.toUpperCase(),
    '',
    intro.replace(/<[^>]+>/g, ''),
    '',
    ...rows.map(([l, v]) => `${l}: ${v}`),
    '',
    footNote.replace(/<[^>]+>/g, ''),
    '',
    'This is an automated message. Please do not reply.',
  ].filter(l => l !== undefined).join('\n');

/** Describes what was booked, in the language of that vendor type. */
const bookingRows = (booking, listing) => {
  const rows = [['Reference', booking.bookingRef || '—'], ['Experience', listing?.title || '—']];

  if (booking.category === 'artisan') {
    rows.push(['Items', booking.units]);
  } else if (booking.category === 'guide') {
    rows.push(['Date', asDate(booking.checkIn)]);
  } else {
    rows.push(['Check-in', asDate(booking.checkIn)]);
    rows.push(['Check-out', asDate(booking.checkOut)]);
    rows.push(['Rooms', booking.units]);
  }

  return rows;
};

// ---------------------------------------------------------------------------
// Templates. Each returns { subject, html, text }.
// ---------------------------------------------------------------------------

export const bookingConfirmedTraveller = ({ booking, listing, operatorProfile, tourist }) => {
  const heading = 'Your booking is confirmed';
  const intro = `Thank you, ${escape(tourist?.name || 'traveller')}. Your booking with <strong>${escape(operatorProfile?.businessName || 'the operator')}</strong> is confirmed and paid.`;
  const rows = [
    ...bookingRows(booking, listing),
    ['District', listing?.district || '—'],
    ['Amount paid', rupees(booking.amountPaise)],
  ];

  return {
    subject: `Booking confirmed — ${booking.bookingRef}`,
    html: layout({
      heading, intro, rows,
      callout: {
        tone: 'good',
        html: `Your e-voucher is attached as a PDF. Show it at check-in — the operator will scan the QR code to verify your booking.`,
      },
      footNote: operatorProfile?.contactPhone
        ? `Your host: <strong>${escape(operatorProfile.businessName)}</strong>, ${escape(operatorProfile.contactPhone)}. Cancellation terms are as shown when you booked.`
        : 'Cancellation terms are as shown when you booked.',
    }),
    text: plain(heading, `Thank you, ${tourist?.name || 'traveller'}. Your booking is confirmed and paid.`, rows,
      'Your e-voucher is attached as a PDF. Show it at check-in.'),
  };
};

export const bookingConfirmedOperator = ({ booking, listing, tourist }) => {
  const heading = 'You have a new booking';
  const intro = `<strong>${escape(tourist?.name || 'A traveller')}</strong> has booked and paid for ${escape(listing?.title || 'your listing')}.`;
  const rows = [
    ...bookingRows(booking, listing),
    ['Traveller', tourist?.name || '—'],
    ['Booking value', rupees(booking.amountPaise)],
    ['You receive', rupees(booking.operatorPayoutPaise)],
  ];

  return {
    subject: `New booking — ${listing?.title || 'your listing'} (${booking.bookingRef})`,
    html: layout({
      heading, intro, rows,
      footNote: 'These dates are now closed on your calendar. The traveller will present a QR e-voucher at check-in.',
    }),
    text: plain(heading, `${tourist?.name || 'A traveller'} has booked and paid for your listing.`, rows),
  };
};

export const bookingCancelledTraveller = ({ booking, listing, refundedPaise, refundPercent }) => {
  const heading = 'Your booking has been cancelled';
  const gotMoney = refundedPaise > 0;
  const rows = [
    ...bookingRows(booking, listing),
    ['Amount paid', rupees(booking.amountPaise)],
    ['Refund', `${rupees(refundedPaise)} (${refundPercent}%)`],
  ];

  return {
    subject: `Booking cancelled — ${booking.bookingRef}`,
    html: layout({
      heading,
      intro: 'Your booking has been cancelled as requested.',
      rows,
      callout: gotMoney
        ? { tone: 'good', html: `<strong>${rupees(refundedPaise)}</strong> will be returned to your original payment method within 5–7 working days.` }
        : { tone: 'warn', html: 'This cancellation falls inside the no-refund window, so no amount is being returned. This was shown to you before payment.' },
    }),
    text: plain(heading, 'Your booking has been cancelled as requested.', rows,
      gotMoney ? `${rupees(refundedPaise)} will be returned within 5-7 working days.` : 'No refund is due under the cancellation policy.'),
  };
};

export const bookingCancelledOperator = ({ booking, listing, tourist }) => {
  const heading = 'A booking was cancelled';
  const rows = [
    ...bookingRows(booking, listing),
    ['Traveller', tourist?.name || '—'],
    ['You keep', rupees(booking.operatorPayoutPaise)],
  ];

  return {
    subject: `Booking cancelled — ${booking.bookingRef}`,
    html: layout({
      heading,
      intro: `${escape(tourist?.name || 'A traveller')} has cancelled their booking. These dates are back on sale.`,
      rows,
      footNote: 'Where the cancellation fell inside a partial-refund window, the retained amount stays with you, less commission.',
    }),
    text: plain(heading, `${tourist?.name || 'A traveller'} has cancelled. These dates are back on sale.`, rows),
  };
};

export const bookingRejectedTraveller = ({ booking, listing, operatorProfile, reason, refundedPaise }) => {
  const heading = 'Your booking could not be honoured';
  const rows = [
    ...bookingRows(booking, listing),
    ['Operator', operatorProfile?.businessName || '—'],
    ['Full refund', rupees(refundedPaise)],
  ];

  return {
    subject: `Booking cancelled by the operator — ${booking.bookingRef}`,
    html: layout({
      heading,
      intro: `We are sorry. <strong>${escape(operatorProfile?.businessName || 'The operator')}</strong> is unable to honour your booking.`,
      rows,
      callout: {
        tone: 'bad',
        html: `<strong>Reason given:</strong> ${escape(reason || 'No reason provided')}`,
      },
      footNote: `You are being refunded <strong>in full</strong> regardless of the cancellation window, because this was not your doing. The refund reaches your original payment method within 5–7 working days. This cancellation has been recorded against the operator's account with the Department.`,
    }),
    text: plain(heading, `${operatorProfile?.businessName || 'The operator'} is unable to honour your booking. Reason: ${reason || 'not provided'}.`,
      rows, 'You are being refunded in full within 5-7 working days.'),
  };
};

export const refundIssuedTraveller = ({ booking, listing, refundedPaise, reason }) => {
  const heading = 'A refund has been issued';
  const rows = [
    ...bookingRows(booking, listing),
    ['Amount paid', rupees(booking.amountPaise)],
    ['Refunded now', rupees(refundedPaise)],
    ['Refunded in total', rupees(booking.refundedPaise)],
  ];

  return {
    subject: `Refund issued — ${booking.bookingRef}`,
    html: layout({
      heading,
      intro: 'The Department of Tourism has issued a refund on your booking.',
      rows,
      callout: { tone: 'good', html: `<strong>Reason:</strong> ${escape(reason || 'Reviewed by the Department')}` },
      footNote: 'The amount reaches your original payment method within 5–7 working days.',
    }),
    text: plain(heading, 'The Department of Tourism has issued a refund on your booking.', rows,
      `Reason: ${reason || 'Reviewed by the Department'}`),
  };
};

export const operatorApproved = ({ profile, appUrl }) => {
  const heading = 'You are verified';
  const rows = [
    ['Business', profile.businessName],
    ['District', profile.district],
    ['Status', 'Approved'],
  ];

  return {
    subject: 'Your operator account has been approved',
    html: layout({
      heading,
      intro: `Congratulations. The Department of Tourism has verified <strong>${escape(profile.businessName)}</strong>. Your listings are now visible to travellers across the platform.`,
      rows,
      cta: { label: 'Manage your listings', url: `${appUrl}/operator/listings` },
      footNote: 'Keep your availability calendar current — travellers can only book dates you have left open.',
    }),
    text: plain(heading, `The Department has verified ${profile.businessName}. Your listings are now live.`, rows),
  };
};

export const operatorRejected = ({ profile, reason, appUrl }) => {
  const heading = 'Your application needs changes';
  const rows = [
    ['Business', profile.businessName],
    ['District', profile.district],
    ['Status', 'Not approved'],
  ];

  return {
    subject: 'Your operator application was not approved',
    html: layout({
      heading,
      intro: `The Department of Tourism has reviewed your application for <strong>${escape(profile.businessName)}</strong> and cannot approve it as submitted.`,
      rows,
      callout: { tone: 'warn', html: `<strong>Reason:</strong> ${escape(reason || 'No reason provided')}` },
      cta: { label: 'Update and resubmit', url: `${appUrl}/operator/onboarding` },
      footNote: 'You can correct the details above and submit again. There is no limit on resubmissions.',
    }),
    text: plain(heading, `Your application for ${profile.businessName} was not approved. Reason: ${reason || 'not provided'}.`,
      rows, 'You can correct your details and resubmit.'),
  };
};
