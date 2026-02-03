import bcrypt from 'bcryptjs';

const password = await bcrypt.hash('Admin_123', 10);
console.log(password);
// Doctor_123
// $2b$10$pJHHVRnWm6hKnPkb5x/wlOxsMy2MQkW06aqDFNaXiShNhHm8DRsnS

// cd backend && cd services && cd
// Nurse_123
// $2b$10$/yvurLrfZ4.mqQUg/DZHjuWtoeiex1k3Iydf1bN0Yad0HzYUjwpMK
