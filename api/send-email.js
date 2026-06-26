const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const { verifyAdmin } = require('./_utils/auth');
const { formatTime12 } = require('./_utils/time');

/**
 * Unified email handler for SavanaTattoos.
 * Actions: inquiry-confirmation (public), appointment-confirmed (admin)
 */
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { action, submissionId, name, owner_name, email, service, body_placement, size, confirmed_time, requested_date, duration_minutes, client_id } = req.body;

  // Admin auth required for appointment-confirmed
  if (action === 'appointment-confirmed') {
    const { error: authError, status: authStatus } = await verifyAdmin(req);
    if (authError) return res.status(authStatus).json({ error: authError });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || 'Savana Tattoos <onboarding@resend.dev>';

  if (!resendKey) {
    console.error('[SEND-EMAIL] Missing RESEND_API_KEY');
    return res.status(500).json({ success: false, error: 'Configuration missing' });
  }

  const resend = new Resend(resendKey);

  try {
    let html = '';

    if (action === 'inquiry-confirmation') {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      const { data: leadData, error: fetchError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', submissionId)
        .single();

      if (fetchError || !leadData) {
        return res.status(404).json({ success: false, error: 'Lead not found' });
      }

      const lead = leadData;
      html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
          <div style="text-align: center; padding: 20px 0; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #c9a87c; border-radius: 12px 12px 0 0;">
            <h1 style="margin: 0; font-size: 28px; letter-spacing: 3px;">SAVANA TATTOOS</h1>
            <p style="font-style: italic; color: #a8885c; margin: 8px 0 0;">Inquiry Received</p>
          </div>
          <div style="padding: 25px; background: #1a1a2e; color: #e0e0e0; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px;">Hi <strong>${lead.client_name || lead.name}</strong>,</p>
            <p>Thanks for reaching out! We've received your tattoo inquiry and here are the details:</p>
            <div style="background: #16213e; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 3px solid #c9a87c;">
              <p style="margin: 4px 0;"><strong>Service:</strong> ${lead.service}</p>
              <p style="margin: 4px 0;"><strong>Size:</strong> ${lead.size_category || 'Not specified'}</p>
              ${lead.body_placement ? '<p style="margin: 4px 0;"><strong>Placement:</strong> ' + lead.body_placement + '</p>' : ''}
              <p style="margin: 4px 0;"><strong>Preferred Date:</strong> ${lead.requested_date}</p>
            </div>
            <p style="margin-top: 20px; padding: 12px; background: #16213e; border-radius: 8px; border-left: 4px solid #c9a87c;">
              <strong>What's next?</strong> We'll reach out via phone or email to confirm your consultation and finalize the design details.
            </p>
            <p style="margin-top: 20px; color: #888;">Questions? Call us at <strong>(555) 123-4567</strong></p>
            <p style="color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #333; padding-top: 12px;">Savana Tattoos &mdash; 123 Ink Avenue, Suite 4</p>
          </div>
        </div>
      `;

      let clientFailed = false;
      if (lead.email) {
        try {
          await resend.emails.send({
            from: fromEmail, to: lead.email,
            subject: 'Your tattoo inquiry has been received!',
            html
          });
        } catch (err) { console.error('[SEND-EMAIL] Client email failed:', err.message); clientFailed = true; }
      }

      let adminFailed = false;
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        try {
          await resend.emails.send({
            from: fromEmail, to: adminEmail,
            subject: 'New Tattoo Inquiry: ' + (lead.client_name || lead.name),
            html: `
              <div style="font-family: sans-serif; color: #222;">
                <h2 style="color: #c9a87c;">New Inquiry from ${lead.client_name || lead.name}</h2>
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                  <tr><th style="padding: 8px; border: 1px solid #eee; text-align: left;">Service</th><td style="padding: 8px; border: 1px solid #eee;">${lead.service}</td></tr>
                  <tr style="background: #f9f9f9;"><th style="padding: 8px; border: 1px solid #eee; text-align: left;">Size</th><td style="padding: 8px; border: 1px solid #eee;">${lead.size_category}</td></tr>
                  ${lead.body_placement ? '<tr><th style="padding: 8px; border: 1px solid #eee; text-align: left;">Placement</th><td style="padding: 8px; border: 1px solid #eee;">' + lead.body_placement + '</td></tr>' : ''}
                  <tr><th style="padding: 8px; border: 1px solid #eee; text-align: left;">Phone</th><td style="padding: 8px; border: 1px solid #eee;">${lead.phone}</td></tr>
                  <tr style="background: #f9f9f9;"><th style="padding: 8px; border: 1px solid #eee; text-align: left;">Email</th><td style="padding: 8px; border: 1px solid #eee;">${lead.email || 'N/A'}</td></tr>
                  <tr><th style="padding: 8px; border: 1px solid #eee; text-align: left;">Date</th><td style="padding: 8px; border: 1px solid #eee;">${lead.requested_date}</td></tr>
                  <tr style="background: #f9f9f9;"><th style="padding: 8px; border: 1px solid #eee; text-align: left;">Notes</th><td style="padding: 8px; border: 1px solid #eee;">${lead.message || 'None'}</td></tr>
                </table>
              </div>
            `
          });
        } catch (err) { console.error('[SEND-EMAIL] Admin email failed:', err.message); adminFailed = true; }
      }

      return res.status(200).json({ success: true });

    } else if (action === 'appointment-confirmed') {
      if (!email) return res.status(200).json({ success: true, skipped: true });

      const dateObj = new Date(requested_date + 'T12:00:00');
      const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const dur = parseInt(duration_minutes) || 0;
      const hrs = Math.floor(dur / 60);
      const mins = dur % 60;
      let durationStr = '';
      if (hrs > 0) durationStr += hrs + ' hr ';
      if (mins > 0 || hrs === 0) durationStr += mins + ' min';
      durationStr = durationStr.trim();

      html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
          <div style="text-align: center; padding: 20px 0; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #c9a87c; border-radius: 12px 12px 0 0;">
            <h1 style="margin: 0; font-size: 28px; letter-spacing: 3px;">SAVANA TATTOOS</h1>
            <p style="font-style: italic; color: #a8885c; margin: 8px 0 0;">Appointment Confirmed!</p>
          </div>
          <div style="padding: 25px; background: #1a1a2e; color: #e0e0e0; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px;">Hi <strong>${owner_name}</strong>,</p>
            <p>Your tattoo appointment has been confirmed. Here are the details:</p>
            <div style="background: #16213e; padding: 20px; border-radius: 8px; margin: 16px 0; border-left: 3px solid #c9a87c;">
              <p style="margin: 4px 0;"><strong>Date:</strong> ${formattedDate}</p>
              <p style="margin: 4px 0;"><strong>Time:</strong> ${formatTime12(confirmed_time)}</p>
              <p style="margin: 4px 0;"><strong>Service:</strong> ${service}</p>
              ${body_placement ? '<p style="margin: 4px 0;"><strong>Placement:</strong> ' + body_placement + '</p>' : ''}
              <p style="margin: 4px 0;"><strong>Duration:</strong> ${durationStr}</p>
            </div>
            <p style="margin-top: 16px;"><strong>Please arrive 10 minutes early</strong> so we can go over your design and prepare the studio.</p>
            <p style="margin-top: 16px;">Need to reschedule? Call <strong>(555) 123-4567</strong>.</p>
            <p style="margin-top: 20px; color: #c9a87c; font-weight: bold;">See you soon &mdash; The Savana Tattoos Team</p>
            <p style="color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #333; padding-top: 12px;">Savana Tattoos &mdash; 123 Ink Avenue, Suite 4 &mdash; Open Tue&ndash;Sat 11am&ndash;7pm</p>
          </div>
        </div>
      `;

      await resend.emails.send({ from: fromEmail, to: email, subject: 'Your tattoo appointment is confirmed!', html });
      console.log('[SEND-EMAIL] Confirmation sent to ' + email);
      return res.status(200).json({ success: true, emailSent: true });

    } else {
      return res.status(400).json({ error: 'Unknown action: ' + action });
    }

  } catch (err) {
    console.error('[SEND-EMAIL] Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
