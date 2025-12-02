import { jsPDF } from 'jspdf';
import fs from 'fs';

export const createPDFReport = async (
  auditLogs,
  suspiciousLogs,
  outputPath
) => {
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text('Monthly System Report', 20, 20);

  doc.setFontSize(10);
  doc.text('------ Audit Trail ------');
  auditLogs.slice(0, 10).forEach((trail, i) => {
    doc.text(
      `${i + 1}. ${trail.action_type} - ${trail.status}`,
      20,
      130 + i * 60
    );
  });

  auditLogs.slice(0, 10);
};
