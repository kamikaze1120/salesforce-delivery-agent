import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
// Test-only PostgreSQL engine installed outside the application tree, without credentials.
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const pg=new PGlite();
await pg.exec(`create role anon; create role authenticated; create role service_role;
create table public.workspaces(id uuid primary key);
create table public.jobs(id uuid primary key,workspace_id uuid,busy boolean,data jsonb);`);
await pg.exec(await readFile(new URL('../database/migrations/004_target_locks.sql',import.meta.url),'utf8'));
const w1='00000000-0000-4000-8000-000000000001',w2='00000000-0000-4000-8000-000000000002',org='00D000000000001AAA',other='00D000000000002AAA';
await pg.query('insert into workspaces values($1),($2)',[w1,w2]);
const state={artifacts:{hash:'artifact'},orgContext:{org:{id:org}},pipeline:{id:'pipeline',policy:{stages:[{name:'dev',orgId:org},{name:'qa',orgId:other}]},stages:[{name:'dev',runId:'1',status:'running',operations:[{kind:'deployment',phase:'submitted'}]}]}};
for(const w of [w1,w2])await pg.query('insert into jobs values($1,$1,true,$2)',[w,state]);
const acquire=async(w,orgId=org,scope='pipeline:pipeline:dev:1')=>(await pg.query('select acquire_target_org($1,$1,$2,$3,$4) as ok',[w,orgId,scope,'artifact'])).rows[0].ok;
const release=async(w,scope='pipeline:pipeline:dev:1')=>(await pg.query('select release_target_org($1,$1,$2,$3) as ok',[w,org,scope])).rows[0].ok;
assert.equal(await acquire(w1),true);assert.equal(await acquire(w2),false);assert.equal(await acquire(w1),true);
assert.equal(await acquire(w2,other,'pipeline:pipeline:qa:2'),true);
await pg.exec("update target_org_locks set lease_until=now()-interval '1 day'");
assert.equal(await acquire(w2),false,'expired lease must not unlock uncertain writes');
await pg.query('update jobs set busy=false where id=$1',[w1]);assert.equal(await release(w1),false);
state.pipeline.stages[0].status='failed';state.pipeline.stages[0].operations[0].phase='completed';
await pg.query('update jobs set data=$2 where id=$1',[w1,state]);assert.equal(await release(w2),false);assert.equal(await release(w1),true);
assert.equal(await acquire(w2),true);
assert.equal((await pg.query("select count(*)::int as n from target_org_lock_events where action='release_verified_terminal'")).rows[0].n,1);
// Direct sandbox writes use the same global table and release only on a recorded terminal result.
await pg.exec('delete from target_org_locks');
const direct={artifacts:{hash:'artifact'},orgContext:{org:{id:org}},targetLock:{id:'direct-id',field:'validation'},operation:{phase:'response_recorded'},validation:{result:{done:false}}};
await pg.query('update jobs set busy=true,data=$2 where id=$1',[w1,direct]);assert.equal(await acquire(w1,org,'direct:direct-id'),true);
await pg.query('update jobs set busy=false where id=$1',[w1]);assert.equal(await release(w1,'direct:direct-id'),false);
direct.validation.result.done=true;await pg.query('update jobs set data=$2 where id=$1',[w1,direct]);assert.equal(await release(w1,'direct:direct-id'),true);
// Browser roles cannot invoke security-definer lock functions.
await pg.exec('set role authenticated');await assert.rejects(()=>pg.query('select target_lock_schema_version()'),/permission denied/);await pg.exec('reset role');
await pg.close();console.log('Target-lock SQL verified: cross-workspace exclusion, unrelated orgs, heartbeat, lease retention, terminal release, direct-write locks and role isolation.');
