import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";
import { google } from "googleapis";
import { JWT } from "google-auth-library";

// Setup Google Auth
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],

});

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;
const SHEET_NAME = "Account"; // Make sure this matches your tab name

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, service } = req.body;

  if (!email || !service) {
    return res.status(400).json({ message: "Missing email or service" });
  }

  try {
    // Authenticate with Google Sheets
    const authClient = (await auth.getClient()) as JWT;
    const sheets = google.sheets({ version: "v4", auth: authClient });

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:A`, // Assuming emails are in column A
    });

    const rows = result.data.values || [];
    const authorizedEmails = rows.flat()
      .filter(e => e && typeof e === "string")
      .map(e => e.trim().toLowerCase());

    const submittedEmail = email.trim().toLowerCase();

    console.log("🟢 Authorized Emails from Sheet:", authorizedEmails);
    console.log("🔵 Submitted Email:", submittedEmail);

    if (!authorizedEmails.includes(submittedEmail)) {
      console.warn("🚫 Unauthorized email:", submittedEmail);
      return res.status(403).json({ message: "Email not authorized" });
    }

    // Email transport
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: "muhd.hanif9991@gmail.com",
      subject: "New Service Desk Request",
      text: `Service Requested: ${service}\nEmail: ${submittedEmail}`,
    });

    return res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("❗ Server error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
