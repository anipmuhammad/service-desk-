import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';

const SHEET_NAME = 'Sheet1';
const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

export async function POST(req: Request) {
  const body = await req.json();
  const { email, service } = body;

  if (!email || !service) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  try {
    // ✅ Authenticate
    const authClient = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // ✅ Fetch emails and names (A:B)
    const sheetRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:B`, // skip header row
    });

    const rows = sheetRes.data.values || [];
    const submittedEmail = email.trim().toLowerCase();

    // ✅ Find matching email and name
    const match = rows.find(row => row[0]?.trim().toLowerCase() === submittedEmail);
    if (!match) {
      return NextResponse.json({ error: 'Email not authorized' }, { status: 403 });
    }

    const userName = match[1] || 'Unknown User';

    // ✅ Send email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER!,
        pass: process.env.EMAIL_PASS!,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'muhd.hanif9991@gmail.com',
      subject: `New IT Service Request from ${userName}`,
      text: `A new request has been submitted.\n\nName: ${userName}\nEmail: ${email}\nService: ${service}`,
    };

    await transporter.sendMail(mailOptions);

    // ✅ Append data to Sheet2 (A: Timestamp, B: Service, C: Email, D: Name)
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet2!A:D',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' }),
          service,
          email,
          userName,
        ]],
      },
    });

    return NextResponse.json({ message: 'Email sent and request logged successfully' });

  } catch (error) {
    console.error('❗ Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
