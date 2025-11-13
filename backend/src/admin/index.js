import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSMongoose from '@adminjs/mongoose';
import mongoose from 'mongoose';

// Import models
import Account from '../models/Account.js';
import User from '../models/User.js';
import Contact from '../models/Contact.js';
import Channel from '../models/Channel.js';
import Service from '../models/Service.js';

// Register AdminJS mongoose adapter
AdminJS.registerAdapter({
  Resource: AdminJSMongoose.Resource,
  Database: AdminJSMongoose.Database,
});

/**
 * Initialize AdminJS
 */
export function initializeAdmin(app) {
  const adminJs = new AdminJS({
    databases: [mongoose],
    rootPath: '/admin',
    resources: [
      {
        resource: Account,
        options: {
          properties: {
            accountId: {
              isVisible: { list: true, filter: true, show: true, edit: false },
            },
            createdAt: {
              isVisible: { list: true, filter: true, show: true, edit: false },
            },
            updatedAt: {
              isVisible: { list: true, filter: true, show: true, edit: false },
            },
          },
          listProperties: ['accountId', 'name', 'createdAt'],
          showProperties: ['accountId', 'name', 'createdAt', 'updatedAt'],
          editProperties: ['name'],
          filterProperties: ['accountId', 'name'],
        },
      },
      {
        resource: User,
        options: {
          properties: {
            userId: {
              isVisible: { list: true, filter: true, show: true, edit: false },
            },
            accountId: {
              isVisible: { list: true, filter: true, show: true, edit: true },
            },
            verificationCode: {
              isVisible: { list: false, filter: false, show: true, edit: false },
            },
            createdAt: {
              isVisible: { list: true, filter: true, show: true, edit: false },
            },
            lastActiveAt: {
              isVisible: { list: true, filter: true, show: true, edit: false },
            },
          },
          listProperties: ['userId', 'accountId', 'name', 'phone', 'lastActiveAt'],
          showProperties: ['userId', 'accountId', 'name', 'phone', 'verificationCode', 'createdAt', 'lastActiveAt'],
          editProperties: ['accountId', 'name', 'phone'],
          filterProperties: ['userId', 'accountId', 'name', 'phone'],
        },
      },
      {
        resource: Contact,
        options: {
          properties: {
            contactId: {
              isVisible: { list: true, filter: true, show: true, edit: false },
            },
            accountId: {
              isVisible: { list: true, filter: true, show: true, edit: true },
            },
            createdAt: {
              isVisible: { list: true, filter: true, show: true, edit: false },
            },
            updatedAt: {
              isVisible: { list: true, filter: true, show: true, edit: false },
            },
          },
          listProperties: ['contactId', 'accountId', 'name', 'phone', 'updatedAt'],
          showProperties: ['contactId', 'accountId', 'name', 'phone', 'createdAt', 'updatedAt'],
          editProperties: ['accountId', 'name', 'phone'],
          filterProperties: ['contactId', 'accountId', 'name', 'phone'],
        },
      },
      {
        resource: Channel,
        options: {
          properties: {
            channelId: {
              isVisible: { list: true, filter: true, show: true, edit: false },
            },
            accountId: {
              isVisible: { list: true, filter: true, show: true, edit: true },
            },
            token: {
              isVisible: { list: false, filter: false, show: true, edit: true },
              type: 'textarea',
            },
            createdAt: {
              isVisible: { list: true, filter: true, show: true, edit: false },
            },
            updatedAt: {
              isVisible: { list: true, filter: true, show: true, edit: false },
            },
          },
          listProperties: ['channelId', 'accountId', 'type', 'instanceId', 'isActive', 'updatedAt'],
          showProperties: ['channelId', 'accountId', 'type', 'instanceId', 'token', 'isActive', 'createdAt', 'updatedAt'],
          editProperties: ['accountId', 'type', 'instanceId', 'token', 'isActive'],
          filterProperties: ['channelId', 'accountId', 'type', 'isActive'],
        },
      },
      {
        resource: Service,
        options: {
          navigation: {
            name: 'System',
            icon: 'Settings',
          },
          properties: {
            serviceId: {
              isVisible: { list: true, filter: true, show: true, edit: false },
            },
            createdAt: {
              isVisible: { list: true, filter: true, show: true, edit: false },
            },
            updatedAt: {
              isVisible: { list: true, filter: true, show: true, edit: false },
            },
          },
          listProperties: ['serviceId', 'type', 'apiUrl', 'isActive', 'updatedAt'],
          showProperties: ['serviceId', 'type', 'apiUrl', 'description', 'isActive', 'createdAt', 'updatedAt'],
          editProperties: ['type', 'apiUrl', 'description', 'isActive'],
          filterProperties: ['serviceId', 'type', 'isActive'],
        },
      },
    ],
    branding: {
      companyName: 'ChatApp Admin',
      logo: false,
      softwareBrothers: false,
    },
    locale: {
      language: 'ru',
      translations: {
        labels: {
          Account: 'Аккаунты',
          User: 'Пользователи',
          Contact: 'Контакты',
          Channel: 'Каналы',
          Service: 'Сервисы',
        },
        properties: {
          accountId: 'ID аккаунта',
          name: 'Название',
          userId: 'ID пользователя',
          phone: 'Телефон',
          contactId: 'ID контакта',
          channelId: 'ID канала',
          serviceId: 'ID сервиса',
          type: 'Тип',
          instanceId: 'ID экземпляра',
          token: 'Токен',
          apiUrl: 'URL API',
          description: 'Описание',
          isActive: 'Активен',
          createdAt: 'Создан',
          updatedAt: 'Обновлен',
          lastActiveAt: 'Последняя активность',
          verificationCode: 'Код верификации',
        },
      },
    },
  });

  // Build router
  const router = AdminJSExpress.buildRouter(adminJs);

  // Mount admin router BEFORE 404 handler
  app.use(adminJs.options.rootPath, router);

  console.log(`✅ AdminJS initialized at http://localhost:${process.env.PORT || 3010}${adminJs.options.rootPath}`);

  return adminJs;
}

