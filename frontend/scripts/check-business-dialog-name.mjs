#!/usr/bin/env node
import { chromium } from 'playwright'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const PHONE = process.env.TEST_PHONE || '79100000000'
const CODE = process.env.TEST_CODE || '1234'
const BUSINESS_DIALOG_NAME = process.env.BUSINESS_DIALOG_NAME || 'Анжела Иванова'

async function run() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' })

    await page.fill('#phone-login', PHONE)
    await page.click('button:has-text("Получить код")')
    await page.waitForSelector('#code', { timeout: 10000 })
    await page.fill('#code', CODE)
    await page.click('button:has-text("Войти")')

    await page.waitForSelector('text=Чаты', { timeout: 15000 })
    await page.click(`text=${BUSINESS_DIALOG_NAME}`)
    const header = page.locator(`h2:has-text("${BUSINESS_DIALOG_NAME}")`).first()
    await header.waitFor({ state: 'visible', timeout: 10000 })
    const title = await header.innerText()
    console.log(`ℹ️ Заголовок диалога: ${title}`)

    console.log('✅ Название диалога соответствует бизнес-контакту')
  } finally {
    await browser.close()
  }
}

run().catch((error) => {
  console.error('❌ Проверка не пройдена:', error.message)
  process.exit(1)
})


