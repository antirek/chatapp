import config from '../config/index.js';

class SMSService {
  /**
   * Generate 4-digit verification code
   */
  generateCode() {
    return '1234';
    // return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Send SMS with verification code
   * In mock mode - just log to console
   */
  async sendVerificationCode(phone, code) {
    if (config.sms.mockMode) {
      console.log('📱 [SMS MOCK] Sending code to', phone);
      console.log('🔐 Verification code:', code);
      console.log('⏰ Valid for 5 minutes');
      return { success: true, mock: true };
    }

    // TODO: Implement real SMS sending (Twilio, SMS.ru, etc.)
    // Example:
    // const response = await fetch('https://sms-service.com/send', {
    //   method: 'POST',
    //   body: JSON.stringify({ phone, message: `Ваш код: ${code}` })
    // });
    
    throw new Error('Real SMS service not implemented yet');
  }

  /**
   * Get code expiration time (5 minutes)
   */
  getCodeExpirationTime() {
    return new Date(Date.now() + 5 * 60 * 1000);
  }
}

export default new SMSService();

