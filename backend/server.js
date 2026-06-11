const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.EMAIL_SERVICE_PORT || 5001;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Department Email Mapping
const adminEmails = 'saimaanjum.fet.scst.cse@gmu.ac.in, maqsoodmd.ac.in@gmail.com, chinmaykv555@gmail.com, ravinandanjannu.fet.scst.cse@gmu.ac.in, shalinimr.fet.scst.cse@gmu.ac.in, ranjithaj.fet.scst.cse@gmu.ac.in';

const departmentEmails = {
    'Hostel': 'hostel@college.com',
    'Transport': 'transport@college.com',
    'Academics': 'academics@college.com',
    'Library': 'library@college.com',
    'Technical': 'techsupport@college.com',
    'Cafeteria': 'cafeteria@college.com',
    'Classroom Maintenance': adminEmails,
    'Other': 'maqsoodmd.ac.in@gmail.com' // Changed default to your email for testing
};

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
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

const getStudentEmailTemplate = (data) => {
    const siteUrl = data.siteUrl || "http://localhost:5000";
    return `
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
                ${data.hasImage ? `
                <div style="margin-top: 20px; text-align: center; border-top: 1px solid #334155; padding-top: 20px;">
                    <p style="color: #64748b; font-size: 12px; text-transform: uppercase; margin-bottom: 12px; font-weight: 700; letter-spacing: 0.05em;">Attached Evidence Preview</p>
                    <img src="cid:evidenceImage" style="max-width: 100%; max-height: 250px; border-radius: 12px; border: 1px solid #334155;" alt="Evidence Preview" />
                </div>
                ` : ''}
                ${data.hasPdf ? `
                <div style="margin-top: 20px; text-align: center; border-top: 1px solid #334155; padding-top: 20px;">
                    <p style="color: #64748b; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; font-weight: 700; letter-spacing: 0.05em;">Documentary Evidence</p>
                    <span style="color: #10b981; font-weight: 600; font-size: 14px;"><span style="font-size: 18px;">📎</span> PDF Document Attached</span>
                </div>
                ` : ''}
            </div>
            <div style="text-align: center;">
                <a href="${siteUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 14px 28px; border-radius: 14px; text-decoration: none; font-weight: 600; font-size: 15px;">Track Live Status</a>
            </div>
        </div>
    </div>
</div>
`;
};

const getDeptEmailTemplate = (data) => {
    const siteUrl = data.siteUrl || "http://localhost:5000";
    return `
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
                
                ${data.hasImage ? `
                <div style="margin-top: 25px; text-align: center; border-top: 1px solid #334155; padding-top: 20px;">
                    <p style="color: #64748b; font-size: 12px; text-transform: uppercase; margin-bottom: 12px; font-weight: 700; letter-spacing: 0.05em;">Attached Evidence Preview</p>
                    <img src="cid:evidenceImage" style="max-width: 100%; max-height: 250px; border-radius: 12px; border: 1px solid #334155;" alt="Evidence Preview" />
                </div>
                ` : ''}
                ${data.hasPdf ? `
                <div style="margin-top: 25px; text-align: center; border-top: 1px solid #334155; padding-top: 20px;">
                    <p style="color: #64748b; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; font-weight: 700; letter-spacing: 0.05em;">Documentary Evidence</p>
                    <span style="color: #ef4444; font-weight: 600; font-size: 14px;"><span style="font-size: 18px;">📎</span> PDF Document Attached</span>
                </div>
                ` : ''}
            </div>
            
            <div style="text-align: center; margin-top: 40px;">
                <a href="${siteUrl}" style="display: inline-block; background: #ef4444; color: white; padding: 18px 36px; border-radius: 16px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 10px 20px rgba(239, 68, 68, 0.3);">Open Admin Panel</a>
            </div>
            
            <p style="text-align: center; color: #475569; font-size: 12px; margin-top: 40px;">SCMS Automated Notification System &bull; Confidential</p>
        </div>
    </div>
</div>
`;
};

