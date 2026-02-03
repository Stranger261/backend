import { asyncHandler } from '../../../shared/middleware/asyncHandler.middleware.js';
import messageSender from '../../../shared/utils/messageSender.util.js';
import laboratoryService from '../services/laboratory.service.js';
import labOrderService from '../services/labOrders.service.js';

export const createLabOrder = asyncHandler(async (req, res) => {
  const { appointmentId, patientId, labTests, clinicalNotes, priority } =
    req.body;
  const doctorStaffId = req.user.staff_id;
  const authToken = req.headers.authorization;

  const result = await labOrderService.createLabOrderFromConsultation(
    {
      appointmentId,
      patientId,
      labTests,
      clinicalNotes,
      priority,
    },
    doctorStaffId,
    authToken,
  );

  messageSender(201, 'Lab order created successfully.', result, res);
});

export const getLabOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const labOrder = await labOrderService.getLabOrderById(orderId);

  if (!labOrder) {
    return messageSender(404, 'Lab order not found.', null, res);
  }

  messageSender(200, 'Lab order retrieved successfully.', labOrder, res);
});

export const getLabOrdersByAppointment = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;

  const labOrders =
    await labOrderService.getLabOrdersByAppointment(appointmentId);

  messageSender(200, 'Lab orders retrieved successfully.', labOrders, res);
});

export const getLabOrdersByPatient = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { status, startDate, endDate } = req.query;

  const labOrders = await labOrderService.getLabOrdersByPatient(patientId, {
    status,
    startDate,
    endDate,
  });

  messageSender(200, 'Lab orders retrieved successfully.', labOrders, res);
});

export const getAllLabOrders = asyncHandler(async (req, res) => {
  const { status, priority, startDate, endDate, page, limit } = req.query;

  const labOrders = await labOrderService.getAllLabOrders({
    status,
    priority,
    startDate,
    endDate,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  });

  messageSender(200, 'Lab orders retrieved successfully.', labOrders, res);
});

export const getLabOrderTests = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const tests = await labOrderService.getLabOrderTests(orderId);

  messageSender(200, 'Lab order tests retrieved successfully.', tests, res);
});

export const updateLabOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const updateData = req.body;

  const labOrder = await labOrderService.updateLabOrder(orderId, updateData);

  messageSender(200, 'Lab order updated successfully.', labOrder, res);
});

export const updateLabResults = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { results } = req.body;

  const labOrder = await labOrderService.updateLabResults(orderId, results);

  messageSender(200, 'Lab results updated successfully.', labOrder, res);
});

export const cancelLabOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;

  const labOrder = await labOrderService.cancelLabOrder(orderId, reason);

  messageSender(200, 'Lab order cancelled successfully.', labOrder, res);
});

export const getAllLabServices = asyncHandler(async (req, res) => {
  const risServices = await laboratoryService.getAllLabServices();

  messageSender(200, 'RIS Services fetched successfully.', risServices, res);
});

export const receiever = asyncHandler(async (req, res) => {
  console.log('Reach');

  const response = await laboratoryService.receiever(wala);

  messageSender(201, 'RIS Services fetched successfully.', response, res);
});
