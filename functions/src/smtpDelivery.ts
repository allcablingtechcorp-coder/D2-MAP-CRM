import nodemailer from "nodemailer";
import {readFile} from "node:fs/promises";
import {buildAccessEmail,type AccessEmailInput} from "./accessEmailTemplate.js";

// Password is supplied by Secret Manager on the three email-sending functions.
// No user-provided SMTP hosts, headers, recipients or attachment paths are accepted.
export async function sendBrandedAccessEmail(input:AccessEmailInput) {
  const password=process.env.CRM_SMTP_PASSWORD;
  if(!password)throw new Error("EMAIL_SMTP_NOT_CONFIGURED");
  const mail=buildAccessEmail(input);
  const attachments=await Promise.all(mail.assets.map(async asset=>({
    filename:asset.file,content:await readFile(new URL(`../assets/${asset.file}`,import.meta.url)),cid:asset.cid,contentType:"image/png",contentDisposition:"inline" as const,
  })));
  const transport=nodemailer.createTransport({
    host:"smtp.hostinger.com",port:465,secure:true,
    auth:{user:"support@d2smarthome.com",pass:password},
    tls:{minVersion:"TLSv1.2",rejectUnauthorized:true},
    connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,
    logger:false,debug:false,
  });
  try{
    const result=await transport.sendMail({
      from:{name:"D2 Group",address:"support@d2smarthome.com"},
      replyTo:"support@d2smarthome.com",to:{address:input.recipient,name:""},
      subject:mail.subject,html:mail.html,text:mail.text,attachments,
      disableFileAccess:true,disableUrlAccess:true,
    });
    if(!result.accepted.length||result.rejected.length)throw new Error("EMAIL_RECIPIENT_REJECTED");
  }finally{transport.close();}
}
