const User = require('../models/User');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const BloodGroup = require('../models/BloodGroups');
const RequirementRequest = require('../models/RequirementRequest');
const DonationRequest = require('../models/DonationRequest');

const { sendTemplateMsg, sendBloodRequirementNotification } = require('../helpers/whatsappHelper');
const Admin = require('../models/Admin');


exports.getUserData = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("_id name email employeeId designation shopNo phone createdAt").populate('bloodgroup avatar donationPoints', 'type');
        if (!user) {
            return res.status(400).json({ error: 'User Not Found!' });
        };
        res.status(200).json({ data: user })
    } catch (err) {
        res.status(400).json({ error: 'Invalid token: ' + err.message });
    }
}

exports.updateUser = async (req, res) => {
    try {
        const userId = req.user._id;
        const allowedFields = ['name', 'email', 'phone', 'avatar', 'employeeId', 'designation', 'shopNo', 'bloodgroup'];
        const updates = {};

        // Filter only allowed fields
        for (let key of allowedFields) {
            if (req.body[key] !== undefined) {
                updates[key] = req.body[key];
            }
        }

        // Prevent updating sensitive fields like password here
        if ('password' in req.body) {
            return res.status(400).json({ error: 'Cant change password here.' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updates },
            { new: true, runValidators: true }
        ).select("_id name email employeeId designation shopNo phone createdAt").populate('bloodgroup', 'type');

        res.status(200).json({
            message: 'User data updated successfully',
            data: updatedUser
        });

    } catch (err) {
        res.status(500).json({ error: 'Server error. ' + err.message });
    }
};

exports.updateUserAvatar = async (req, res) => {
    try {
        const userId = req.user._id;
        const file = req.file;

        console.log(file);

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Store the uploaded image
        user.avatar = `/public/uploads/${file.filename}`;
        await user.save();

        res.status(200).json({ message: 'Avatar updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.bloodRecieveRequest = async (req, res) => {
    try {
        const { bloodgroup, name, reason, phone, unitsRequired, requiredDate } = req.body;

        // Check if the user already has a pending request
        const existingRequest = await RequirementRequest.findOne({
            userId: req.user._id,
            status: 'Pending'
        });

        if (existingRequest) {
            return res.status(400).json({
                error: 'You already have a pending blood requirement request.'
            });
        }

        // Create a new requirement request
        const newRequest = new RequirementRequest({
            userId: req.user._id,
            bloodgroup,
            patientName: name,
            reason,
            phone,
            unitsRequired,
            requiredDate
        });

        const savedRequirement = await newRequest.save();

        const bloodGroup = await BloodGroup.findById(bloodgroup);;
        if (!bloodGroup) {
            return res.status(404).json({ message: 'Blood group not found' });
        }

        const users = await User.find({ bloodgroup: bloodGroup._id });
        for (const user of users) {
            if (user.phone) {
                sendBloodRequirementNotification(name, phone, user.phone, bloodGroup.type);
            }
        }
        res.status(201).json({
            message: 'Requirement request created successfully',
            data: savedRequirement
        });

    } catch (err) {
        return res.status(500).json({ error: 'Server error. ' + err.message });
    }
};


exports.bloodDonationRequest = async (req, res) => {
    try {
        const { bloodgroup, phone, donationDate } = req.body;

        // Check if the user already has a pending request
        const existingRequest = await DonationRequest.findOne({
            userId: req.user._id,
            status: 'Pending'
        });

        if (existingRequest) {
            return res.status(400).json({
                error: 'You already have a pending blood donation request.'
            });
        }

        // Create a new requirement request
        const newRequest = new DonationRequest({
            userId: req.user._id,
            bloodgroup,
            phone,
            donationDate
        });

        const savedDonation = await newRequest.save();

        res.status(201).json({
            message: 'Donation request created successfully',
            data: savedDonation
        });

    } catch (err) {
        return res.status(500).json({ error: 'Server error. ' + err.message });
    }
};

exports.getBloodGroups = async (req, res) => {
    try {
        const bloodGroups = await BloodGroup.find().sort({ type: 1 })
        return res.status(200).json({ groups: bloodGroups });
    } catch (err) {
        return res.status(500).json({ error: 'Server error. ' + err.message });
    }
};

exports.testMessage = async (req, res) => {
    try {
        // for (let i = 1; i <= 10; i++) {
        // }
        sendBloodRequirementNotification("Soumyadeep", "8240254624", 6290785895, "O+");
        return res.status(200).json({ msg: 'success' });
    } catch (err) {
        return res.status(500).json({ error: 'Server error. ' + err.message });
    }
}


exports.userBloodList = async (req, res) => {
    try {
        const donationRequests = await DonationRequest.find({ userId: req.user._id })
            .select('-__v')
            .populate('userId', 'name')
            .sort({ createdAt: -1 });

        if (donationRequests.length === 0) {
            return res.status(200).json({ msg: 'You have not made any donations yet.' });
        }

        const data = await Promise.all(
            donationRequests.map(async (request) => {
                const bloodGroup = await BloodGroup.findById(request.bloodgroup);
                return {
                    ...request.toObject(),
                    bloodgroup: bloodGroup,
                    username: request.userId.name
                };
            })
        );

        return res.status(200).json({ data });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: 'Server error. ' + error.message });
    }
}

exports.generateCertificate = async (req, res) => {
    try {
        const { userId, donationRequestId } = req.params;

        // Get the user details and get the donation details
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const donationRequest = await DonationRequest.findById(donationRequestId);
        if (!donationRequest) {
            return res.status(404).json({ error: 'Donation request not found.' });
        }
        if (donationRequest.status !== 'Completed') {
            return res.status(400).json({ error: 'Donation request status is not Completed.' });
        }

        const bloodGroup = await BloodGroup.findById(donationRequest.bloodgroup);
        if (!bloodGroup) {
            return res.status(404).json({ error: 'Blood group not found.' });
        }

        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Blood_Donation_Certificate_${user.name.replace(/\s+/g, '_')}.pdf"`);

        // Generate the PDF certificate
        const pdf = await generatePdfCertificate(user, donationRequest, bloodGroup);

        // Pipe the PDF to response
        pdf.pipe(res);
        pdf.end();

    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: 'Server error. ' + error.message });
    }
};

