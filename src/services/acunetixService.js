const acunetixApi = require('../config/acunetix');
const logger = require('../utils/logger');

class AcunetixService {
  // Create a target
  async createTarget(url, description = '') {
    try {
      const response = await acunetixApi.post('/targets', {
        address: url,
        description: description || `Target for ${url}`,
        criticality: 10
      });
      
      logger.info(`Target created: ${url} with ID: ${response.data.target_id}`);
      return response.data;
    } catch (error) {
      logger.error(`Error creating target: ${error.message}`);
      throw new Error(`Failed to create target: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Start a scan
  async startScan(targetId, scanType = 'full') {
    try {
      let profileId;
      
      // Determine scan profile based on type
      switch (scanType) {
        case 'quick':
          profileId = '11111111-1111-1111-1111-111111111112'; // Quick Profile
          break;
        case 'full':
          profileId = '11111111-1111-1111-1111-111111111111'; // Full Scan
          break;
        default:
          profileId = '11111111-1111-1111-1111-111111111111'; // Default to Full Scan
      }
      
      const response = await acunetixApi.post('/scans', {
        target_id: targetId,
        profile_id: profileId,
        schedule: {
          disable: false,
          start_date: null,
          time_sensitive: false
        }
      });
      
      logger.info(`Scan started: ${response.data.scan_id} for target: ${targetId}`);
      return response.data;
    } catch (error) {
      logger.error(`Error starting scan: ${error.message}`);
      throw new Error(`Failed to start scan: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Get scan status
  async getScanStatus(scanId) {
    try {
      const response = await acunetixApi.get(`/scans/${scanId}`);
      return response.data;
    } catch (error) {
      logger.error(`Error getting scan status: ${error.message}`);
      throw new Error(`Failed to get scan status: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Get scan results
  async getScanResults(scanId) {
    try {
      const response = await acunetixApi.get(`/scans/${scanId}/results`);
      return response.data;
    } catch (error) {
      logger.error(`Error getting scan results: ${error.message}`);
      throw new Error(`Failed to get scan results: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Get vulnerabilities for a scan
  async getVulnerabilities(scanId) {
    try {
      const response = await acunetixApi.get(`/scans/${scanId}/results/vulnerabilities`);
      return response.data;
    } catch (error) {
      logger.error(`Error getting vulnerabilities: ${error.message}`);
      throw new Error(`Failed to get vulnerabilities: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Delete a scan
  async deleteScan(scanId) {
    try {
      await acunetixApi.delete(`/scans/${scanId}`);
      logger.info(`Scan deleted: ${scanId}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting scan: ${error.message}`);
      throw new Error(`Failed to delete scan: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Generate report
  async generateReport(scanId, reportType = 'pdf') {
    try {
      const response = await acunetixApi.post('/reports', {
        source: {
          list_type: 'scans',
          id_list: [scanId]
        },
        template_id: reportType === 'pdf' ? '11111111-1111-1111-1111-111111111111' : '11111111-1111-1111-1111-111111111112'
      });
      
      logger.info(`Report generated: ${response.data.report_id} for scan: ${scanId}`);
      return response.data;
    } catch (error) {
      logger.error(`Error generating report: ${error.message}`);
      throw new Error(`Failed to generate report: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Get report status
  async getReportStatus(reportId) {
    try {
      const response = await acunetixApi.get(`/reports/${reportId}`);
      return response.data;
    } catch (error) {
      logger.error(`Error getting report status: ${error.message}`);
      throw new Error(`Failed to get report status: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Download report
  async downloadReport(reportId) {
    try {
      const response = await acunetixApi.get(`/reports/${reportId}/download`, {
        responseType: 'stream'
      });
      return response.data;
    } catch (error) {
      logger.error(`Error downloading report: ${error.message}`);
      throw new Error(`Failed to download report: ${error.response?.data?.message || error.message}`);
    }
  }
}

module.exports = new AcunetixService();