// API Endpoint to send emails
const getStudentReplyTemplate = (data) => {
    const siteUrl = data.siteUrl || "http://localhost:5000";
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

    const hasEvidence = !!(data.hasWorkerEvidence && data.status === 'Resolved');
    console.log("--- [EMAIL SERVICE] getStudentReplyTemplate debug ---");
    console.log("data.status:", data.status);
    console.log("data.hasWorkerEvidence:", data.hasWorkerEvidence);
    console.log("hasEvidence:", hasEvidence);
    console.log("workerNotes present:", !!data.workerNotes);
    console.log("workerEvidence length:", data.workerEvidence ? data.workerEvidence.length : 0);

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

            ${hasEvidence ? `
            <!-- Worker Proof of Work Evidence -->
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 24px; margin: 0 0 30px 0;">
                <p style="margin: 0 0 6px 0; font-size: 12px; text-transform: uppercase; color: #16a34a; font-weight: 800; letter-spacing: 0.06em; display: flex; align-items: center; gap: 6px;">
                    🔍 Worker Proof of Work
                </p>
                ${data.workerNotes ? `<p style="margin: 0 0 16px 0; color: #166534; font-size: 14px; font-style: italic; line-height: 1.5;">&ldquo;${data.workerNotes}&rdquo;</p>` : ''}
                <div style="text-align: center; border-top: 1px solid #bbf7d0; padding-top: 16px;">
                    <p style="margin: 0 0 10px 0; font-size: 11px; text-transform: uppercase; color: #4ade80; font-weight: 700; letter-spacing: 0.05em;">Submitted Evidence Preview</p>
                    <img src="cid:workerEvidenceImage" style="max-width: 100%; max-height: 300px; border-radius: 12px; border: 2px solid #bbf7d0; box-shadow: 0 4px 12px rgba(16,185,129,0.15);" alt="Proof of Work" />
                </div>
            </div>
            ` : ''}
            
            <div style="text-align: center; margin-top: 40px;">
                <a href="${siteUrl}" style="display: inline-block; background: ${statusConfig.color}; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">Track Progress</a>
            </div>
        </div>
        <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 12px; color: #94a3b8;">SCMS | Student Complaint Management System</p>
        </div>
    </div>
</div>
`;
};

const getEmployeeCredentialsTemplate = (data) => {
    const siteUrl = data.siteUrl || "http://localhost:5000";
    return `
<div style="background-color: #f1f5f9; padding: 50px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
        <div style="background: #10b981; padding: 40px; text-align: center;">
            <div style="background: rgba(255,255,255,0.2); width: 60px; height: 60px; border-radius: 18px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 30px; color: white;">👔</span>
            </div>
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">Welcome to SCMS</h1>
        </div>
        <div style="padding: 40px; text-align: left; color: #334155;">
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Hello <strong>${data.employeeName}</strong>,<br>Your Employee account has been successfully created by the Administrator. You can now log in using the credentials below:</p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin-bottom: 20px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 6px 0; color: #64748b; font-size: 14px;">Employee ID</td><td style="padding: 6px 0; font-weight: 600; color: #10b981;">${data.employeeId || 'N/A'}</td></tr>
                    <tr><td style="padding: 6px 0; color: #64748b; font-size: 14px;">Portal URL</td><td style="padding: 6px 0; font-weight: 600;"><a href="${siteUrl}" style="color: #10b981; text-decoration: none;">SCMS Portal</a></td></tr>
                    <tr><td style="padding: 6px 0; color: #64748b; font-size: 14px;">Email</td><td style="padding: 6px 0; font-weight: 600;">${data.employeeEmail}</td></tr>
                    <tr><td style="padding: 6px 0; color: #64748b; font-size: 14px;">Password</td><td style="padding: 6px 0; font-weight: 600; font-family: monospace; font-size: 15px;">${data.employeePassword}</td></tr>
                </table>
            </div>
            <p style="color: #64748b; font-size: 13px; margin: 0; line-height: 1.5;">Please log in and update your password immediately from your profile security settings.</p>
        </div>
        <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 12px; color: #cbd5e1; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">SCMS Employee Management</p>
        </div>
    </div>
</div>
`;
};

const getWorkerAssignmentTemplate = (data) => {
    const siteUrl = data.siteUrl || "http://localhost:5000";
    const formattedDeadline = data.deadline ? new Date(data.deadline).toLocaleString() : 'Not Specified';
    return `
<div style="background-color: #f1f5f9; padding: 50px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
        <div style="background: #3b82f6; padding: 40px; text-align: center; color: white;">
            <div style="background: rgba(255,255,255,0.2); width: 60px; height: 60px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                <span style="font-size: 30px;">📋</span>
            </div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 800;">New Task Assigned</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 15px;">Complaint ID: ${data.complaintId}</p>
        </div>
        <div style="padding: 40px; color: #334155; text-align: left;">
            <p style="font-size: 16px; font-weight: 600; margin-top: 0;">Hello ${data.employeeName},</p>
            <p style="line-height: 1.6; font-size: 15px;">An administrator has assigned you to resolve the following complaint.</p>
            
            <div style="background: #f8fafc; border-radius: 16px; padding: 25px; margin: 25px 0; border: 1px solid #e2e8f0;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="color: #64748b; font-size: 13px; padding-bottom: 5px; text-transform: uppercase;">Subject</td></tr>
                    <tr><td style="color: #1e293b; font-size: 15px; font-weight: 700; padding-bottom: 15px; border-bottom: 1px solid #e2e8f0;">${data.title}</td></tr>
                    
                    <tr><td style="color: #64748b; font-size: 13px; padding: 15px 0 5px 0; text-transform: uppercase;">Category</td></tr>
                    <tr><td style="color: #1e293b; font-size: 15px; font-weight: 700; padding-bottom: 15px; border-bottom: 1px solid #e2e8f0;">${data.category}</td></tr>

                    <tr><td style="color: #64748b; font-size: 13px; padding: 15px 0 5px 0; text-transform: uppercase;">Resolution Deadline</td></tr>
                    <tr><td style="color: #ef4444; font-size: 15px; font-weight: 700; padding-bottom: 15px;">${formattedDeadline}</td></tr>
                </table>
                
                <div style="margin-top: 15px; padding: 15px; background: rgba(59, 130, 246, 0.05); border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.2);">
                    <p style="margin: 0; color: #2563eb; font-style: italic; font-size: 14px; line-height: 1.6;">"${data.description}"</p>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
                <a href="${siteUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);">Open Worker Portal</a>
            </div>
        </div>
    </div>
</div>
`;
};

const getAdminStatusNotificationTemplate = (data) => {
    const siteUrl = data.siteUrl || "http://localhost:5000";
    return `
<div style="background-color: #f1f5f9; padding: 50px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
        <div style="background: #10b981; padding: 40px; text-align: center; color: white;">
            <div style="background: rgba(255,255,255,0.2); width: 60px; height: 60px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                <span style="font-size: 30px;">🔄</span>
            </div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 800;">Complaint Status Update</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 15px;">Complaint ID: ${data.complaintId}</p>
        </div>
        <div style="padding: 40px; color: #334155; text-align: left;">
            <p style="font-size: 16px; font-weight: 600; margin-top: 0;">Attention Administrator,</p>
            <p style="line-height: 1.6; font-size: 15px;">The assigned employee (<strong>${data.employeeName}</strong>) has updated the status of a complaint.</p>
            
            <div style="background: #f8fafc; border-radius: 16px; padding: 25px; margin: 25px 0; border: 1px solid #e2e8f0;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="color: #64748b; font-size: 13px; padding-bottom: 5px; text-transform: uppercase;">Subject</td></tr>
                    <tr><td style="color: #1e293b; font-size: 15px; font-weight: 700; padding-bottom: 15px; border-bottom: 1px solid #e2e8f0;">${data.title}</td></tr>
                    
                    <tr><td style="color: #64748b; font-size: 13px; padding: 15px 0 5px 0; text-transform: uppercase;">New Status</td></tr>
                    <tr><td style="padding: 6px 0; border-bottom: 1px solid #e2e8f0;"><span style="background: #10b98115; color: #10b981; padding: 4px 10px; border-radius: 20px; font-weight: 700; font-size: 13px;">${data.status}</span></td></tr>

                    <tr><td style="color: #64748b; font-size: 13px; padding: 15px 0 5px 0; text-transform: uppercase;">Resolution Notes</td></tr>
                    <tr><td style="color: #1e293b; font-size: 14px; font-style: italic; padding-top: 6px;">"${data.adminReply || 'No comments provided.'}"</td></tr>
                </table>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
                <a href="${siteUrl}" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);">Open Admin Panel</a>
            </div>
        </div>
    </div>