const generatePdfCertificate = async (user, donationRequest, bloodGroup) => {
    const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 20, bottom: 20, left: 20, right: 20 }
    });

    const pageWidth = doc.page.width;  // 841.89 points
    const pageHeight = doc.page.height; // 595.28 points

    // Define multi-line text width and center position
    const multiLineWidth = 700;
    const xMultiLine = (pageWidth - multiLineWidth) / 2;

    // Certificate design elements (unchanged)
    drawBackground(doc, pageWidth, pageHeight);
    drawBorder(doc, pageWidth, pageHeight);
    drawHeader(doc, pageWidth);

    // Certificate title and main content
    drawTitle(doc, pageWidth);
    drawMainContent(doc, user, donationRequest, bloodGroup, pageWidth, xMultiLine, multiLineWidth);

    // Footer with signatures and date
    drawFooter(doc, donationRequest, pageWidth, pageHeight);

    return doc;
};

// Placeholder functions for unchanged design elements
const drawBackground = (doc, pageWidth, pageHeight) => {
    doc.rect(0, 0, pageWidth, pageHeight).fill('#f9fafb');
};

const drawBorder = (doc, pageWidth, pageHeight) => {
    // Outer border
    doc.rect(15, 15, pageWidth - 30, pageHeight - 30)
        .lineWidth(3)
        .stroke('#dc2626');

    // Inner decorative border
    doc.rect(25, 25, pageWidth - 50, pageHeight - 50)
        .lineWidth(1)
        .stroke('#ef4444');
};

const drawHeader = (doc, pageWidth) => {
    // Draw blood drop symbols
    drawBloodDrop(doc, 80, 60, 12, '#dc2626');
    drawBloodDrop(doc, pageWidth - 80, 60, 12, '#dc2626');

    // Medical cross symbols
    drawMedicalCross(doc, 120, 55, 16, '#dc2626');
    drawMedicalCross(doc, pageWidth - 120, 55, 16, '#dc2626');

    // Heart symbol in center top
    drawHeart(doc, pageWidth / 2, 50, '#ef4444');
};

const drawBloodDrop = (doc, x, y, size, color) => {
    doc.save()
        .translate(x, y)
        .moveTo(0, 0)
        .bezierCurveTo(-size / 2, -size / 2, -size / 2, -size, 0, -size * 1.5)
        .bezierCurveTo(size / 2, -size, size / 2, -size / 2, 0, 0)
        .fill(color)
        .restore();
};

const drawMedicalCross = (doc, x, y, size, color) => {
    // Vertical bar
    doc.rect(x - size / 6, y - size / 2, size / 3, size)
        .fill(color);

    // Horizontal bar
    doc.rect(x - size / 2, y - size / 6, size, size / 3)
        .fill(color);
};

const drawHeart = (doc, x, y, color) => {
    doc.save()
        .translate(x, y)
        .moveTo(0, 10)
        .bezierCurveTo(-15, -5, -25, 5, -12, 20)
        .bezierCurveTo(-8, 25, 0, 15, 0, 10)
        .bezierCurveTo(0, 15, 8, 25, 12, 20)
        .bezierCurveTo(25, 5, 15, -5, 0, 10)
        .fill(color)
        .restore();
};

const drawTitle = (doc, pageWidth) => {
    // Main title
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#dc2626');
    const title = 'CERTIFICATE OF APPRECIATION';
    const titleWidth = doc.widthOfString(title);
    const xTitle = (pageWidth - titleWidth) / 2;
    doc.text(title, xTitle, 90);

    // Subtitle
    doc.fontSize(14).font('Helvetica').fillColor('#7f1d1d');
    const subtitle = 'Blood Donation Certificate';
    const subtitleWidth = doc.widthOfString(subtitle);
    const xSubtitle = (pageWidth - subtitleWidth) / 2;
    doc.text(subtitle, xSubtitle, 120);

    // Decorative line
    const lineLength = 300;
    const lineStart = (pageWidth - lineLength) / 2;
    const lineEnd = lineStart + lineLength;
    doc.moveTo(lineStart, 145).lineTo(lineEnd, 145).lineWidth(2).stroke('#ef4444');
};

