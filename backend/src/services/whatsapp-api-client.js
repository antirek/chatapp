import axios from 'axios';

export class WhatsAppApiClient {
  constructor(instanceId, token) {
    console.log('constructor WhatsAppApiClient', { instanceId, token });
    this.instance = axios.create({
      baseURL: `https://whatsapp-api.services.mobilon.ru/instance${instanceId}`,
      params: {
        token,
      },
    });
  }

  async phoneStatus(chatId) {
    const response = await this.instance({
      method: 'get',
      url: '/phoneStatus',
      params: {
        chatId,
      },
    });
    return response.data;
  }

  async sendMessage(phone, text) {
    const response = await this.instance({
      method: 'post',
      url: '/sendMessage',
      data: {
        chatId: `${phone}@c.us`,
        body: text,
      },
    });
    return response.data;
  }
  
  async sendFile(phone, text) {
    const response = await this.instance({
      method: 'post',
      url: '/sendFile',
      data: {
        chatId: `${phone}@c.us`,
        body: text,
        filename: '',
        caption: '',
      },
    });
    return response.data;
  }

  async getMessageStatus(messageId) {
    const response = await this.instance({
      method: 'get',
      url: '/getMessageStatus',
      params: {
        messageId,
      },
    });
    return response.data;
  }

}