</div>
`;
};

const getDeadlineOverdueTemplate = (data) => {
    const siteUrl = data.siteUrl || "http://localhost:5000";
    return `
<div style="background-color: #0f172a; padding: 40px 20px; font-family: 'Inter', system-ui, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 24px; border: 2px solid #ef4444; overflow: hidden; box-shadow: 0 0 50px rgba(239, 68, 68, 0.3);">
        <div style="background: linear-gradient(135deg, #b91c1c 0%, #ef4444 50%, #f97316 100%); padding: 40px; text-align: center;">
            <div style="background: rgba(255,255,255,0.15); width: 72px; height: 72px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; border: 2px solid rgba(255,255,255,0.3);">
                <span style="font-size: 36px;">⏰</span>
            </div>
            <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em;">DEADLINE OVERDUE</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 10px 0 0 0; font-size: 14px; font-weight: 600;">Immediate Action Required — Complaint ${data.complaintId}</p>
        </div>
        <div style="padding: 40px;">
            <div style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); border-left: 4px solid #ef4444; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
                <p style="margin: 0; color: #fca5a5; font-size: 15px; line-height: 1.6;">
                    The resolution deadline for the complaint listed below has <strong style="color: #ef4444;">expired</strong>.
                    The assigned worker has <strong>not yet submitted a resolution</strong>. Please follow up immediately.
                </p>
            </div>
            <div style="background: #0f172a; border-radius: 16px; padding: 28px; border: 1px solid #334155; margin-bottom: 28px;">
                <table style="width: 100%; border-collapse: collapse; color: #f8fafc;">
                    <tr style="border-bottom: 1px solid #1e293b;">
                        <td style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; padding: 0 0 12px 0;">Complaint Subject</td>
                    </tr>
                    <tr>
                        <td style="color: #f8fafc; font-size: 17px; font-weight: 800; padding: 12px 0 20px 0; border-bottom: 1px solid #1e293b;">${data.title}</td>
                    </tr>
                    <tr>
                        <td style="padding-top: 18px;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="color: #64748b; font-size: 12px; text-transform: uppercase; padding-bottom: 4px;">Assigned Worker</td>
                                    <td style="color: #64748b; font-size: 12px; text-transform: uppercase; padding-bottom: 4px;">Missed Deadline</td>
                                </tr>
                                <tr>
                                    <td style="color: #f8fafc; font-weight: 700; font-size: 15px; padding-right: 20px;">${data.employeeName}</td>
                                    <td style="color: #ef4444; font-weight: 700; font-size: 15px;">${data.deadline || 'Not set'}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding-top: 18px;">
                            <span style="background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); padding: 5px 14px; border-radius: 100px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">● Deadline Exceeded</span>
                        </td>
                    </tr>
                </table>
            </div>
            <div style="text-align: center;">
                <a href="${siteUrl}" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); color: white; padding: 16px 36px; border-radius: 14px; text-decoration: none; font-weight: 800; font-size: 15px; box-shadow: 0 10px 25px rgba(239, 68, 68, 0.35); letter-spacing: 0.02em;">
                    🚨 Open Admin Panel Now
                </a>
            </div>
            <p style="text-align: center; color: #475569; font-size: 12px; margin-top: 32px; margin-bottom: 0;">SCMS Automated Deadline Monitor • Do not ignore this alert</p>
        </div>
    </div>
