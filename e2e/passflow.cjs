// Klicktest av hela passflodet mot en fejkad Supabase. Kors med
//   npm run e2e
// (startar en tillfallig dev-server pa port 5199, se scripts/e2e.sh).
// Varje kontroll skriver OK eller FEL; skriptet avslutas med kod 1 om nagot
// fallerade, eller om sidan kastade ett fel. Skarmdumpar hamnar i e2e/out/.
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

// Samma version som appen, annars ligger Vad ar nytt?-rutan over allt
const WHATSNEW = (fs.readFileSync(path.join(__dirname, '../src/components/shared/WhatsNew.jsx'), 'utf8').match(/WHATSNEW_VERSION = '([^']+)'/) || [])[1]
const BASE = process.env.BASE || 'http://localhost:5199'
const OUT = path.join(__dirname, 'out')
fs.mkdirSync(OUT, { recursive: true })
const UID = '11111111-1111-1111-1111-111111111111'
const daysAgo = d => new Date(Date.now() - d * 864e5).toISOString()
const set = (w, r, x = {}) => ({ id: Math.random().toString(36).slice(2), type: 'work', weight: String(w), reps: String(r), rir: 1, done: true, ...x })
const E = (name, workSets, repsMin = 6, repsMax = 8, x = {}) => ({ name, workSets, repsMin, repsMax, ...x })

// Program: Pass B ar nasta (Pass A kordes senast). Forsta ovningen har ett
// uppvarmningsset, andra ar en kabelovning (for "Annat gym").
const program = { id: 'prog-1', name: 'Testprogram', user_id: UID, is_global: false, sessions: [
  { name: 'Pass A', exercises: [E('Knäböj', 3), E('Rumänska marklyft', 3)] },
  { name: 'Pass B', exercises: [E('Lutande hantelpress', 3, 8, 10, { warmupSets: 1 }), E('Latsdrag med smalt neutralt grepp', 3), E('Triceps pushdown', 2, 10, 12)] },
] }
const lib = [
  ['Knäböj', 'Quads', 'Skivstång', ['Rumpa', 'Adduktorer'], ['Core']],
  ['Rumänska marklyft', 'Hamstrings', 'Skivstång', ['Rumpa', 'Ländrygg'], ['Core']],
  ['Lutande hantelpress', 'Bröst', 'Hantel', ['Främre axel', 'Triceps'], ['Rotatorkuff']],
  ['Latsdrag med smalt neutralt grepp', 'Lats', 'Kabel', ['Biceps', 'Övre rygg'], ['Bakre axel']],
  ['Triceps pushdown', 'Triceps', 'Kabel', [], ['Underarmar', 'Core']],
].map(([name, mg, eq, sec, ter], i) => ({ id: 'e' + i, name, muscle_group: mg, secondary_muscles: sec, tertiary_muscles: ter, equipment: eq, movement_pattern: 'Press', user_id: null }))
const wo = (id, name, d, mins, exercises) => ({ id, user_id: UID, session_name: name, started_at: daysAgo(d + mins / 1440), finished_at: daysAgo(d), adjusted: false, exercises })
const history = [
  wo('h1', 'Pass A', 2, 95, [{ name: 'Knäböj', sets: [set(100, 6), set(100, 6)] }, { name: 'Rumänska marklyft', sets: [set(90, 8)] }]),
  wo('h2', 'Pass B', 5, 62, [{ name: 'Lutande hantelpress', sets: [set(22, 8), set(22, 8), set(22, 8)] }, { name: 'Latsdrag med smalt neutralt grepp', sets: [set(55, 7), set(55, 7)] }, { name: 'Triceps pushdown', sets: [set(30, 10)] }]),
]

