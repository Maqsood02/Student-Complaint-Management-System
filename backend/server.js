const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.EMAIL_SERVICE_PORT || 5001;

app.use(cors());
app.use(bodyParser.json());

// Department Email Mapping
const departmentEmails = {
    'Hostel': 'hostel@college.com',
    'Transport': 'transport@college.com',
    'Academics': 'academics@college.com',
    'Library': 'library@college.com',
    'Technical': 'techsupport@college.com',
    'Cafeteria': 'cafeteria@college.com',
    'Classroom Maintenance': 'saimaanjum.fet.scst.cse@gmu.ac.in, maqsoodmd.ac.in@gmail.com, chinmaykv555@gmail.com',
    'Other': 'maqsoodmd.ac.in@gmail.com' // Changed default to your email for testing
};

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// --- HTML Email Templates ---

const getOTPTemplate = (data) => `
<div style="background-color: #f1f5f9; padding: 50px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
        <div style="background: #6366f1; padding: 40px; text-align: center;">
            <div style="background: rgba(255,255,255,0.2); width: 60px; height: 60px; border-radius: 18px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 30px; color: white;">🔑</span>
            </div>
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">${data.category === 'Security' ? 'Security Code' : 'Verification Code'}</h1>
        </div>
        <div style="padding: 40px; text-align: center;">
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">Hello <strong style="color: #1e293b;">${data.studentName || 'Student'}</strong>,<br>Use the code below to complete your ${data.category === 'Security' ? 'password reset' : 'registration'}:</p>
            
            <div style="background: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 16px; padding: 25px; margin-bottom: 30px;">
                <span style="font-size: 42px; font-weight: 800; color: #6366f1; letter-spacing: 12px; font-family: 'Courier New', Courier, monospace;">${data.otp || '000000'}</span>
            </div>
            
            <p style="color: #94a3b8; font-size: 14px; margin: 0;">This code will expire in 10 minutes. If you didn't request this, please ignore this email.</p>
        </div>
        <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 12px; color: #cbd5e1; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">SCMS Student Management System</p>
        </div>
    </div>
</div>
`;

const getStudentEmailTemplate = (data) => `
<div style="background-color: #0f172a; padding: 40px 20px; font-family: 'Inter', sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 24px; border: 1px solid #334155; overflow: hidden; color: #f8fafc;">
        <div style="background: #4f46e5; padding: 40px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #e0e7ff;">Complaint Registered</h2>
            <p style="margin: 10px 0 0 0; color: #c7d2fe; font-size: 14px;">Complaint ID: ${data.complaintId}</p>
        </div>
        <div style="padding: 40px;">
            <p style="color: #94a3b8; line-height: 1.6;">Hello ${data.studentName}, your request has been successfully queued for review by the administrative team.</p>
            <div style="background: #0f172a; border: 1px solid #334155; border-radius: 16px; padding: 24px; margin: 30px 0;">
                <table style="width: 100%; border-collapse: collapse; color: #f8fafc;">
                    <tr><td style="padding: 10px 0; color: #64748b; font-size: 14px;">Subject</td><td style="padding: 10px 0; font-weight: 600;">${data.title}</td></tr>
                    <tr><td style="padding: 10px 0; color: #64748b; font-size: 14px;">Category</td><td style="padding: 10px 0; font-weight: 600;">${data.category}</td></tr>
                </table>
            </div>
            <div style="text-align: center;">
                <a href="#" style="display: inline-block; background: #4f46e5; color: white; padding: 14px 28px; border-radius: 14px; text-decoration: none; font-weight: 600; font-size: 15px;">Track Live Status</a>
            </div>
        </div>
    </div>
</div>
`;