</div>
`;
};

app.post('/api/send-email', async (req, res) => {
    const { studentEmail, studentName, category, title, description, complaintId, dept, attachedFile, employeeEmail, employeeName, employeePassword, otp } = req.body;

    const targetEmail = studentEmail || employeeEmail || (category === 'Admin Status Update' ? adminEmails : null);

    console.log(`--- [EMAIL SERVICE] Request for ${targetEmail} (${category}${dept ? ' - ' + dept : ''}) ---`);

    if (!targetEmail || !complaintId) {
        console.error("--- [EMAIL SERVICE] ERROR: Missing target email or complaintId ---");
        return res.status(400).json({ success: false, message: 'Missing target email or complaint ID' });
    }

    if (process.env.EMAIL_USER === 'your-email@gmail.com') {
        console.warn("--- [EMAIL SERVICE] WARNING: Credentials not configured in .env ---");
    }

    const isReset = category === "Security" || complaintId === "RESET-PWD";

    try {
        // --- CASE 0.1: Employee OTP Verification ---
        if (category === "Employee OTP") {
            const verificationOtp = otp || "000000";
            console.log(`--- [EMAIL SERVICE] Sending Employee OTP ${verificationOtp} to ${employeeEmail} ---`);
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: employeeEmail,
                subject: `Employee Verification Code: ${verificationOtp}`,
                html: getOTPTemplate({
                    studentName: employeeName,
                    category: 'Verification',
                    otp: verificationOtp
                })
            });
            console.log("--- [EMAIL SERVICE] SUCCESS: Employee OTP Sent ---");
            return res.json({ success: true, message: 'Employee OTP sent' });
        }

        // --- CASE 0.2: Employee Credentials ---
        if (category === "Employee Credentials") {
            console.log(`--- [EMAIL SERVICE] Sending Credentials to Employee: ${employeeEmail} ---`);
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: employeeEmail,
                subject: `Your SCMS Employee Account Details`,
                html: getEmployeeCredentialsTemplate(req.body)
            });
            console.log("--- [EMAIL SERVICE] SUCCESS: Credentials Email Sent ---");
            return res.json({ success: true, message: 'Credentials email sent' });
        }

        // --- CASE 0.3: Worker Task Assignment ---
        if (category === "Worker Assignment") {
            console.log(`--- [EMAIL SERVICE] Sending Task Assignment to Employee: ${employeeEmail} ---`);
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: employeeEmail,
                subject: `SCMS Task Assignment Alert: ${complaintId}`,
                html: getWorkerAssignmentTemplate(req.body)
            });
            console.log("--- [EMAIL SERVICE] SUCCESS: Task Assignment Email Sent ---");
            return res.json({ success: true, message: 'Task assignment email sent' });
        }

        // --- CASE 0.4: Admin Status Update Alert (from Employee) ---
        if (category === "Admin Status Update") {
            console.log(`--- [EMAIL SERVICE] Sending Status Update Alert to Admins: ${adminEmails} ---`);
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: adminEmails,
                subject: `SCMS Status Update Alert: ${complaintId} (${req.body.status})`,
                html: getAdminStatusNotificationTemplate(req.body)
            });
            console.log("--- [EMAIL SERVICE] SUCCESS: Status Update Alert Email Sent to Admins ---");
            return res.json({ success: true, message: 'Admin status update email sent' });
        }

        // --- CASE 0.5: Deadline Overdue Alert ---
        if (category === "Deadline Overdue") {
            console.log(`--- [EMAIL SERVICE] Sending Deadline Overdue Alert to Admins for ${complaintId} ---`);
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: adminEmails,
                subject: `⏰ OVERDUE ALERT: Complaint ${complaintId} — Deadline Missed by ${req.body.employeeName}`,
                html: getDeadlineOverdueTemplate(req.body)
            });
            console.log("--- [EMAIL SERVICE] SUCCESS: Deadline Overdue Alert Email Sent to Admins ---");
            return res.json({ success: true, message: 'Deadline overdue alert sent' });
        }

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

        const isStatusUpdate = req.body.status !== undefined && req.body.status !== null;

        // --- CASE 3: ADMIN REPLY / STATUS UPDATE TO STUDENT ---
        if (isStatusUpdate || req.body.adminReply) {
            console.log(`--- [EMAIL SERVICE] Sending Admin Reply/Status Update alert to student: ${studentEmail} ---`);

            // Parse worker evidence if present (base64 data URL or raw base64)
            const workerEvidenceRaw = req.body.workerEvidence;
            const replyAttachments = [];
            let hasWorkerEvidence = false;

            if (workerEvidenceRaw && typeof workerEvidenceRaw === 'string') {
                const cleanRaw = workerEvidenceRaw.replace(/[\r\n\s]/g, '');
                if (cleanRaw.startsWith('data:')) {
                    const matches = cleanRaw.match(/^data:([^;]+);base64,([\s\S]+)$/);
                    if (matches && matches.length === 3) {
                        const contentType = matches[1];
                        const base64Data = matches[2];
                        const extension = contentType.split('/')[1] || 'jpg';
                        replyAttachments.push({
                            filename: `proof_of_work.${extension}`,
                            content: Buffer.from(base64Data, 'base64'),
                            contentType: contentType,
                            cid: 'workerEvidenceImage'
                        });
                        hasWorkerEvidence = true;
                        console.log(`--- [EMAIL SERVICE] Worker evidence attached (${contentType}) ---`);
                    }
                } else if (cleanRaw.length > 50) {
                    // Try to treat it as raw base64 jpeg
                    replyAttachments.push({
                        filename: 'proof_of_work.jpg',
                        content: Buffer.from(cleanRaw, 'base64'),
                        contentType: 'image/jpeg',
                        cid: 'workerEvidenceImage'
                    });
                    hasWorkerEvidence = true;
                    console.log(`--- [EMAIL SERVICE] Raw base64 worker evidence attached ---`);
                }
            }

            const html = getStudentReplyTemplate({ ...req.body, hasWorkerEvidence });
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: studentEmail,
                subject: `Update on your Complaint: ${complaintId}`,
                html: html,
                attachments: replyAttachments
            });
            console.log(`--- [EMAIL SERVICE] SUCCESS: Admin Reply Email Sent to ${studentEmail} (evidence: ${hasWorkerEvidence}) ---`);
            return res.json({ success: true, message: 'Student reply email sent' });
        }

        // --- CASE 4: Regular Complaint Submission Alert ---
        console.log(`--- [EMAIL SERVICE] Sending Complaint Alert for ${complaintId} ---`);

        // Custom Routing for CSE Department
        let deptEmail = departmentEmails[category] || departmentEmails['Other'];
        if (dept === 'CSE') {
            deptEmail = adminEmails;
            console.log("--- [EMAIL SERVICE] ROUTING: Multi-recipient CSE alert triggered ---");
        }

        console.log(`--- [EMAIL SERVICE] Alert will be sent to: ${deptEmail} ---`);

        // Parse attachments
        const attachments = [];
        let hasImage = false;
        let hasPdf = false;

        if (attachedFile) {
            if (attachedFile.startsWith('data:')) {
                const matches = attachedFile.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                if (matches && matches.length === 3) {
                    const contentType = matches[1];
                    const base64Data = matches[2];
                    const isPdf = contentType === 'application/pdf';
                    const extension = isPdf ? 'pdf' : (contentType.split('/')[1] || 'png');
                    
                    if (isPdf) {
                        attachments.push({
                            filename: `evidence.pdf`,
                            content: Buffer.from(base64Data, 'base64'),
                            contentType: 'application/pdf'
                        });
                        hasPdf = true;
                    } else {
                        attachments.push({
                            filename: `evidence.${extension}`,
                            content: Buffer.from(base64Data, 'base64'),
                            contentType: contentType,
                            cid: 'evidenceImage'
                        });
                        hasImage = true;
                    }
                }
            } else {
                // local file reference
                const fs = require('fs');
                const path = require('path');
                const uploadDir = process.env.VERCEL === '1' ? '/tmp' : path.join(__dirname, 'uploads');
                const filePath = path.join(uploadDir, attachedFile);
                if (fs.existsSync(filePath)) {
                    const isPdf = attachedFile.toLowerCase().endsWith('.pdf');
                    if (isPdf) {
                        attachments.push({
                            filename: 'evidence.pdf',
                            path: filePath
                        });
                        hasPdf = true;
                    } else {
                        attachments.push({
                            filename: attachedFile,
                            path: filePath,
                            cid: 'evidenceImage'
                        });
                        hasImage = true;
                    }
                }
            }
        }

        const emailPromises = [];

        // 1. Send confirmation to student
        if (category !== "Security") {
            const studentHtml = getStudentEmailTemplate({ ...req.body, hasImage, hasPdf });
            emailPromises.push(transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: studentEmail,
                subject: `Complaint Received: ${complaintId}`,
                html: studentHtml,
                attachments: attachments
            }));
        }

        // 2. Send alert to department
        const deptHtml = getDeptEmailTemplate({ ...req.body, hasImage, hasPdf });
        emailPromises.push(transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: deptEmail,
            subject: `New Complaint Alert: ${category} - ${complaintId}`,
            html: deptHtml,
            attachments: attachments
        }));

        // Send all emails in parallel to double the response speed
        await Promise.all(emailPromises);

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

module.exports = app;
