'use strict'

const puppeteer = require('puppeteer-core')
const { app } = require('electron')
const path = require('path')

// We use Electron's embedded Chromium binary directly to save space
function getExecutablePath() {
    return app.getPath('exe')
}

async function runHeadlessAutomation(input) {
    let browser
    try {
        browser = await puppeteer.launch({
            executablePath: getExecutablePath(),
            headless: 'new',
            ignoreDefaultArgs: ['--disable-extensions'],
            args: ['--no-sandbox']
        })
    } catch (err) {
        return { ok: false, reason: `Launch failed: ${err.message}` }
    }

    try {
        const page = await browser.newPage()
        await page.goto(input.url, { waitUntil: 'networkidle2', timeout: 30000 })

        let extractedData = {}
        const logs = []

        for (const step of (input.steps || [])) {
            logs.push(`Executing: ${step.action} on ${step.selector || 'page'}`)

            switch (step.action) {
                case 'click':
                    if (step.selector) {
                        await page.waitForSelector(step.selector, { timeout: 5000 }).catch(() => null)
                        await page.click(step.selector).catch(() => null)
                    }
                    break
                case 'fill':
                    if (step.selector && step.value) {
                        await page.waitForSelector(step.selector, { timeout: 5000 }).catch(() => null)
                        await page.type(step.selector, step.value).catch(() => null)
                    }
                    break
                case 'extractText':
                    if (step.selector) {
                        await page.waitForSelector(step.selector, { timeout: 5000 }).catch(() => null)
                        const text = await page.$eval(step.selector, el => el.innerText).catch(() => null)
                        extractedData[step.selector] = text
                    }
                    break
                case 'wait':
                    if (step.waitMs) {
                        await new Promise(r => setTimeout(r, step.waitMs))
                    }
                    break
            }
        }

        const title = await page.title()
        const content = await page.content()

        return {
            ok: true,
            title,
            htmlPreview: content.slice(0, 1000),
            extractedData,
            logs
        }
    } catch (err) {
        return { ok: false, reason: err.message || String(err) }
    } finally {
        if (browser) await browser.close()
    }
}

module.exports = { runHeadlessAutomation }