let failures = 0
const ok = (cond, what, extra = '') => { console.log(`${cond ? 'OK ' : 'FEL'}  ${what}${extra ? '  (' + extra + ')' : ''}`); if (!cond) failures++ }

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text().slice(0, 200)) })
  const writes = []
  await page.route('https://test.supabase.co/**', async route => {
    const req = route.request(); const url = new URL(req.url()); const m = req.method()
    const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': '*' }, body: JSON.stringify(body) })
    if (m === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    const table = url.pathname.replace('/rest/v1/', '')
    if (m !== 'GET') writes.push({ table, m, body: req.postData() || '' })
    if (url.pathname.startsWith('/auth/')) return json({})
    if (table === 'programs') return json(m === 'GET' ? [program] : program)
    if (table === 'profiles') { const o = { active_program_id: 'prog-1', display_name: 'Test', intro_dismissed: true, whatsnew_seen: WHATSNEW, is_admin: false }; return json(single ? o : [o]) }
    if (table === 'exercises') {
      const name = url.searchParams.get('name')?.replace(/^eq\./, '')
      const hit = lib.find(e => e.name === name) ?? lib[2]
      return json(single ? hit : lib)
    }
    if (table === 'workouts') {
      if (m === 'GET') return json(single ? history[0] : history)
      const rec = { ...history[0], id: 'new-1', finished_at: null }
      return json(single ? rec : [rec])
    }
    if (table === 'user_rest_overrides' && m !== 'GET') return json(single ? { exercise_name: 'x', rest_seconds: 180 } : [])
    return json(single ? null : [])
  })
  const session = { access_token: 'a.b.c', refresh_token: 'r', token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, user: { id: UID, email: 't@example.com', user_metadata: {}, app_metadata: {}, aud: 'authenticated' } }
  await page.addInitScript(([s]) => { localStorage.setItem('sb-test-auth-token', JSON.stringify(s)) }, [session])

  const cdp = await ctx.newCDPSession(page)
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
  const swipe = async (y, x0, x1) => { await touch('touchStart', x0, y); for (let k = 1; k <= 12; k++) { await touch('touchMove', x0 + (x1 - x0) * k / 12, y); await page.waitForTimeout(16) } await touch('touchEnd'); await page.waitForTimeout(500) }
  const hold = async (x, y, ms) => { await touch('touchStart', x, y); await page.waitForTimeout(ms); await touch('touchEnd'); await page.waitForTimeout(400) }
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('gymbanan_active_workout') || 'null'))
  const exState = async i => (await state())?.exercises?.[i]
  const shot = n => page.screenshot({ path: path.join(OUT, n + '.png') })
  const step = async (name, fn) => { try { await fn() } catch (e) { ok(false, name, String(e).split('\n')[0].slice(0, 160)) } }

  // ── Startsidan ──
  await step('startsidan laddar', async () => {
    await page.goto(BASE + '/')
    await page.getByRole('button', { name: /Starta Pass/ }).waitFor({ timeout: 20000 })
    await page.waitForFunction(() => !document.getElementById('boot-splash'), null, { timeout: 15000 })
    ok(true, 'startsidan laddar och startskarmen forsvinner')
    const txt = await page.locator('body').innerText()
    ok(!/\b(6\d|[7-9]\d|\d{3}) min\b/.test(txt), 'passtid over en timme visas som h + min', (txt.match(/\d+ h \d+ min|\d+ min/) || [''])[0])
    await shot('01-home')
  })

  // ── Starta passet ──
  await step('starta pass', async () => {
    await page.getByRole('button', { name: /Starta Pass/ }).click()
    await page.getByRole('button', { name: 'Markera set som klart' }).waitFor({ timeout: 20000 })
    await page.waitForTimeout(800)
    const ex = await exState(0)
    ok(!!ex, 'passet startar och sparas lokalt')
    ok(ex?.sets?.[0]?.type === 'warmup', 'forsta setet ar uppvarmning')
    const bananas = await page.locator('[aria-label*="banan" i], [class*="fruit"]').count()
    ok(bananas >= 3, 'bananraden har en banan per ovning', `${bananas}`)
    await shot('02-start')
  })

  // ── Uppvarmning klar -> vila ──
  await step('uppvarmning och vila', async () => {
    await page.getByRole('button', { name: 'Markera set som klart' }).click()
    await page.waitForTimeout(700)
    ok((await exState(0)).sets[0].done === true, 'uppvarmningssetet bockas av')
    ok(await page.getByRole('button', { name: /^Vila, / }).isVisible(), 'vilotimern visas')
    await page.getByRole('button', { name: 'Hoppa över' }).click()
    await page.waitForTimeout(400)
  })

  // ── Hall inne + ──
  await step('hall inne plus', async () => {
    const before = parseFloat((await exState(0)).sets[1].weight)
    const box = await page.getByRole('button', { name: 'Öka vikt' }).boundingBox()
    await hold(box.x + box.width / 2, box.y + box.height / 2, 1200)
    const after = parseFloat((await exState(0)).sets[1].weight)
    ok(after - before >= 6, 'hall inne + stegar flera gånger', `${before} -> ${after}`)
    ok((await exState(0)).sets[1].type === 'work', 'hall inne pa + byter inte settyp')
    // tillbaka till ursprunglig vikt via inmatning
    const kg = page.getByRole('spinbutton', { name: 'Vikt i kg' })
    await kg.fill(String(before)); await kg.blur(); await page.waitForTimeout(200)
  })

  // ── Arbetsset klart -> nasta fylls i ──
  await step('arbetsset', async () => {
    await page.getByRole('button', { name: 'Markera set som klart' }).click()
    await page.waitForTimeout(700)
    const ex = await exState(0)
    ok(ex.sets[1].done, 'arbetsset 1 bockas av')
    ok(ex.sets[2].weight === ex.sets[1].weight, 'nasta set far samma vikt', `${ex.sets[1].weight} / ${ex.sets[2].weight}`)
    await page.getByRole('button', { name: 'Hoppa över' }).click().catch(() => {})
    await page.waitForTimeout(300)
    await shot('03-after-set')
  })

  // ── Svep och langtryck pa kommande rad ──
  await step('svep och langtryck', async () => {
    const rows = page.getByRole('button', { name: /^Öppna set/ })
    const n0 = (await exState(0)).sets.length
    await rows.last().scrollIntoViewIfNeeded(); await page.waitForTimeout(300)
    let box = await rows.last().boundingBox()
    await swipe(box.y + box.height / 2, 120, 330)
    await page.getByRole('button', { name: /Dubblera/ }).filter({ visible: true }).last().click()
    await page.waitForTimeout(400)
    const afterDup = await exState(0)
    ok(afterDup.sets.length === n0 + 1, 'svep hoger dubblerar setet', `${n0} -> ${afterDup.sets.length}`)
    ok(afterDup.sets.every(s => s.done || !s.isPB), 'kopian ar inte PB')
    await rows.last().scrollIntoViewIfNeeded(); await page.waitForTimeout(300)
    box = await rows.last().boundingBox()
    await swipe(box.y + box.height / 2, 330, 120)
    await page.getByRole('button', { name: 'Ta bort set' }).filter({ visible: true }).last().click()
    await page.waitForTimeout(400)
    ok((await exState(0)).sets.length === n0, 'svep vanster tar bort setet')
    const lastIdx = (await exState(0)).sets.length - 1
    await rows.last().scrollIntoViewIfNeeded(); await page.waitForTimeout(300)
    box = await rows.last().boundingBox()
    await hold(box.x + 60, box.y + box.height / 2, 700)
    ok((await exState(0)).sets[lastIdx].type === 'warmup', 'langtryck gor sista setet till uppvarmning')
    await rows.last().scrollIntoViewIfNeeded(); await page.waitForTimeout(300)
    box = await rows.last().boundingBox()
    await hold(box.x + 60, box.y + box.height / 2, 700)
    ok((await exState(0)).sets[lastIdx].type === 'work', 'langtryck igen gor det till arbetsset')
    await shot('04-rows')
  })

  // ── Forra -> historik ──
  await step('forra historik', async () => {
    await page.getByRole('button', { name: /^Förra: .*Visa historik/ }).click()
    await page.waitForTimeout(700)
    ok(await page.getByText(/Lutande hantelpress/).last().isVisible(), 'Förra oppnar ovningens historik')
    await shot('05-history')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /Stäng/ }).filter({ visible: true }).last().click().catch(() => {})
    await page.waitForTimeout(500)
  })

  // ── Ovningens sida: vila ──
  await step('vila pa ovningens sida', async () => {
    writes.length = 0
    await page.getByRole('button', { name: 'Lutande hantelpress', exact: true }).first().click()
    await page.waitForTimeout(800)
    const grp = page.getByRole('group', { name: 'Vila mellan set' })
    ok(await grp.isVisible(), 'ovningens sida visar Vila mellan set')
    await grp.getByRole('button', { name: '3:00' }).click()
    await page.waitForTimeout(500)
    ok((await exState(0)).restSeconds === 180, 'vilan galler direkt i passet')
    ok(writes.some(w => w.table === 'user_rest_overrides'), 'vilan sparas pa ovningen')
    await shot('06-detail')
    await page.getByRole('button', { name: 'Stäng' }).filter({ visible: true }).first().click()
    await page.waitForTimeout(500)
  })

  // ── Annat gym pa kabelovning ──
  await step('annat gym', async () => {
    await page.getByRole('button', { name: /Latsdrag med smalt/ }).first().click()
    await page.waitForTimeout(800)
    await page.getByRole('button', { name: 'Fler alternativ' }).filter({ visible: true }).first().click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Annat gym idag' }).click()
    await page.waitForTimeout(300)
    ok((await exState(1)).otherGym === true, 'Annat gym slas pa')
    ok(await page.getByRole('button', { name: /^Annat gym:/ }).isVisible(), 'Annat gym-chippet visas')
    await page.getByRole('spinbutton', { name: 'Vikt i kg' }).fill('200')
    await page.getByRole('button', { name: 'Markera set som klart' }).click()
    await page.waitForTimeout(600)
    const s = (await exState(1)).sets.find(x => x.done && x.type === 'work')
    ok(s && !s.isPB, 'ingen PB pa annat gym', s ? `${s.weight} kg` : '')
    await page.getByRole('button', { name: 'Hoppa över' }).click().catch(() => {})
    await shot('07-othergym')
  })

  // ── Avsluta och spara ──
  await step('avsluta', async () => {
    writes.length = 0
    await page.getByRole('button', { name: /Avsluta passet|Avsluta pass/ }).filter({ visible: true }).last().click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'Spara pass' }).click()
    await page.waitForTimeout(2000)
    const fin = writes.find(w => w.table === 'workouts' && /finished_at/.test(w.body))
    ok(!!fin, 'passet sparas med finished_at')
    ok(!!fin && /"other_gym":true/.test(fin.body), 'annat gym-flaggan sparas')
    ok((await state()) === null, 'lokala kopian tas bort efter sparning')
    await shot('08-finished')
  })

  ok(errors.length === 0, 'inga fel i konsolen', errors.slice(0, 3).join(' | '))
  await browser.close()
  console.log(failures ? `\n${failures} FEL` : '\nAllt OK')
  process.exit(failures ? 1 : 0)
})()
