const messageSender = (statusCode, message, data, res) => {
  res.status(statusCode || 200).json({ message, data, success: true });
};

export default messageSender;
