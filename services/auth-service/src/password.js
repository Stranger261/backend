import bcrypt from 'bcryptjs';

const password = await bcrypt.hash('Doctor_123', 10);
console.log(password);
// $2b$10$pJHHVRnWm6hKnPkb5x/wlOxsMy2MQkW06aqDFNaXiShNhHm8DRsnS

// cd backend && cd services && cd