const getDeptEmailTemplate = (data) => `
<div style="background-color: #0f172a; padding: 60px 20px; font-family: 'Inter', system-ui, sans-serif; color: #f8fafc;">
    <div style="max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 32px; border: 1px solid #ef4444; overflow: hidden; box-shadow: 0 0 40px rgba(239, 68, 68, 0.2);">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); padding: 50px 40px; text-align: center; color: white;">
            <div style="background: rgba(255,255,255,0.2); width: 60px; height: 60px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                <span style="font-size: 30px;">🔔</span>
            </div>
            <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.03em;">New Priority Alert</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Department Action Required: ${data.category}</p>
        </div>
        <div style="padding: 40px;">
            <p style="font-size: 18px; font-weight: 600; color: #ffffff; margin-top: 0;">Attention Administrator,</p>
            <p style="color: #94a3b8; line-height: 1.6; font-size: 15px;">A student has just submitted a high-priority complaint. Please review the details below and take necessary action.</p>
            
            <div style="background: #0f172a; border-radius: 20px; padding: 30px; margin: 30px 0; border: 1px solid #334155;">
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <tr><td style="color: #64748b; font-size: 13px; padding-bottom: 5px; text-transform: uppercase;">From Student</td></tr>
                    <tr><td style="color: #ffffff; font-size: 16px; font-weight: 700; padding-bottom: 15px; border-bottom: 1px solid #334155;">${data.studentName}</td></tr>
                    
                    <tr><td style="color: #64748b; font-size: 13px; padding: 15px 0 5px 0; text-transform: uppercase;">Subject</td></tr>
                    <tr><td style="color: #ffffff; font-size: 16px; font-weight: 700; padding-bottom: 15px; border-bottom: 1px solid #334155;">${data.title}</td></tr>
                </table>
                
                <div style="margin-top: 20px; padding: 20px; background: rgba(239, 68, 68, 0.05); border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.2);">
                    <p style="margin: 0; color: #fecaca; font-style: italic; font-size: 15px; line-height: 1.6;">"${data.description}"</p>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 40px;">
                <a href="http://localhost:5000" style="display: inline-block; background: #ef4444; color: white; padding: 18px 36px; border-radius: 16px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 10px 20px rgba(239, 68, 68, 0.3);">Open Admin Panel</a>
            </div>
            
            <p style="text-align: center; color: #475569; font-size: 12px; margin-top: 40px;">SCMS Automated Notification System &bull; Confidential</p>
        </div>
    </div>
</div>
`;

// API Endpoint to send emails
const getStudentReplyTemplate = (data) => {
    let statusConfig = {
        icon: '📫',
        headline: 'Complaint Update',
        sub: 'An administrator has responded to your complaint.',
        color: '#6366f1'
    };

    if (data.status === 'Resolved') {
        statusConfig = { icon: '✅', headline: 'Complaint Resolved', sub: 'Great news! Your issue has been marked as resolved.', color: '#10b981' };
    } else if (data.status === 'In Progress') {
        statusConfig = { icon: '⏳', headline: 'In Progress', sub: 'Work has officially started on your complaint.', color: '#f59e0b' };
    }

    return `
<div style="background-color: #f8fafc; padding: 60px 20px; font-family: 'Inter', system-ui, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
        <div style="background: linear-gradient(135deg, ${statusConfig.color} 0%, #1e293b 100%); padding: 40px; text-align: center; color: white;">
            <div style="font-size: 50px; margin-bottom: 15px;">${statusConfig.icon}</div>
            <h1 style="margin: 0; font-size: 26px; font-weight: 800;">${statusConfig.headline}: ${data.complaintId}</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${statusConfig.sub}</p>
        </div>
        <div style="padding: 40px;">
            <p style="font-size: 16px; color: #1e293b; font-weight: 600;">Hello ${data.studentName},</p>
            <p style="color: #64748b; line-height: 1.6;">Your complaint regarding "<strong>${data.title}</strong>" has been updated to: <span style="background: ${statusConfig.color}15; color: ${statusConfig.color}; padding: 4px 10px; border-radius: 20px; font-weight: 700; font-size: 12px; border: 1px solid ${statusConfig.color}30;">${data.status}</span></p>
            
            <div style="background: #f1f5f9; border-left: 4px solid ${statusConfig.color}; padding: 25px; margin: 30px 0; border-radius: 0 16px 16px 0;">
                <p style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 800; letter-spacing: 0.05em;">Admin Message:</p>
                <p style="margin: 0; color: #1e293b; line-height: 1.6; font-style: italic;">"${data.adminReply}"</p>
            </div>
            
            <div style="text-align: center; margin-top: 40px;">
                <a href="http://localhost:5000" style="display: inline-block; background: ${statusConfig.color}; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">Track Progress</a>
            </div>
        </div>
        <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 12px; color: #94a3b8;">SCMS | Student Complaint Management System</p>
        </div>
    </div>
</div>
`;
};

