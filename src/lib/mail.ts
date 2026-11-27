type Mail = { to: string; subject: string; text: string };

export function isMailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export async function sendMail(message: Mail) {
  if (!isMailConfigured()) {
    console.info("[r5] mail (sin SMTP):", message.to, message.subject);
    return { sent: false };
  }

  try {
    const nodemailer = await import("nodemailer");
    const port = Number(process.env.SMTP_PORT || 587);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return { sent: true };
  } catch (error) {
    console.error("[r5] no se pudo enviar el mail", error);
    return { sent: false };
  }
}