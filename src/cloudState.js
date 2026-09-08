import { STORAGE_KEYS, storageService } from './services/storageService.js';
import { storageReadFailed, unsavedChanges } from './storage.js';
import { CloudStateError, getCloudState, saveCloudState, hasCloudState, getCloudErrorMessage } from './services/cloudStateService.js';

function readLocalSnapshot(){
  if(storageReadFailed || unsavedChanges){
    throw new CloudStateError('本地数据尚未成功保存或读取，已取消上传。请先处理本地保存错误。');
  }
  function read(key){
    let raw;
    try{raw = storageService.get(key);}catch{
      throw new CloudStateError(`无法读取 ${key}，已取消上传。请检查浏览器存储权限。`);
    }
    if(raw === null) return {};
    try{
      const value = JSON.parse(raw);
      if(value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error();
      return value;
    }catch{
      throw new CloudStateError(`${key} 的 JSON 格式无效，已取消上传。请先检查本地数据。`);
    }
  }
  return {coreState:read(STORAGE_KEYS.appState),jobRadarState:read(STORAGE_KEYS.jobRadar)};
}

export function initCloudStateUI(){
  const panel = document.getElementById('cloudStatePanel');
  const status = document.getElementById('cloudStateStatus');
  const preview = document.getElementById('cloudStatePreview');
  const existsLabel = document.getElementById('cloudStateExists');
  const buttons = [...panel.querySelectorAll('button')];
  const labels = buttons.map(button=>button.textContent);
  let userId = null;
  let revision = 0;
  let busy = false;

  function setBusy(value,button){
    busy = value;
    panel.setAttribute('aria-busy',String(value));
    buttons.forEach((control,index)=>{
      control.disabled = value || !userId;
      control.textContent = value && control === button ? '处理中…' : labels[index];
    });
  }

  function resetPreview(){
    preview.hidden = true;
    existsLabel.textContent = '尚未读取';
    for(const id of ['cloudSchemaVersion','cloudUpdatedAt','cloudCoreState','cloudJobRadarState']){
      document.getElementById(id).textContent = '—';
    }
  }

  function renderPreview(record){
    existsLabel.textContent = record ? '存在' : '不存在';
    preview.hidden = false;
    document.getElementById('cloudSchemaVersion').textContent = record?.schema_version ?? '—';
    document.getElementById('cloudUpdatedAt').textContent = record?.updated_at ?? '—';
    const hasData = value=>value !== null && typeof value === 'object' && Object.keys(value).length > 0;
    document.getElementById('cloudCoreState').textContent = hasData(record?.core_state) ? '有数据' : '无数据';
    document.getElementById('cloudJobRadarState').textContent = hasData(record?.job_radar_state) ? '有数据' : '无数据';
  }

  async function run(button,action){
    if(busy || !userId) return;
    const startedAt = revision;
    status.textContent = '';
    status.classList.remove('is-error');
    setBusy(true,button);
    // Ignore responses from operations started before sign-out/account changes.
    const isCurrent = ()=>revision === startedAt;
    try{await action(isCurrent);}catch(error){
      if(isCurrent()){
        status.textContent = getCloudErrorMessage(error);
        status.classList.add('is-error');
      }
    }finally{if(isCurrent()) setBusy(false);}
  }

  document.getElementById('checkCloudState').addEventListener('click',event=>run(event.currentTarget,async isCurrent=>{
    const exists = await hasCloudState();
    if(!isCurrent()) return;
    resetPreview();
    existsLabel.textContent = exists ? '存在' : '不存在';
    status.textContent = exists ? '当前账户已有云端数据，可手动读取预览。' : '当前账户暂无云端数据。';
  }));

  document.getElementById('previewCloudState').addEventListener('click',event=>run(event.currentTarget,async isCurrent=>{
    const record = await getCloudState();
    if(!isCurrent()) return;
    renderPreview(record);
    status.textContent = record ? '云端预览已读取，本地数据保持不变。' : '当前账户暂无云端数据，本地数据保持不变。';
  }));

  document.getElementById('uploadCloudState').addEventListener('click',event=>run(event.currentTarget,async isCurrent=>{
    if(!confirm('将当前本地数据保存到云端，不会删除本地数据。\n这将替换当前账户已有的云端快照。')) return;
    if(!isCurrent()) return;
    const {coreState,jobRadarState} = readLocalSnapshot();
    try{
      const record = await saveCloudState(coreState,jobRadarState,{isCurrent});
      if(!isCurrent()) return;
      renderPreview(record);
      status.textContent = '当前本地数据已保存到云端，本地数据保持不变。';
    }catch(error){
      // A lost response can follow a successful write. Do not claim it was rolled back.
      if(isCurrent()){
        status.textContent = '云端保存结果未确认。' + getCloudErrorMessage(error) + ' 可点击“从云端读取预览”核对。';
        status.classList.add('is-error');
      }
    }
  }));

  return {
    setSession(session){
      const nextUserId = session?.user?.id || null;
      if(nextUserId !== userId){
        userId = nextUserId;
        revision++;
        resetPreview();
        status.textContent = '';
        status.classList.remove('is-error');
        setBusy(false);
      }
      panel.hidden = !userId;
      // Auth events only control visibility; they never initiate cloud requests.
    },
  };
}
