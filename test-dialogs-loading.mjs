#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки загрузки списка чатов у Иванова Ивана
 * Использует Playwright для автоматизации браузера
 */

import { chromium } from 'playwright';

const FRONTEND_URL = 'http://localhost:5173';
const PHONE = '79100000000'; // Телефон Иванова Ивана
const CODE = '1234'; // Код верификации (всегда 1234 в dev режиме)

async function testDialogsLoading() {
  console.log('🚀 Запуск теста загрузки списка чатов...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 // Замедление для визуального наблюдения
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Переходим на страницу логина
    console.log('📱 Переход на страницу логина...');
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Проверяем, что мы на странице логина
    const loginForm = page.locator('input[type="tel"]').first();
    await loginForm.waitFor({ timeout: 5000 });
    console.log('✅ Страница логина загружена');
    
    // Вводим телефон
    console.log(`📞 Ввод телефона: ${PHONE}`);
    await loginForm.fill(PHONE);
    
    // Нажимаем кнопку "Получить код"
    const getCodeButton = page.locator('button:has-text("Получить код")').first();
    await getCodeButton.click();
    console.log('✅ Кнопка "Получить код" нажата');
    
    // Ждем появления поля для кода
    console.log('⏳ Ожидание поля для кода...');
    const codeInput = page.locator('input[type="text"][maxlength="4"]').first();
    await codeInput.waitFor({ timeout: 5000 });
    console.log('✅ Поле для кода появилось');
    
    // Вводим код
    console.log(`🔐 Ввод кода: ${CODE}`);
    await codeInput.fill(CODE);
    
    // Нажимаем кнопку "Войти"
    const loginButton = page.locator('button:has-text("Войти")').first();
    await loginButton.click();
    console.log('✅ Кнопка "Войти" нажата');
    
    // Ждем перехода на главную страницу (список чатов)
    console.log('⏳ Ожидание загрузки списка чатов...');
    await page.waitForURL('**/chat**', { timeout: 10000 }).catch(() => {
      console.log('⚠️  URL не изменился, но продолжаем...');
    });
    
    // Ждем появления списка чатов или индикатора загрузки
    console.log('⏳ Ожидание элементов интерфейса...');
    await page.waitForTimeout(3000); // Даем время на загрузку
    
    // Проверяем наличие списка чатов - ищем DialogList компонент
    const dialogsList = page.locator('text=Чаты').locator('..').locator('..').locator('[class*="overflow-y-auto"]').first();
    const dialogsListExists = await dialogsList.count() > 0;
    
    // Также проверяем наличие элементов диалогов
    const dialogItems = page.locator('button:has-text("Петров"), button:has-text("Сидоров"), button:has-text("Смирнов")').first();
    const hasDialogItems = await dialogItems.count() > 0;
    
    // Проверяем наличие индикатора загрузки
    const loadingIndicator = page.locator('[class*="loading"], [class*="spinner"], [class*="loader"]').first();
    const isLoading = await loadingIndicator.count() > 0 && await loadingIndicator.isVisible();
    
    // Проверяем наличие ошибок
    const errorMessage = page.locator('[class*="error"], [class*="alert"]').first();
    const hasError = await errorMessage.count() > 0 && await errorMessage.isVisible();
    
    // Проверяем консоль браузера на ошибки
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Проверяем сетевые запросы
    const networkErrors = [];
    page.on('response', response => {
      if (!response.ok() && response.url().includes('/api/')) {
        networkErrors.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });
    
    await page.waitForTimeout(5000); // Даем время на выполнение запросов
    
    // Выводим результаты
    console.log('\n📊 Результаты проверки:');
    console.log('─'.repeat(50));
    
    if (dialogsListExists) {
      const dialogsCount = await dialogsList.count();
      console.log(`✅ Список чатов найден (элементов: ${dialogsCount})`);
    } else {
      console.log('❌ Список чатов не найден');
    }
    
    if (hasDialogItems) {
      const itemsCount = await dialogItems.count();
      console.log(`✅ Элементы диалогов найдены (${itemsCount})`);
    } else {
      console.log('⚠️  Элементы диалогов не найдены');
    }
    
    if (isLoading) {
      console.log('⏳ Индикатор загрузки активен');
    } else {
      console.log('✅ Индикатор загрузки не активен');
    }
    
    if (hasError) {
      const errorText = await errorMessage.textContent();
      console.log(`❌ Обнаружена ошибка: ${errorText}`);
    } else {
      console.log('✅ Ошибок в UI не обнаружено');
    }
    
    if (consoleErrors.length > 0) {
      console.log(`\n❌ Ошибки в консоли браузера (${consoleErrors.length}):`);
      consoleErrors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    } else {
      console.log('✅ Ошибок в консоли браузера не обнаружено');
    }
    
    if (networkErrors.length > 0) {
      console.log(`\n❌ Ошибки сетевых запросов (${networkErrors.length}):`);
      networkErrors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.url} - ${error.status} ${error.statusText}`);
      });
    } else {
      console.log('✅ Ошибок сетевых запросов не обнаружено');
    }
    
    // Делаем скриншот
    const screenshotPath = '/tmp/dialogs-test-screenshot.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\n📸 Скриншот сохранен: ${screenshotPath}`);
    
    // Проверяем API запросы в Network tab
    console.log('\n🔍 Проверка API запросов:');
    const apiRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/dialogs')) {
        apiRequests.push({
          url: request.url(),
          method: request.method()
        });
      }
    });
    
    await page.waitForTimeout(2000);
    
    if (apiRequests.length > 0) {
      console.log(`✅ Найдено запросов к /api/dialogs: ${apiRequests.length}`);
      apiRequests.forEach((req, index) => {
        console.log(`   ${index + 1}. ${req.method} ${req.url}`);
      });
    } else {
      console.log('⚠️  Запросов к /api/dialogs не обнаружено');
    }
    
    // Ждем перед закрытием
    console.log('\n⏳ Ожидание 5 секунд перед закрытием...');
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('\n❌ Ошибка во время теста:', error.message);
    const screenshotPath = '/tmp/dialogs-test-error.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Скриншот ошибки сохранен: ${screenshotPath}`);
    throw error;
  } finally {
    await browser.close();
  }
}

// Запускаем тест
testDialogsLoading()
  .then(() => {
    console.log('\n✅ Тест завершен');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Тест завершился с ошибкой:', error);
    process.exit(1);
  });

