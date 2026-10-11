import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const deferred = () => { let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve}; };
function fixture() {
  const state = {owner: 'owner', values: new Map(), jolly: new Map(), pages: new Map(), requests: [], disposals: [], events: []};
  const storage = {get: key => state.jolly.get(key), set: (key,value) => state.jolly.set(key,value), remove: key => state.jolly.delete(key)};
  const deps = {
    './account': {cachedAccountId: () => state.owner, accountFetch: () => {const pending = deferred(); state.requests.push(pending); return pending.promise;}},
    './shellStorage': {readShellValueSync: key => state.values.get(key), writeShellValue: (key,value) => state.values.set(key,value), removeShellValue: key => state.values.delete(key), shellKeys: () => [...state.values.keys()]},
    './evolveHost': {edgeUrl: 'https://test'},
    './pageCache': {pageCacheKey: key => state.owner+':'+key, cachedPage: key => state.pages.get(key), rememberPage: (key,value) => {state.pages.set(key,value); return value;}, forgetPageFamily: prefix => {for(const key of state.pages.keys()) if(key.startsWith(prefix))state.pages.delete(key);}},
    '../../../../packages/app-sdk/src/runtime': {applicationContext: () => ({storage})},
    '../../../../packages/ui/packageLink': {writePackageValue: (key,value) => state.events.push({key,value})},
    './market': {invalidateMarketViews: () => {}, uninstallMarketApplication: id => {const pending=deferred(); state.disposals.push({...pending,id}); return pending.promise;}},
    '../runtime/applications': {runningApplicationReleases: () => ({})},
  };
  function load(name) {
    const file='apps/mobile/src/shell/'+name+'.ts';
    const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    const exports={};new Function('require','exports',code)(id=>{assert.ok(deps[id],id);return deps[id];},exports);
    deps['./'+name]=exports;return exports;
  }
  const markers=load('deletedWorkState'),deletion=load('deletedWorks'),gallery=load('worksGallery');
  return {state,markers,deletion,gallery};
}

test('deleted works clear recovery records immediately while runtime disposal runs in background',async()=>{
  const f=fixture(),{state,deletion,markers}=f;
  state.jolly.set('workspaces',JSON.stringify([{appId:'app-remove',title:'A'},{appId:'app-keep',title:'B'}]));
  state.jolly.set('run:app-remove','progress');
  for(const key of ['shell.jules.apps.app-remove.owner','shell.jules.apps.app-remove.token','shell.workshop.application.app-remove','creation.pending.owner.app-remove.edit'])state.values.set(key,'test');
  state.values.set('shell.jules.apps.app-keep.owner','other');
  state.values.set('shell.works.cache.owner',JSON.stringify({works:[{appId:'app-remove'},{appId:'app-keep'}]}));
  state.pages.set('owner:works-gallery::',{works:[{appId:'app-remove'}]});
  await deletion.syncDeletedWorks('other',['app-keep']);assert.equal(markers.isWorkDeleted('app-keep'),false);
  await deletion.syncDeletedWorks('owner',['app-remove','jolly','invalid/id']);
  assert.equal(markers.isWorkDeleted('app-remove'),true);
  assert.equal(markers.isWorkDeleted('jolly'),false);
  assert.deepEqual(JSON.parse(state.jolly.get('workspaces')).map(work=>work.appId),['app-keep']);
  assert.equal(state.jolly.has('run:app-remove'),false);
  assert.equal(state.values.has('shell.jules.apps.app-remove.token'),false);
  assert.equal(state.values.get('shell.jules.apps.app-keep.owner'),'other');
  assert.deepEqual(JSON.parse(state.values.get('shell.works.cache.owner')).works,[{appId:'app-keep'}]);
  assert.equal(state.pages.has('owner:works-gallery::'),false);
  assert.equal(state.disposals.length,1);
  await deletion.syncDeletedWorks('owner',['app-remove']);assert.equal(state.disposals.length,1);
  state.disposals[0].resolve();await new Promise(resolve=>setImmediate(resolve));
  await deletion.syncDeletedWorks('owner',['app-remove']);assert.equal(state.disposals.length,1);
});

test('a deletion discards old gallery results and refresh does not join the stale request',async()=>{
  const {state,deletion,gallery}=fixture();
  const old=gallery.fetchWorksGallery();
  await deletion.syncDeletedWorks('owner',['app-remove']);
  const fresh=gallery.fetchWorksGallery(undefined,'',true);assert.equal(state.requests.length,2);
  const stale=assert.rejects(old,/作品列表已变更/);
  state.requests[0].resolve(Response.json({works:[{appId:'app-remove'}],summary:{worksCount:1},totalCount:1}));await stale;
  state.requests[1].resolve(Response.json({works:[{appId:'app-remove'},{appId:'app-keep'}],totalCount:1}));
  assert.deepEqual((await fresh).works,[{appId:'app-keep'}]);
  assert.equal(state.pages.has('owner:my-summary'),false);
  assert.deepEqual(gallery.projectGallery([{appId:'app-remove',createdAt:1},{appId:'app-keep',createdAt:1}]).map(work=>work.appId),['app-keep']);
  state.disposals[0].resolve();
});