const drawMainContent = (doc, user, donationRequest, bloodGroup, pageWidth, xMultiLine, multiLineWidth) => {
    const startY = 170;

    // "This is to certify that" text
    doc.fontSize(12).font('Helvetica').fillColor('#374151');
    const certifyText = 'This is to certify that';
    const certifyWidth = doc.widthOfString(certifyText);
    const xCertify = (pageWidth - certifyWidth) / 2;
    doc.text(certifyText, xCertify, startY);

    // Donor name (highlighted)
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#dc2626');
    const donorName = user.name.toUpperCase();
    const nameWidth = doc.widthOfString(donorName);
    const xName = (pageWidth - nameWidth) / 2;
    doc.text(donorName, xName, startY + 25);

    // Donation details
    doc.fontSize(12).font('Helvetica').fillColor('#374151');
    const donationText = 'has generously donated blood on';
    const donationWidth = doc.widthOfString(donationText);
    const xDonation = (pageWidth - donationWidth) / 2;
    doc.text(donationText, xDonation, startY + 55);

    // Date
    const donationDate = new Date(donationRequest.donationDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#dc2626');
    const dateWidth = doc.widthOfString(donationDate);
    const xDate = (pageWidth - dateWidth) / 2;
    doc.text(donationDate, xDate, startY + 75);

    // Blood group
    const bloodGroupName = bloodGroup?.name || bloodGroup?.type || 'Not Specified';
    doc.fontSize(12).font('Helvetica').fillColor('#374151');
    const bloodGroupText = `Blood Group: ${bloodGroupName}`;
    const bloodGroupWidth = doc.widthOfString(bloodGroupText);
    const xBloodGroup = (pageWidth - bloodGroupWidth) / 2;
    doc.text(bloodGroupText, xBloodGroup, startY + 100);

    // Appreciation message (multi-line)
    doc.fontSize(11).font('Helvetica-Oblique').fillColor('#6b7280');
    const appreciationText = 'Your selfless act of kindness will help save lives and brings hope to those in need.';
    doc.text(appreciationText, xMultiLine, startY + 125, { width: multiLineWidth, align: 'center' });

    // Thank you message
    const thankYouText = 'Thank you for being a hero!';
    const thankYouWidth = doc.widthOfString(thankYouText);
    const xThankYou = (pageWidth - thankYouWidth) / 2;
    doc.text(thankYouText, xThankYou, startY + 145);
};

const drawFooter = (doc, donationRequest, pageWidth, pageHeight) => {
    const footerY = pageHeight - 90;
    
    // Signature section - left and right positioned
    doc.fontSize(10)
        .fillColor('#374151');

    // Calculate positions for left and right signatures
    const leftSigX = 80;
    const rightSigX = pageWidth - 220;

    // Medical Officer signature (left)
    doc.text('_________________________', leftSigX, footerY);
    doc.fontSize(8)
        .text('Medical Officer', leftSigX + 20, footerY + 15);
    doc.text('Blood Bank', leftSigX + 30, footerY + 25);

    // Director signature (right)
    doc.fontSize(10)
        .text('_________________________', rightSigX, footerY);
    doc.fontSize(8)
        .text('Director', rightSigX + 50, footerY + 15);
    doc.text('Blood Donation Center', rightSigX + 20, footerY + 25);

    // Official seal (centered, above certificate ID)
    const sealCenterX = pageWidth / 2;
    const sealY = footerY + 20;
    
    doc.circle(sealCenterX, sealY, 15)
        .lineWidth(2)
        .stroke('#dc2626');

    doc.fontSize(5)
        .fillColor('#dc2626')
        .text('OFFICIAL', sealCenterX - 12, sealY - 4, { align: 'center', width: 24 })
        .text('SEAL', sealCenterX - 12, sealY + 2, { align: 'center', width: 24 });

    // Certificate ID and Issue date (centered at bottom)
    const certInfoY = footerY + 40;
    
    doc.fontSize(8)
        .font('Helvetica')
        .fillColor('#6b7280');

    // Certificate ID (centered)
    const certIdText = `Certificate ID: BD-${donationRequest._id.toString().substring(0, 8).toUpperCase()}`;
    const certIdWidth = doc.widthOfString(certIdText);
    const certIdX = (pageWidth - certIdWidth) / 2;
    doc.text(certIdText, certIdX, certInfoY);

    // Issue date (centered)
    const issueDate = new Date().toLocaleDateString('en-US');
    const issueDateText = `Issued on: ${issueDate}`;
    const issueDateWidth = doc.widthOfString(issueDateText);
    const issueDateX = (pageWidth - issueDateWidth) / 2;
    doc.text(issueDateText, issueDateX, certInfoY + 10);
};