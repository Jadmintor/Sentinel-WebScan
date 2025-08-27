const express = require('express');
const { protect } = require('../middleware/auth');
const {
  createScan,
  getScans,
  getScan,
  getScanVulnerabilities,
  deleteScan,
  generateReport,
  downloadReport,
  getScanStats
} = require('../controllers/scanController');

const router = express.Router();

// Protect all routes
router.use(protect);

router.post('/', createScan);
router.get('/', getScans);
router.get('/stats', getScanStats);
router.get('/:scanId', getScan);
router.get('/:scanId/vulnerabilities', getScanVulnerabilities);
router.delete('/:scanId', deleteScan);
router.post('/:scanId/report', generateReport);
router.get('/reports/:reportId/download', downloadReport);

module.exports = router;
