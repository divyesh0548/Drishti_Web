import nodemailer from "nodemailer";

function smtpPort() {
  const parsed = Number(process.env.SMTP_PORT ?? "587");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 587;
}

export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort(),
    secure: smtpPort() === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendTempPasswordEmail(input: {
  to: string;
  name: string;
  tempPassword: string;
}) {
  if (!isSmtpConfigured()) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS to email the temporary password.");
  }

  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Drishti";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || `noreply@localhost`;

  await createTransport().sendMail({
    from,
    to: input.to,
    subject: `${appName} temporary password`,
    text: [
      `Hi ${input.name},`,
      "",
      `An account was created for you on ${appName}.`,
      `Sign in at ${appUrl}/login with this temporary password:`,
      "",
      input.tempPassword,
      "",
      "You will be asked to set a new password before you can use the workspace.",
    ].join("\n"),
    html: `
      <p>Hi ${input.name},</p>
      <p>An account was created for you on ${appName}.</p>
      <p>Sign in at <a href="${appUrl}/login">${appUrl}/login</a> with this temporary password:</p>
      <p><strong>${input.tempPassword}</strong></p>
      <p>You will be asked to set a new password before you can use the workspace.</p>
    `,
  });
}
