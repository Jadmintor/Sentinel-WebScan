const { Op } = require('sequelize');
const Scan = require('../models/Scan');
const acunetixService = require('../services/acunetixService');
const logger = require('../utils/logger');

// Create and start a new scan
exports.createScan = async (req, res) => {
  try {
    const { targetUrl, scanType = 'full' } = req.body;
    const userId = req.user.id;
    
    // Validate URL
    try {
      new URL(targetUrl);
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Invalid URL provided'
      });
    }
    
    // Create target in Acunetix
    const target = await acunetixService.createTarget(targetUrl);
    
    // Start scan
    const scanData = await acunetixService.startScan(target.target_id, scanType);
    
    // Save scan to database
    const scan = await Scan.create({
      acunetixScanId: scanData.scan_id,
      targetUrl,
      scanType,
      status: 'scheduled',
      startTime: new Date(),
      userId
    });
    
    logger.info(`Scan created: ${scan.id} for URL: ${targetUrl}`);
    
    res.status(201).json({
      success: true,
      message: 'Scan started successfully',
      scan: {
        id: scan.id,
        targetUrl: scan.targetUrl,
        scanType: scan.scanType,
        status: scan.status,
        startTime: scan.startTime
      }
    });
  } catch (error) {
    logger.error(`Create scan error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error creating scan',
      error: error.message
    });
  }
};

// Get all scans for the user
exports.getScans = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { page = 1, limit = 10, status } = req.query;
    
    const offset = (page - 1) * limit;
    const whereClause = userRole === 'administrator' ? {} : { userId };
    
    if (status) {
      whereClause.status = status;
    }
    
    const { count, rows: scans } = await Scan.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: offset,
      order: [['createdAt', 'DESC']],
      include: userRole === 'administrator' ? ['User'] : []
    });
    
    res.status(200).json({
      success: true,
      scans,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalScans: count,
        hasNext: offset + limit < count,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error(`Get scans error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error fetching scans',
      error: error.message
    });
  }
};

// Get specific scan details
exports.getScan = async (req, res) => {
  try {
    const { scanId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    const whereClause = { id: scanId };
    if (userRole !== 'administrator') {
      whereClause.userId = userId;
    }
    
    const scan = await Scan.findOne({
      where: whereClause,
      include: userRole === 'administrator' ? ['User'] : []
    });
    
    if (!scan) {
      return res.status(404).json({
        success: false,
        message: 'Scan not found'
      });
    }
    
    // Get latest status from Acunetix
    try {
      const acunetixScan = await acunetixService.getScanStatus(scan.acunetixScanId);
      
      // Update local scan status if changed
      if (scan.status !== acunetixScan.current_session.status) {
        scan.status = acunetixScan.current_session.status;
        
        if (acunetixScan.current_session.status === 'completed') {
          scan.endTime = new Date();
          
          // Get vulnerabilities count
          try {
            const vulnerabilities = await acunetixService.getVulnerabilities(scan.acunetixScanId);
            scan.highVulnerabilities = vulnerabilities.vulnerabilities.filter(v => v.severity === 3).length;
            scan.mediumVulnerabilities = vulnerabilities.vulnerabilities.filter(v => v.severity === 2).length;
            scan.lowVulnerabilities = vulnerabilities.vulnerabilities.filter(v => v.severity === 1).length;
            scan.infoVulnerabilities = vulnerabilities.vulnerabilities.filter(v => v.severity === 0).length;
          } catch (vulnError) {
            logger.warn(`Could not fetch vulnerabilities for scan ${scanId}: ${vulnError.message}`);
          }
        }
        
        await scan.save();
      }
    } catch (acunetixError) {
      logger.warn(`Could not fetch Acunetix status for scan ${scanId}: ${acunetixError.message}`);
    }
    
    res.status(200).json({
      success: true,
      scan
    });
  } catch (error) {
    logger.error(`Get scan error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error fetching scan',
      error: error.message
    });
  }
};

// Get scan vulnerabilities
exports.getScanVulnerabilities = async (req, res) => {
  try {
    const { scanId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    const whereClause = { id: scanId };
    if (userRole !== 'administrator') {
      whereClause.userId = userId;
    }
    
    const scan = await Scan.findOne({ where: whereClause });
    
    if (!scan) {
      return res.status(404).json({
        success: false,
        message: 'Scan not found'
      });
    }
    
    const vulnerabilities = await acunetixService.getVulnerabilities(scan.acunetixScanId);
    
    res.status(200).json({
      success: true,
      vulnerabilities: vulnerabilities.vulnerabilities,
      summary: {
        high: vulnerabilities.vulnerabilities.filter(v => v.severity === 3).length,
        medium: vulnerabilities.vulnerabilities.filter(v => v.severity === 2).length,
        low: vulnerabilities.vulnerabilities.filter(v => v.severity === 1).length,
        info: vulnerabilities.vulnerabilities.filter(v => v.severity === 0).length
      }
    });
  } catch (error) {
    logger.error(`Get vulnerabilities error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error fetching vulnerabilities',
      error: error.message
    });
  }
};

