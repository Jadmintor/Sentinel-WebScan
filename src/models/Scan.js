const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');

const Scan = sequelize.define('Scan', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  acunetixScanId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  targetUrl: {
    type: DataTypes.STRING,
    allowNull: false
  },
  scanType: {
    type: DataTypes.ENUM('full', 'quick', 'custom'),
    defaultValue: 'full'
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'scheduled'
  },
  startTime: {
    type: DataTypes.DATE
  },
  endTime: {
    type: DataTypes.DATE
  },
  threatLevel: {
    type: DataTypes.STRING
  },
  highVulnerabilities: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  mediumVulnerabilities: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lowVulnerabilities: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  infoVulnerabilities: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  reportUrl: {
    type: DataTypes.STRING
  }
});

// Define relationships
Scan.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Scan, { foreignKey: 'userId' });

module.exports = Scan;