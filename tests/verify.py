"""Optional end-to-end checks. Run against the local static server; no app build."""
import argparse
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://localhost:8000/IT-Certifications/')
parser.add_argument('--engine', choices=['chromium','webkit'], default='chromium')
parser.add_argument('--executable', default=None)
args = parser.parse_args()
URL = args.url
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results'
OUT.mkdir(exist_ok=True)
CONTENT = 'cert-practice.content.v1'
STATE = 'cert-practice.attempts.v1'

async def ready(page):
    await page.wait_for_selector('[data-exam]')
    await page.wait_for_function("document.querySelector('#sync-status').textContent.includes('up to date')")

async def active(page):
    return await page.evaluate("Object.values(JSON.parse(localStorage.getItem('cert-practice.attempts.v1')).exams).map(e=>e.active).filter(Boolean).sort((a,b)=>b.startedAt-a.startedAt)[0]")

async def finish(page):
    await page.locator('#finish').click()
    await page.locator('#confirm-submit').click()
    await page.wait_for_selector('.score-circle')

async def main():
    async with async_playwright() as p:
        launcher = getattr(p, args.engine)
        browser = await launcher.launch(**({'executable_path': args.executable} if args.executable else {}))
        context = await browser.new_context(viewport={'width':1440,'height':1100})
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(URL)
        await ready(page)
        await page.screenshot(path=str(OUT / f'{args.engine}-desktop.png'), full_page=True)
        assert await page.locator('[data-exam]').count() == 2
        assert await page.locator('[data-exam]').nth(0).get_attribute('aria-pressed') == 'true'
        print('PASS initial load, two exam cards, desktop layout')
        core = await page.evaluate('''async () => {
          const c = await import('./core.js');
          const live = c.readContent();
          const assert = (x,m) => { if (!x) throw Error(m); };
          const clone = x => JSON.parse(JSON.stringify(x));
          let checks = 0;
          for (const e of live.catalog.exams) {
            const b = c.validateBank(live.banks[e.id],e);
            assert(b.questions.length === 20, '20 questions');
            assert(new Set(b.questions.map(q=>q.domain)).size === b.domains.length,'domain coverage');
            assert(b.questions.some(q=>q.type==='multiple'),'multiple items');
            const q = b.questions.find(q=>q.type==='multiple');
            assert(c.isCorrect(q,[...q.correctAnswerIds].reverse()),'order-independent full key');
            assert(!c.isCorrect(q,q.correctAnswerIds.slice(1)),'partial must fail');
            assert(!c.isCorrect(q,[...q.correctAnswerIds,q.choices.find(x=>!q.correctAnswerIds.includes(x.id)).id]),'extra must fail');
            assert(!c.isCorrect(q,[q.correctAnswerIds[0],q.correctAnswerIds[0]]),'duplicates must fail');
            const a = c.createAttempt(e,b,{mode:'timed',count:20,minutes:1},1000);
            assert(new Set(a.questions.map(q=>q.id)).size===20,'without replacement');
            a.questions.forEach((q,i)=>a.answers[q.id]=i===0?[]:i===1?[q.choices.find(x=>!q.correctAnswerIds.includes(x.id)).id]:q.correctAnswerIds);
            const s = c.score(a);
            assert(s.correct===18 && s.unanswered===1 && s.percent===90,'mixed scoring');
            assert(s.domains.reduce((n,d)=>n+d.correct,0)===18,'domain totals');
            const state = {schemaVersion:1,exams:{[e.id]:{active:a,history:[]}}};
            assert(c.expireAttempts(state,60999).length===0,'deadline intact');
            assert(c.expireAttempts(state,61000).length===1,'expire at deadline');
            assert(c.expireAttempts(state,62000).length===0,'idempotent expiry');
            assert(state.exams[e.id].history.length===1,'single history entry');
            checks++;
          }
          const mem = {value:null,getItem(){return this.value},setItem(k,v){this.value=v}};
          const fetcher = data => async path => ({ok:true,json:async()=>clone(path.includes('catalog')?data.catalog:data.banks[data.catalog.exams.find(e=>path.endsWith(e.bank)).id])});
          await c.updateContent(mem,fetcher(live));
          const original = mem.value;
          const failUpdate = async bad => { let failed=false; try {await c.updateContent(mem,fetcher(bad));} catch {failed=true} assert(failed && mem.value===original,'bad update preserves last copy'); checks++; };
          let bad = clone(live); bad.catalog.exams[0].bank='../bad.json'; await failUpdate(bad);
          for (const mutate of [b=>b.questions.push(b.questions[0]),b=>b.questions[0].correctAnswerIds=['missing'],b=>b.questions[0].choices[0].explanation='',b=>b.questions[0].domain='missing',b=>b.version='wrong',b=>b.questions[0].prompt+=' silent edit']) {
            bad=clone(live); mutate(bad.banks[bad.catalog.exams[1].id]); await failUpdate(bad);
          }
          const next=clone(live), e=next.catalog.exams[0]; e.version='test-v2';e.bank='content/aws-cloud-practitioner/test-v2.json'; next.banks[e.id].version=e.version;
          await c.updateContent(mem,fetcher(next)); assert(c.readContent(mem).banks[e.id].version==='test-v2','valid version installed');
          const pinned=c.createAttempt(live.catalog.exams[0],live.banks[e.id],{mode:'practice',count:2,minutes:30});
          assert(pinned.version!==next.banks[e.id].version,'attempt pinned');
          return checks;
        }''')
        print(f'PASS content validation, full-key scoring, domain breakdown, deadlines, atomic updates ({core} grouped cases)')

        exam_ids = await page.locator('[data-exam]').evaluate_all('(xs)=>xs.map(x=>x.dataset.exam)')
        for exam_id in exam_ids:
            for mode in ['practice','timed']:
                await page.locator('#nav-home').click()
                await page.locator(f'[data-exam="{exam_id}"]').click()
                await page.locator(f'[data-mode="{mode}"]').click()
                if mode=='practice':
                    await page.locator('#domain').select_option('1')
                else:
                    await page.locator('#minutes').fill('7')
                await page.locator('#count').fill('2')
                await page.locator('#setup-form button[type="submit"]').click()
                a = await active(page)
                assert a['examId']==exam_id and a['mode']==mode
                if mode=='practice': assert all(q['domain']=='1' for q in a['questions'])
                q = a['questions'][0]
                for aid in q['correctAnswerIds']:
                    await page.locator(f'input[name="answer"][value="{aid}"]').check()
                await page.locator('#flag').click()
                saved = await active(page)
                await page.reload()
                await page.wait_for_selector('#flag')
                resumed = await active(page)
                assert saved==resumed
                assert await page.locator('#flag').get_attribute('aria-pressed')=='true'
                if mode=='practice':
                    await page.locator('#check').click()
                    assert 'Correct' in await page.locator('.explanation h3').inner_text()
                    assert await page.locator('input[name="answer"]:disabled').count()==4
                else:
                    assert await page.locator('.explanation').count()==0
                    assert resumed['deadline']==a['deadline']
                await page.locator('#next').click()
                await page.locator('[data-index="0"]').click()
                await finish(page)
                assert await page.locator('.score-circle strong').inner_text()=='50%'
                assert '1 unanswered' in await page.locator('.result-summary').inner_text()
                assert await page.locator('.review-card').count()==1
                await page.locator('#review-toggle').click()
                assert await page.locator('.review-card').count()==2
                print(f'PASS {exam_id}: {mode}, domain/count settings, flags, skip/revisit, refresh/resume, results')
        await page.locator('#nav-history').click()
        assert await page.locator('.history-item').count()==4
        panels=page.locator('.panel')
        assert await panels.count()==2
        for i in range(2): assert await panels.nth(i).locator('.history-item').count()==2
        await page.locator('.history-item').first.click()
        assert await page.locator('.score-circle strong').inner_text()=='50%'
        print('PASS independent per-exam history and persisted result review')

        # Partial multi-answer selection earns zero. Complete exact key earns full credit.
        await page.locator('#nav-home').click()
        await page.locator('[data-mode="timed"]').click()
        await page.locator('#count').fill('20')
        await page.locator('#setup-form button[type="submit"]').click()
        a=await active(page)
        multiples=[(i,q) for i,q in enumerate(a['questions']) if q['type']=='multiple']
        i,q=multiples[0]
        await page.locator(f'[data-index="{i}"]').click()
        assert f"Select {len(q['correctAnswerIds'])} answers" in await page.locator('#selection-hint').inner_text()
        await page.locator(f'input[value="{q["correctAnswerIds"][0]}"]').check()
        j,r=multiples[1]
        await page.locator(f'[data-index="{j}"]').click()
        for aid in r['correctAnswerIds']: await page.locator(f'input[value="{aid}"]').check()
        await finish(page)
        assert await page.locator('.score-circle strong').inner_text()=='5%'
        assert '18 unanswered' in await page.locator('.result-summary').inner_text()
        print('PASS multi-select instructions and exact-match UI scoring')

        # Reopen an expired session; its stored deadline must not restart.
        await page.locator('#nav-home').click()
        await page.locator('[data-mode="timed"]').click()
        await page.locator('#count').fill('1')
        await page.locator('#setup-form button[type="submit"]').click()
        await page.evaluate('''() => {const s=JSON.parse(localStorage.getItem('cert-practice.attempts.v1')); for(const e of Object.values(s.exams)) if(e.active)e.active.deadline=Date.now()-1000;localStorage.setItem('cert-practice.attempts.v1',JSON.stringify(s));}''')
        await page.close()
        page=await context.new_page()
        page.on('pageerror', lambda e:errors.append(str(e)))
        await page.goto(URL)
        await page.wait_for_selector('.score-circle')
        assert 'Time expired' in await page.locator('.banner').inner_text()
        assert await page.locator('.score-circle strong').inner_text()=='0%'
        await page.reload()
        await page.wait_for_selector('[data-exam]')
        histories=await page.evaluate("Object.values(JSON.parse(localStorage.getItem('cert-practice.attempts.v1')).exams).flatMap(e=>e.history).length")
        assert histories==6
        print('PASS closed-browser deadline expiry, automatic submission, no duplicate history')

        # A running foreground timer also submits without a user click.
        await page.locator('[data-mode="timed"]').click()
        await page.locator('#count').fill('1')
        await page.locator('#setup-form button[type="submit"]').click()
        await page.evaluate('''async()=>{const c=await import('./core.js');const s=c.readState();for(const e of Object.values(s.exams))if(e.active)e.active.deadline=Date.now()+600;c.saveState(s);window.dispatchEvent(new StorageEvent('storage',{key:c.STATE_KEY}));}''')
        await page.wait_for_selector('.banner')
        print('PASS foreground timer expiration')

        # Pin a v1 session, then publish a valid v2 through network interception.
        await page.locator('#nav-home').click()
        await page.locator('[data-exam]').first.click()
        await page.locator('[data-mode="practice"]').click()
        await page.locator('#domain').select_option('all')
        await page.locator('#count').fill('2')
        await page.locator('#setup-form button[type="submit"]').click()
        pinned=await active(page)
        catalog=json.loads((ROOT/'content/catalog.json').read_text())
        exam=catalog['exams'][0]
        v2=json.loads((ROOT/exam['bank']).read_text())
        exam['version']='clf-c02-v2'; exam['bank']='content/aws-cloud-practitioner/clf-c02-v2.json'
        v2['version']=exam['version'];v2['questions'][0]['prompt']+=' (New release)'
        # WebKit's network routing can miss requests passing through a service
        # worker. Mock fetch at the page boundary so this release fixture works
        # consistently while the real app worker remains enabled for offline tests.
        await page.add_init_script("""(() => {
          const originalFetch = window.fetch.bind(window);
          window.fetch = (input, options) => {
            const release = JSON.parse(sessionStorage.getItem('cert-practice-test-release') || 'null');
            if (release && navigator.onLine) {
              const path = new URL(typeof input === 'string' ? input : input.url, location.href).pathname;
              let payload;
              if (path.endsWith('/content/catalog.json')) payload = release.catalog;
              if (path.endsWith('/' + release.catalog.exams[0].bank)) payload = release.bank;
              if (payload) return Promise.resolve(new Response(JSON.stringify(payload), {headers:{'Content-Type':'application/json'}}));
            }
            return originalFetch(input, options);
          };
        })();""")
        await page.evaluate("release => sessionStorage.setItem('cert-practice-test-release',JSON.stringify(release))",{'catalog':catalog,'bank':v2})
        await page.reload()
        await page.wait_for_function("JSON.parse(localStorage.getItem('cert-practice.content.v1')).banks['aws-cloud-practitioner'].version==='clf-c02-v2'")
        assert await active(page)==pinned
        await page.locator('#save-exit').click()
        await page.locator('#resume').click()
        await finish(page)
        assert 'Bank clf-c02-v1' in await page.locator('.intro p').inner_text()
        await page.locator('#nav-home').click()
        await page.locator('#setup-form button[type="submit"]').click()
        assert (await active(page))['version']=='clf-c02-v2'
        print('PASS bank updates install for new attempts while active/history retain original version')

        # Invalid downloaded bank must leave all last-good data intact.
        badcatalog=json.loads(json.dumps(catalog))
        badcatalog['exams'][0]['version']='clf-c02-v3'
        badcatalog['exams'][0]['bank']='content/aws-cloud-practitioner/clf-c02-v3.json'
        badbank=json.loads(json.dumps(v2));badbank['version']='clf-c02-v3';badbank['questions'][0]['correctAnswerIds']=['bad']
        await page.evaluate("release => sessionStorage.setItem('cert-practice-test-release',JSON.stringify(release))",{'catalog':badcatalog,'bank':badbank})
        await page.reload()
        await page.wait_for_function("document.querySelector('#sync-status').textContent.includes('last valid')")
        assert await page.evaluate("JSON.parse(localStorage.getItem('cert-practice.content.v1')).banks['aws-cloud-practitioner'].version")=='clf-c02-v2'
        assert (await active(page))['version']=='clf-c02-v2'
        print('PASS invalid update rejected; cached banks and attempt preserved')
        await page.evaluate("sessionStorage.removeItem('cert-practice-test-release')")
        await page.evaluate("navigator.serviceWorker.ready.then(()=>true)")
        await page.wait_for_function('navigator.serviceWorker.controller !== null')
        await context.set_offline(True)
        await page.reload()
        await page.wait_for_selector('.question')
        assert (await active(page))['version']=='clf-c02-v2'
        await page.locator('#save-exit').click()
        await page.locator('[data-exam]').nth(1).click()
        await page.locator('#setup-form button[type="submit"]').click()
        assert (await active(page))['examId']=='comptia-security-plus'
        await page.reload()
        await page.wait_for_selector('.question')
        await finish(page)
        print('PASS offline app shell, downloaded banks, cross-exam practice, reload/resume and results')
        await context.set_offline(False)

        # Small touch viewport; no horizontal clipping or tiny answer targets.
        await page.set_viewport_size({'width':390,'height':844})
        await page.locator('#nav-home').click()
        await page.screenshot(path=str(OUT/f'{args.engine}-mobile.png'),full_page=True)
        assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        await page.locator('[data-exam]').first.click()
        await page.locator('#resume').click()
        for box in await page.locator('.answer').all():
            bounds=await box.bounding_box();assert bounds['height']>=44
        assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        await page.screenshot(path=str(OUT/f'{args.engine}-mobile-quiz.png'),full_page=True)
        assert not errors, errors
        print('PASS 390px responsive layout, answer touch targets, no JavaScript exceptions')
        await browser.close()
        print(f'ALL CHECKS PASSED ({args.engine})')

asyncio.run(main())
