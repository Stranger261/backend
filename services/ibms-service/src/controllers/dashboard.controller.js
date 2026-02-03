// controllers/dashboardController.js
import OverviewService from '../services/dashboardOverview.service.js';
import CensusService from '../services/Census.service.js';
import AnalyticsService from '../services/Analytics.service.js';
import AlertService from '../services/Alert.service.js';
import catchAsync from '../utils/catchAsync.js';

export const getDashboardOverview = catchAsync(async (req, res) => {
  const data = await OverviewService.getDashboardOverview();

  res.status(200).json({
    status: 'success',
    data,
  });
});

export const getHospitalCensus = catchAsync(async (req, res) => {
  const data = await CensusService.getHospitalCensus();

  res.status(200).json({
    status: 'success',
    data,
  });
});

export const getAnalyticsReports = catchAsync(async (req, res) => {
  const { report_type, period } = req.query;

  let data;
  if (report_type) {
    switch (report_type) {
      case 'revenue':
        data = await AnalyticsService.generateRevenueReport(period || 'month');
        break;
      case 'patient_volume':
        data = await AnalyticsService.generatePatientVolumeReport(
          period || 'month',
        );
        break;
      case 'er_metrics':
        data = await AnalyticsService.generateERMetricsReport(
          period || 'month',
        );
        break;
      default:
        data = await AnalyticsService.getPrebuiltReports();
    }
  } else {
    data = await AnalyticsService.getPrebuiltReports();
  }

  res.status(200).json({
    status: 'success',
    data,
  });
});

export const buildCustomReport = catchAsync(async (req, res) => {
  const { parameters } = req.body;

  if (!parameters) {
    return res.status(400).json({
      status: 'error',
      message: 'Report parameters are required',
    });
  }

  const report = await AnalyticsService.buildCustomReport(parameters);

  res.status(200).json({
    status: 'success',
    data: report,
  });
});

export const exportReport = catchAsync(async (req, res) => {
  const { report_id, format = 'json' } = req.query;

  // Get report data (you would fetch from saved reports)
  const reportData = await AnalyticsService.generateRevenueReport('month');
  const exported = await AnalyticsService.exportReport(reportData, format);

  // Set headers based on format
  const headers = {
    json: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="report.json"',
    },
    csv: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="report.csv"',
    },
    excel: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="report.xlsx"',
    },
  };

  res.set(headers[format] || headers.json);
  res.send(exported);
});

export const getCriticalAlerts = catchAsync(async (req, res) => {
  const {
    alert_types = 'all',
    severity = 'critical,high',
    include_resolved = false,
    limit = 50,
  } = req.query;

  const alerts = await AlertService.getAllAlerts({
    alert_types: alert_types.split(','),
    severity: severity.split(','),
    include_resolved: include_resolved === 'true',
    limit: parseInt(limit),
  });

  res.status(200).json({
    status: 'success',
    count: alerts.length,
    data: alerts,
  });
});

export const resolveAlert = catchAsync(async (req, res) => {
  const { alert_type, alert_id } = req.params;
  const { notes } = req.body;
  const resolvedBy = req.user.id;

  const result = await AlertService.resolveAlert(
    alert_type,
    parseInt(alert_id),
    resolvedBy,
    notes,
  );

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

export const getAlertStatistics = catchAsync(async (req, res) => {
  const { period = 'day' } = req.query;

  const stats = await AlertService.getAlertStatistics(period);

  res.status(200).json({
    status: 'success',
    data: stats,
  });
});
