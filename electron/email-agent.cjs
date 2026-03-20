'use strict'

const nodemailer = require('nodemailer')

async function sendEmail({ to, subject, body, auth }) {
    // auth can contain { user, pass }
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail', // or other
            auth: {
                user: auth?.user,
                pass: auth?.pass
            }
        })

        const mailOptions = {
            from: auth?.user,
            to,
            subject,
            text: body
        }

        const info = await transporter.sendMail(mailOptions)
        return { ok: true, messageId: info.messageId }
    } catch (error) {
        console.error('Email error:', error)
        return { ok: false, reason: error.message }
    }
}

module.exports = { sendEmail }
