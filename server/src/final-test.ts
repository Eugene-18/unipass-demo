import nodemailer from 'nodemailer';

async function runFinalHardcodedTest(): Promise<void> {
  // Hardcoded credentials: manually fill these two fields before running.
  const user = 'chloewu107@gmail.com';
  const pass = 'wwfxdtryemipmqgq';

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    logger: true,
    debug: true,
  });

  console.log('[final-test] Starting SMTP verification...');
  await transporter.verify();
  console.log('[final-test] SMTP verification passed.');

  const mailOptions = {
    from: user,
    to: user,
    subject: 'UniPass Final Hardcoded Test',
    html: `
      <h2>UniPass Mail Final Test</h2>
      <p>If you received this message, SMTP works on port 587 with TLS.</p>
      <p>Time: ${new Date().toISOString()}</p>
    `,
    text: `UniPass Mail Final Test\nTime: ${new Date().toISOString()}`,
  };

  console.log('[final-test] Sending email to self...');

  await new Promise<void>((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('[final-test] sendMail error object:', error);
        return reject(error);
      }

      console.log('[final-test] sendMail success response:', info.response);
      console.log('[final-test] info.envelope:', info.envelope);
      console.log('[final-test] info.messageId:', info.messageId);
      resolve();
    });
  });

  console.log('腳本執行完畢，請檢查信箱');
}

runFinalHardcodedTest().catch((error) => {
  console.error('[final-test] Fatal error:', error);
  process.exitCode = 1;
});
