// Security test for the database: applies every migration to a throwaway
// PostgreSQL (with a small stand-in for Supabase's auth/storage schemas) and
// checks that RLS and privileges behave as intended for each role.
// Run: cd supabase/tests && npm install && npm test
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const here = path.dirname(fileURLToPath(import.meta.url))
const M = path.join(here, '../migrations/')
const db = new EmbeddedPostgres({ databaseDir: path.join(here, '.pgdata'), user: 'postgres', password: 'pw', port: 54329, persistent: false })
await db.initialise(); await db.start()
const c = new pg.Client({ host:'localhost', port:54329, user:'postgres', password:'pw', database:'postgres' })
await c.connect()
let fails=0
const ok=(n)=>console.log('PASS', n)
const bad=(n,e)=>{fails++;console.log('FAIL', n, e??'')}
try {
  await c.query(fs.readFileSync(path.join(here, 'shim.sql'),'utf8'))
  for (const f of fs.readdirSync(M).sort()) { await c.query(fs.readFileSync(M+f,'utf8')); console.log('applied', f) }
  const MGR='11111111-1111-1111-1111-111111111111', DIR='22222222-2222-2222-2222-222222222222', NOP='33333333-3333-3333-3333-333333333333'
  await c.query(`insert into auth.users values ('${MGR}','m@x'),('${DIR}','d@x'),('${NOP}','n@x');
    insert into public.profiles(id, full_name, role) values ('${MGR}','Manager','finance_manager'),('${DIR}','Director','director');`)
  const as = async (uid, role, sql, params) => {
    await c.query('begin')
    try {
      await c.query(`set local role ${role}`)
      if (uid) await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid])
      const r = await c.query(sql, params); await c.query('commit'); return r
    } catch (e) { await c.query('rollback'); throw e }
  }
  const expectFail = async (name, fn) => { try { const r = await fn(); if (r && r.rowCount===0 && /update|delete/i.test(name)) ok(name+' (0 rows)'); else bad(name, 'succeeded: '+JSON.stringify(r?.rows)) } catch(e) { ok(name+' -> '+e.message) } }
  // Manager insert, with spoofed created_by
  const ins = await as(MGR,'authenticated',`insert into expenses(expense_date, amount, category, payee, created_by) values ('2026-09-10', 100, 'Rent', 'Landlord', '${DIR}') returning id, created_by`)
  const eid = ins.rows[0].id
  ins.rows[0].created_by===MGR ? ok('created_by forced to caller') : bad('created_by spoofed')
  await as(MGR,'authenticated',`insert into earnings(earning_date, amount, source) values ('2026-09-12', 500, 'Services')`).then(()=>ok('earning without client allowed (optional)')).catch(e=>console.log('note', e.message))
  await as(MGR,'authenticated',`insert into earnings(earning_date, amount, source, client_name) values ('2026-09-12', 500, 'Services', 'Acme')`)
  const inv = await as(MGR,'authenticated',`insert into investors(full_name) values ('Alice') returning id`)
  const iid = inv.rows[0].id
  await as(MGR,'authenticated',`insert into investments(investor_id, amount, invested_at) values ($1, 1000, '2026-09-30T20:00:00Z')`, [iid])
  // Director cannot write
  await expectFail('director insert expense', ()=>as(DIR,'authenticated',`insert into expenses(expense_date, amount, category, payee) values ('2026-09-10', 1, 'Rent', 'x')`))
  await expectFail('director update expense', ()=>as(DIR,'authenticated',`update expenses set amount = 1 where id = $1`, [eid]))
  await expectFail('director delete expense', ()=>as(DIR,'authenticated',`delete from expenses where id = $1`, [eid]))
  await expectFail('director insert investor', ()=>as(DIR,'authenticated',`insert into investors(full_name) values ('x')`))
  await expectFail('director update investor', ()=>as(DIR,'authenticated',`update investors set full_name='y' where id=$1`,[iid]))
  await expectFail('director update investment', ()=>as(DIR,'authenticated',`update investments set amount=1`))
  await expectFail('director update own profile role', ()=>as(DIR,'authenticated',`update profiles set role='finance_manager' where id=$1`,[DIR]))
  await expectFail('director insert audit', ()=>as(DIR,'authenticated',`insert into audit_log(table_name, action) values ('x','INSERT')`))
  await expectFail('director upload', ()=>as(DIR,'authenticated',`insert into storage.objects(bucket_id, name) values ('attachments','expenses/a/b.pdf')`))
  // Manager cannot hard delete / truncate / touch audit
  await expectFail('manager delete expense', ()=>as(MGR,'authenticated',`delete from expenses where id = $1`, [eid]))
  await expectFail('manager truncate', ()=>as(MGR,'authenticated',`truncate expenses`))
  await expectFail('manager update audit', ()=>as(MGR,'authenticated',`update audit_log set action='X'`))
  await expectFail('manager delete audit', ()=>as(MGR,'authenticated',`delete from audit_log`))
  await expectFail('manager insert profile', ()=>as(MGR,'authenticated',`insert into profiles values ($1,'n','finance_manager')`,[NOP]))
  await expectFail('manager upload outside folder', ()=>as(MGR,'authenticated',`insert into storage.objects(bucket_id, name) values ('attachments','evil/b.pdf')`))
  await as(MGR,'authenticated',`insert into storage.objects(bucket_id, name) values ('attachments','expenses/${eid}/a.pdf')`).then(()=>ok('manager upload ok'))
  await expectFail('manager delete object', ()=>as(MGR,'authenticated',`delete from storage.objects`))
  await expectFail('manager update object', ()=>as(MGR,'authenticated',`update storage.objects set name='expenses/x.pdf'`))
  await expectFail('manager overflow text', ()=>as(MGR,'authenticated',`update expenses set description=repeat('a',2000) where id=$1`,[eid]))
  // Manager update keeps created_by
  await as(MGR,'authenticated',`update expenses set amount = 150, created_by = $2, created_at = '2000-01-01' where id = $1`, [eid, DIR])
  const chk = await c.query('select created_by, created_at, amount from expenses where id=$1',[eid])
  chk.rows[0].created_by===MGR && chk.rows[0].created_at.getFullYear()>2000 ? ok('update cannot rewrite ownership') : bad('ownership rewritten', chk.rows[0])
  // Soft delete then frozen
  await as(MGR,'authenticated',`update expenses set is_deleted = true where id = $1`, [eid])
  await expectFail('update soft-deleted row', ()=>as(MGR,'authenticated',`update expenses set is_deleted=false where id=$1`,[eid]))
  // Investor deactivate, then contribution blocked
  await as(MGR,'authenticated',`update investors set is_active=false where id=$1`,[iid])
  await expectFail('contribution to inactive investor', ()=>as(MGR,'authenticated',`insert into investments(investor_id, amount) values ($1, 5)`,[iid]))
  await as(MGR,'authenticated',`update investments set notes='edit ok', investor_id=investor_id`).then(()=>ok('edit contribution of inactive investor')).catch(e=>bad('edit inactive', e.message))
  // Anon sees nothing
  await expectFail('anon select expenses', ()=>as(null,'anon',`select * from expenses`))
  await expectFail('anon rpc', ()=>as(null,'anon',`select dashboard_summary()`))
  // No-profile user sees nothing
  const np = await as(NOP,'authenticated',`select count(*)::int n from expenses`); np.rows[0].n===0 ? ok('no-profile user sees 0 rows') : bad('no-profile sees rows')
  // Director reads
  const dr = await as(DIR,'authenticated',`select count(*)::int n from expenses`); dr.rows[0].n===1 ? ok('director reads expenses (incl. deleted row at db level)') : bad('director read', dr.rows)
  const pr = await as(DIR,'authenticated',`select count(*)::int n from profiles`); pr.rows[0].n===2 ? ok('director reads profile names') : bad('profiles', pr.rows)
  // Audit
  const au = await c.query(`select table_name, action, changed_by from audit_log order by id`)
  console.log(au.rows.map(r=>`${r.table_name}:${r.action}:${r.changed_by===MGR?'MGR':r.changed_by}`).join(' | '))
  au.rows.some(r=>r.action==='SOFT_DELETE' && r.table_name==='expenses') && au.rows.some(r=>r.action==='SOFT_DELETE' && r.table_name==='investors') ? ok('audit soft deletes') : bad('audit')
  // Dashboard
  const ds = await as(DIR,'authenticated',`select dashboard_summary('2026-09-01','2026-10-31')`); console.log(JSON.stringify(ds.rows[0].dashboard_summary))
  const ft = await as(DIR,'authenticated',`select filtered_total('investments', '2026-10-01', '2026-10-01') t`); Number(ft.rows[0].t)===1000 ? ok('IST date bucket for investment at 20:00Z') : bad('tz', ft.rows)
  const is = await as(DIR,'authenticated',`select full_name, total_invested, contribution_count from investor_summary`); console.log('INVESTORS', JSON.stringify(is.rows))
  const ns = await as(NOP,'authenticated',`select count(*)::int n from investor_summary`); ns.rows[0].n===0 ? ok('view respects RLS') : bad('view leaks')
} catch (e) { bad('harness', e.message) }
await c.end(); await db.stop()
console.log(fails ? `${fails} FAILURES` : 'ALL PASSED')
fs.rmSync(path.join(here, '.pgdata'), { recursive: true, force: true })
process.exit(fails ? 1 : 0)