app.post('/api/send-email', async (req, res) => {
    const { studentEmail, studentName, category, title, description, complaintId, dept } = req.body;

    console.log(`--- [EMAIL SERVICE] Request for ${studentEmail} (${category}${dept ? ' - ' + dept : ''}) ---`);

    if (!studentEmail || !complaintId) {
        console.error("--- [EMAIL SERVICE] ERROR: Missing data ---");
        return res.status(400).json({ success: false, message: 'Missing required data' });
    }

    if (process.env.EMAIL_USER === 'your-email@gmail.com') {
        console.warn("--- [EMAIL SERVICE] WARNING: Credentials not configured in .env ---");
    }

    const isReset = category === "Security" || complaintId === "RESET-PWD";

    try {
        // --- CASE 1: Password Reset / Security Mail ---
        if (isReset) {
            if (studentEmail === 'admin@scms.edu') {
                console.log("--- [EMAIL SERVICE] BLOCKED: Admin attempted password reset via email ---");
                return res.json({
                    success: false,
                    message: "Security Policy: Admin password resets are restricted."
                });
            }

            console.log(`--- [EMAIL SERVICE] Sending Security Code to student: ${studentEmail} ---`);
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: studentEmail,
                subject: `Security Code: ${req.body.otp}`,
                html: getOTPTemplate(req.body)
            });
            console.log("--- [EMAIL SERVICE] SUCCESS: Security Reset Code Sent ---");
            return res.json({ success: true, message: 'Security code sent' });
        }

        // --- CASE 2: Account Verification Code (Registration) ---
        if (category === "Verification") {
            const otp = req.body.otp || "000000";

            console.log(`--- [EMAIL SERVICE] Sending OTP ${otp} to ${studentEmail} ---`);

            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: studentEmail,
                subject: `Verification Code: ${otp}`,
                html: getOTPTemplate(req.body)
            });
            console.log("--- [EMAIL SERVICE] SUCCESS: OTP Sent ---");
            return res.json({ success: true, message: 'Verification email sent' });
        }

        // --- CASE 3: ADMIN REPLY TO STUDENT ---
        if (req.body.adminReply) {
            console.log(`--- [EMAIL SERVICE] Sending Admin Reply alert to student: ${studentEmail} ---`);
            const html = getStudentReplyTemplate(req.body);
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: studentEmail,
                subject: `Update on your Complaint: ${complaintId}`,
                html: html
            });
            return res.json({ success: true, message: 'Student reply email sent' });
        }

        // --- CASE 4: Regular Complaint Submission Alert ---
        console.log(`--- [EMAIL SERVICE] Sending Complaint Alert for ${complaintId} ---`);

        // Custom Routing for CSE Department
        let deptEmail = departmentEmails[category] || departmentEmails['Other'];
        if (dept === 'CSE') {
            deptEmail = 'saimaanjum.fet.scst.cse@gmu.ac.in, maqsoodmd.ac.in@gmail.com, chinmaykv555@gmail.com';
            console.log("--- [EMAIL SERVICE] ROUTING: Multi-recipient CSE alert triggered ---");
        }

        console.log(`--- [EMAIL SERVICE] Alert will be sent to: ${deptEmail} ---`);

        // 1. Send confirmation to student
        if (category !== "Security") {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: studentEmail,
                subject: `Complaint Received: ${complaintId}`,
                html: getStudentEmailTemplate(req.body)
            });
        }

        // 2. Send alert to department
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: deptEmail,
            subject: `New Complaint Alert: ${category} - ${complaintId}`,
            html: getDeptEmailTemplate(req.body)
        });

        console.log("--- [EMAIL SERVICE] SUCCESS: Complaint Alert Emails Sent ---");
        res.json({ success: true, message: 'Complaint emails sent successfully' });
    } catch (error) {
        console.error('--- [EMAIL SERVICE] NODEMAILER ERROR ---');
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to send emails' });
    }
});

app.listen(PORT, () => {
    console.log(`Email service running on port ${PORT}`);
});
