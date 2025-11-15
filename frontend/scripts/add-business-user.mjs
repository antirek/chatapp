#!/usr/bin/env node
import { chromium } from 'playwright'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const PHONE = process.env.TEST_PHONE || '79100000000'
const CODE = process.env.TEST_CODE || '1234'
const BUSINESS_DIALOG_NAME = process.env.BUSINESS_DIALOG_NAME || 'Анжела Иванова'
const USER_TO_ADD = process.env.USER_TO_ADD || 'Александр Первый'

async function run() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' })

    // Login
    await page.fill('#phone-login', PHONE)
    await page.click('button:has-text("Получить код")')
    await page.waitForSelector('#code', { timeout: 10000 })
    await page.fill('#code', CODE)
    await page.click('button:has-text("Войти")')

    await page.waitForSelector('text=Чаты', { timeout: 15000 })

    // Open business dialog
    await page.click(`text=${BUSINESS_DIALOG_NAME}`)

    // Open dialog info
    await page.locator('button[title="Информация о диалоге"]').click()
    await page.waitForSelector('text=Информация о диалоге', { timeout: 10000 })
    await page.waitForSelector('button:has-text("Добавить пользователя")', { timeout: 10000 })
    await page.click('button:has-text("Добавить пользователя")')
    await page.waitForSelector('text=Информация о диалоге', { state: 'hidden', timeout: 10000 })
    await page.waitForSelector('text=Добавить участников', { timeout: 10000 })

    // Search and select user
    const overlay = page.locator('div.fixed.inset-0').last()

    await overlay.locator('input[placeholder="Поиск по имени или телефону..."]').fill(USER_TO_ADD)
    await page.waitForTimeout(500)
    await overlay.locator(`button:has-text("${USER_TO_ADD}")`).first().click()

    await page.screenshot({ path: 'playwright-debug.png', fullPage: true })

    await overlay.locator('button:has-text("Добавить")').click()

    // Wait for modal to close and confirm system message
    await page.waitForSelector('text=Добавить пользователя', { state: 'hidden', timeout: 10000 })
    await page.waitForSelector(`text=Пользователь ${USER_TO_ADD} подключился`, { timeout: 15000 })

    console.log(`✅ Пользователь ${USER_TO_ADD} добавлен в диалог "${BUSINESS_DIALOG_NAME}"`)
  } finally {
    await browser.close()
  }
}

run().catch((error) => {
  console.error('❌ Playwright automation failed:', error)
  process.exit(1)
})


