// scripts/send-test-email.js
require("dotenv").config();
const nodemailer = require("nodemailer");

(async () => {
  const transport = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.EMAIL_PORT || 465),
    secure: Number(process.env.EMAIL_PORT || 465) === 465,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
  });

  try {
    await transport.verify();
    console.log("SMTP verify: OK");
    await transport.sendMail({
      to: process.env.EMAIL_USER,
      from: process.env.EMAIL_FROM,
      subject: "Test Mail from My-FridgeAI",
      text: "This is a test email.",
    });
    console.log("Test email sent.");
  } catch (err) {
    console.error("Test email error:", err);
  }
})();
