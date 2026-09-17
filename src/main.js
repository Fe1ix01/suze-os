import './style.css';
import {
  defaultState, state, storageReadFailed, unsavedChanges,
  saveState as persistState, exportData as downloadBackup,
  importData as restoreBackup, resetAllData as clearStoredData,
} from './storage.js';
import { launchJobMode, openAllWorkflowLinks } from './workflows.js';
import { initViewRouter } from './viewRouter.js';

function showDataStatus(message,isError=false){
  const el = document.getElementById('dataStatus');
  el.textContent = message;
  el.classList.toggle('is-error',isError);
}

function setSaveLabel(id){
  document.getElementById(id).textContent = '已自动保存 · ' + new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
}

function saveState(){
  try{
    persistState();
    setSaveLabel('journalState');
    setSaveLabel('reviewState');
    showDataStatus('数据已保存到当前浏览器。');
    renderHomeSummary();
    return true;
  }catch(error){
    document.getElementById('journalState').textContent='保存失败，请勿关闭页面';
    document.getElementById('reviewState').textContent='保存失败，请勿关闭页面';
    showDataStatus(error instanceof Error && error.name === 'Error' ? error.message : '保存失败，请检查浏览器存储权限和可用空间；当前内容可先导出备份。',true);
    renderHomeSummary();
    return false;
  }
}

function changeMetric(key,delta){
  if(!Object.hasOwn(defaultState.job,key) || ![-1,1].includes(delta)) return;
  const next = Math.max(0,state.job[key]+delta);
  if(!Number.isSafeInteger(next)) return;
  state.job[key] = next;
  saveState();
  renderMetrics();
}
function percent(a,b){return b>0 ? ((a/b)*100).toFixed(1)+'%' : '0%';}
function renderMetrics(){
  for(const key of Object.keys(defaultState.job)) document.getElementById(key+'Value').textContent=state.job[key];
  document.getElementById('replyRate').textContent=percent(state.job.replies,state.job.applied);
  document.getElementById('interviewRate').textContent=percent(state.job.interviews,state.job.replies);
  document.getElementById('offerRate').textContent=percent(state.job.offers,state.job.interviews);
}

function renderHomeSummary(){
  const unavailable = storageReadFailed;
  const ids = {applied:'homeApplied',replies:'homeReplies',interviews:'homeInterviews',offers:'homeOffers'};
  for(const [key,id] of Object.entries(ids)) document.getElementById(id).textContent = unavailable ? '—' : state.job[key];
  const status = document.getElementById('homeDataStatus');
  status.textContent = unavailable ? '本地数据读取失败，请到数据页查看。' : unsavedChanges ? '当前内容尚未成功保存，请到数据页查看。' : '';
  const journal = unavailable ? '' : state.journal.trim();
  const review = unavailable ? '' : state.review.trim();
  document.getElementById('homeJournalSummary').textContent = unavailable ? '暂时无法读取记录' : journal ? '日记：已有内容' : '日记：暂无内容';
  document.getElementById('homeReviewSummary').textContent = unavailable ? '' : review ? '复盘：已有内容（不代表今日已复盘）' : '复盘：暂无内容';
  const preview = journal || review;
  document.getElementById('homeRecordPreview').textContent = preview ? '当前内容：' + preview.slice(0,80) + (preview.length > 80 ? '…' : '') : '';
}

function updateDate(){
  const date = new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date());
  document.getElementById('nowText').textContent = date;
  document.getElementById('journalDate').textContent = '当前日记内容 · 输入后自动保存在本地。';
}

const journalText = document.getElementById('journalText');
const reviewText = document.getElementById('reviewText');
function renderState(label='已从本地读取'){
  journalText.value=state.journal;
  reviewText.value=state.review;
  document.getElementById('journalState').textContent=state.journal ? label : '尚未输入';
  document.getElementById('reviewState').textContent=state.review ? label : '尚未输入';
  renderMetrics();
  renderHomeSummary();
}
journalText.addEventListener('input',()=>{state.journal=journalText.value;saveState();});
reviewText.addEventListener('input',()=>{state.review=reviewText.value;saveState();});

function clearJournal(type){
  if(!['journal','review'].includes(type)) return;
  if(!confirm('确定清空当前'+(type==='journal'?'日记':'复盘')+'吗？')) return;
  state[type]='';
  const saved=saveState();
  if(type==='journal') journalText.value='';
  else reviewText.value='';
  if(saved) document.getElementById(type+'State').textContent='已清空';
}

function exportData(){
  try{
    downloadBackup();
    showDataStatus(unsavedChanges ? '已导出当前内容；浏览器内的保存仍未成功。' : '已导出 V3 数据备份。',unsavedChanges);
  }catch(error){showDataStatus(error.message,true);}
}

async function importData(event){
  const input=event.target;
  const file=input.files?.[0];
  if(!file) return;
  try{
    if(!await restoreBackup(file)) return;
    renderState('已导入');
    showDataStatus('V3 备份已导入并保存。');
  }catch(error){
    showDataStatus('导入失败：'+(error instanceof SyntaxError ? 'JSON 格式无效，未修改现有数据。' : error.message),true);
  }finally{input.value='';}
}

function resetAllData(){
  if(!confirm('确定清空当前浏览器中的 Suze Flow 手动求职计数、日记和复盘吗？Job Radar 和旧版数据不会被删除。')) return;
  try{clearStoredData();}catch(error){showDataStatus('清空失败，请检查浏览器存储权限。',true);return;}
  renderState();
  showDataStatus('V3 本地数据已清空。');
}

// Explicit DOM bindings keep module functions out of the global window scope.
const workflows={job:launchJobMode};
document.querySelectorAll('[data-workflow]').forEach(button=>{
  button.addEventListener('click',workflows[button.dataset.workflow]);
});
document.querySelectorAll('[data-metric]').forEach(button=>{
  button.addEventListener('click',()=>changeMetric(button.dataset.metric,Number(button.dataset.delta)));
});
document.querySelectorAll('[data-clear]').forEach(button=>{
  button.addEventListener('click',()=>clearJournal(button.dataset.clear));
});
document.getElementById('closeWorkflow').addEventListener('click',()=>document.getElementById('workflowDialog').close());
document.getElementById('openAllWorkflow').addEventListener('click',openAllWorkflowLinks);
document.getElementById('exportData').addEventListener('click',exportData);
document.getElementById('importFile').addEventListener('change',importData);
document.getElementById('resetAllData').addEventListener('click',resetAllData);

window.addEventListener('beforeunload',event=>{if(unsavedChanges){event.preventDefault();event.returnValue='';}});
renderState();
if(storageReadFailed) showDataStatus('本地数据读取失败，已暂停保存。请检查存储权限或导入有效的 V3 备份。',true);
initViewRouter(()=>{renderHomeSummary();updateDate();});
// Keep the date current across midnight without retaining the quote rotation.
setInterval(updateDate,60000);

// Optional Auth is isolated from all local initialization and event bindings above.
import('./auth.js').then(({initAuth})=>initAuth()).catch(()=>{
  const status = document.getElementById('authStatus');
  status.textContent = '云端登录模块暂时不可用，请刷新重试。本地功能可继续使用。';
  document.getElementById('openAuth').addEventListener('click',()=>{
    status.textContent = '云端登录模块加载失败，请检查网络并刷新页面。本地功能可继续使用。';
  });
  document.getElementById('openAuth').disabled = false;
});