// Delete a scan
exports.deleteScan = async (req, res) => {
  try {
    const { scanId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    const whereClause = { id: scanId };
    if (userRole !== 'administrator') {
      whereClause.userId = userId;
    }
    
    const scan = await Scan.findOne({ where: whereClause });
    
    if (!scan) {
      return res.status(404).json({
        success: false,
        message: 'Scan not found'
      });
    }
    
    // Delete from Acunetix
    try {
      await acunetixService.deleteScan(scan.acunetixScanId);
    } catch (acunetixError) {
      logger.warn(`Could not delete scan from Acunetix: ${acunetixError.message}`);
    }
    
    // Delete from database
    await scan.destroy();
    
    logger.info(`Scan deleted: ${scanId}`);
    
    res.status(200).json({
      success: true,
      message: 'Scan deleted successfully'
    });
  } catch (error) {
    logger.error(`Delete scan error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error deleting scan',
      error: error.message
    });
  }
};

// Generate scan report
exports.generateReport = async (req, res) => {
  try {
    const { scanId } = req.params;
    const { reportType = 'pdf' } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    const whereClause = { id: scanId };
    if (userRole !== 'administrator') {
      whereClause.userId = userId;
    }
    
    const scan = await Scan.findOne({ where: whereClause });
    
    if (!scan) {
      return res.status(404).json({
        success: false,
        message: 'Scan not found'
      });
    }
    
    if (scan.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot generate report for incomplete scan'
      });
    }
    
    const report = await acunetixService.generateReport(scan.acunetixScanId, reportType);
    
    res.status(200).json({
      success: true,
      message: 'Report generation started',
      reportId: report.report_id
    });
  } catch (error) {
    logger.error(`Generate report error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error generating report',
      error: error.message
    });
  }
};

// Download scan report
exports.downloadReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    
    // Check report status first
    const reportStatus = await acunetixService.getReportStatus(reportId);
    
    if (reportStatus.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Report is not ready for download',
        status: reportStatus.status
      });
    }
    
    const reportStream = await acunetixService.downloadReport(reportId);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="scan-report-${reportId}.pdf"`);
    
    reportStream.pipe(res);
  } catch (error) {
    logger.error(`Download report error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error downloading report',
      error: error.message
    });
  }
};

// Get scan statistics
exports.getScanStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    const whereClause = userRole === 'administrator' ? {} : { userId };
    
    const totalScans = await Scan.count({ where: whereClause });
    const completedScans = await Scan.count({ where: { ...whereClause, status: 'completed' } });
    const runningScans = await Scan.count({ 
      where: { 
        ...whereClause, 
        status: { [Op.in]: ['scheduled', 'processing', 'running'] } 
      } 
    });
    
    const vulnerabilityStats = await Scan.findAll({
      where: { ...whereClause, status: 'completed' },
      attributes: [
        'highVulnerabilities',
        'mediumVulnerabilities', 
        'lowVulnerabilities',
        'infoVulnerabilities'
      ]
    });
    
    const totalHigh = vulnerabilityStats.reduce((sum, scan) => sum + (scan.highVulnerabilities || 0), 0);
    const totalMedium = vulnerabilityStats.reduce((sum, scan) => sum + (scan.mediumVulnerabilities || 0), 0);
    const totalLow = vulnerabilityStats.reduce((sum, scan) => sum + (scan.lowVulnerabilities || 0), 0);
    const totalInfo = vulnerabilityStats.reduce((sum, scan) => sum + (scan.infoVulnerabilities || 0), 0);
    
    res.status(200).json({
      success: true,
      stats: {
        totalScans,
        completedScans,
        runningScans,
        vulnerabilities: {
          high: totalHigh,
          medium: totalMedium,
          low: totalLow,
          info: totalInfo,
          total: totalHigh + totalMedium + totalLow + totalInfo
        }
      }
    });
  } catch (error) {
    logger.error(`Get scan stats error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error fetching scan statistics',
      error: error.message
    });
  }
};
