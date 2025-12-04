#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки функциональности "Отметить прочтенным"
 * Использует Playwright для автоматизации браузера
 */

import { chromium } from 'playwright';

const FRONTEND_URL = 'http://localhost:5174';
const PHONE = '79100000009'; // Морозов Александр
const CODE = '1234'; // Код верификации

async function testMarkAsRead() {
  console.log('🚀 Запуск теста "Отметить прочтенным"...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Отслеживаем сетевые запросы
  const networkRequests = [];
  const networkResponses = [];
  const networkErrors = [];
  
  page.on('request', request => {
    if (request.url().includes('/api/messages/') && request.url().includes('/status/')) {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData()
      });
    }
  });
  
  page.on('response', async response => {
    if (response.url().includes('/api/messages/') && response.url().includes('/status/')) {
      const status = response.status();
      let body = null;
      try {
        body = await response.json();
      } catch (e) {
        body = await response.text();
      }
      
      networkResponses.push({
        url: response.url(),
        status,
        statusText: response.statusText(),
        body
      });
      
      if (!response.ok()) {
        networkErrors.push({
          url: response.url(),
          status,
          statusText: response.statusText(),
          body
        });
      }
    }
  });
  
  // Отслеживаем ошибки консоли
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  try {
    // Переходим на страницу логина
    console.log('📱 Переход на страницу логина...');
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Входим как Морозов Александр
    console.log(`📞 Ввод телефона: ${PHONE}`);
    const phoneInput = page.locator('input[type="tel"]').first();
    await phoneInput.fill(PHONE);
    
    const getCodeButton = page.locator('button:has-text("Получить код")').first();
    await getCodeButton.click();
    console.log('✅ Кнопка "Получить код" нажата');
    
    // Ждем поле для кода
    const codeInput = page.locator('input[type="text"][maxlength="4"]').first();
    await codeInput.waitFor({ timeout: 5000 });
    await codeInput.fill(CODE);
    console.log(`🔐 Ввод кода: ${CODE}`);
    
    const loginButton = page.locator('button:has-text("Войти")').first();
    await loginButton.click();
    console.log('✅ Кнопка "Войти" нажата');
    
    // Ждем загрузки чата
    console.log('⏳ Ожидание загрузки чата...');
    await page.waitForTimeout(3000);
    
    // Ищем диалог с Ивановым Иваном (должен быть в списке)
    console.log('🔍 Поиск диалога с Ивановым Иваном...');
    const dialogButton = page.locator('button:has-text("Иванов"), button:has-text("Иван")').first();
    const dialogExists = await dialogButton.count() > 0;
    
    if (!dialogExists) {
      console.log('⚠️  Диалог с Ивановым не найден, ищем любой диалог...');
      // Ищем любой диалог в списке
      const anyDialog = page.locator('[class*="dialog"], button[class*="hover"]').first();
      await anyDialog.waitFor({ timeout: 5000 });
      await anyDialog.click();
    } else {
      await dialogButton.click();
      console.log('✅ Диалог открыт');
    }
    
    // Ждем загрузки сообщений
    console.log('⏳ Ожидание загрузки сообщений...');
    await page.waitForTimeout(3000);
    
    // Ищем сообщение (не от текущего пользователя)
    console.log('🔍 Поиск сообщения для отметки прочтенным...');
    
    // Ищем сообщения в чате
    const messages = page.locator('[data-message-id], [class*="message"]').all();
    const messageCount = await page.locator('[data-message-id]').count();
    console.log(`📨 Найдено сообщений: ${messageCount}`);
    
    if (messageCount === 0) {
      console.log('⚠️  Сообщений не найдено, возможно нужно отправить сообщение');
      // Попробуем найти поле ввода и отправить сообщение
      const messageInput = page.locator('textarea, input[type="text"]').last();
      if (await messageInput.count() > 0) {
        await messageInput.fill('Тестовое сообщение');
        const sendButton = page.locator('button:has-text("Отправить"), button[type="submit"]').last();
        await sendButton.click();
        await page.waitForTimeout(2000);
      }
    }
    
    // Ищем кнопку "Отметить прочтенным" - она должна быть видна на входящих сообщениях
    console.log('🔍 Поиск кнопки "Отметить прочтенным"...');
    
    // Ищем кнопку "Отметить прочтенным" - она показывается на входящих сообщениях
    const markAsReadButton = page.locator('button:has-text("Отметить прочтенным"), button:has-text("прочтенным")').first();
    const buttonExists = await markAsReadButton.count() > 0;
    
    if (buttonExists) {
      console.log('✅ Кнопка "Отметить прочтенным" найдена');
      
      // Проверяем состояние до клика
      const buttonTextBefore = await markAsReadButton.textContent();
      console.log(`📝 Текст кнопки до клика: ${buttonTextBefore}`);
      
      // Кликаем на кнопку
      await markAsReadButton.click();
      console.log('✅ Кнопка "Отметить прочтенным" нажата');
      
      // Ждем выполнения запроса и обновления UI
      await page.waitForTimeout(5000);
      
      // Проверяем, что кнопка исчезла (сообщение помечено как прочитанное)
      const buttonAfter = page.locator('button:has-text("Отметить прочтенным")').first();
      const buttonStillExists = await buttonAfter.count() > 0;
      
      if (!buttonStillExists) {
        console.log('✅ Кнопка исчезла - сообщение помечено как прочитанное');
      } else {
        console.log('⚠️  Кнопка все еще видна - возможно, обновление не произошло');
      }
    } else {
      console.log('⚠️  Кнопка "Отметить прочтенным" не найдена');
      console.log('💡 Возможно, все сообщения уже прочитаны или нет входящих сообщений');
      
      // Пробуем найти любое сообщение и проверить его состояние
      const firstMessage = page.locator('[data-message-id]').first();
      if (await firstMessage.count() > 0) {
        const msgId = await firstMessage.getAttribute('data-message-id');
        console.log(`📨 Первое сообщение ID: ${msgId}`);
      }
    }
    
    // Выводим результаты
    console.log('\n📊 Результаты проверки:');
    console.log('─'.repeat(50));
    
    if (networkRequests.length > 0) {
      console.log(`✅ Найдено запросов к /api/messages/.../status/: ${networkRequests.length}`);
      networkRequests.forEach((req, index) => {
        console.log(`   ${index + 1}. ${req.method} ${req.url}`);
      });
    } else {
      console.log('❌ Запросов к /api/messages/.../status/ не обнаружено');
    }
    
    if (networkResponses.length > 0) {
      console.log(`\n📥 Ответы от API (${networkResponses.length}):`);
      networkResponses.forEach((resp, index) => {
        console.log(`   ${index + 1}. ${resp.status} ${resp.statusText} - ${resp.url}`);
        if (resp.body && typeof resp.body === 'object') {
          console.log(`      Данные:`, JSON.stringify(resp.body).substring(0, 200));
        }
      });
    }
    
    if (networkErrors.length > 0) {
      console.log(`\n❌ Ошибки сетевых запросов (${networkErrors.length}):`);
      networkErrors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.url} - ${error.status} ${error.statusText}`);
      });
    } else {
      console.log('✅ Ошибок сетевых запросов не обнаружено');
    }
    
    if (consoleErrors.length > 0) {
      console.log(`\n❌ Ошибки в консоли браузера (${consoleErrors.length}):`);
      consoleErrors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    } else {
      console.log('✅ Ошибок в консоли браузера не обнаружено');
    }
    
    // Делаем скриншот
    const screenshotPath = '/tmp/mark-as-read-test.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\n📸 Скриншот сохранен: ${screenshotPath}`);
    
    // Ждем перед закрытием
    console.log('\n⏳ Ожидание 5 секунд перед закрытием...');
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('\n❌ Ошибка во время теста:', error.message);
    const screenshotPath = '/tmp/mark-as-read-error.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Скриншот ошибки сохранен: ${screenshotPath}`);
    throw error;
  } finally {
    await browser.close();
  }
}

// Запускаем тест
testMarkAsRead()
  .then(() => {
    console.log('\n✅ Тест завершен');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Тест завершился с ошибкой:', error);
    process.exit(1);
  });

