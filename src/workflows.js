let workflowUrls = [];
const jobTools = [
  ['https://www.zhipin.com','BOSS 直聘 · 查找岗位'],
  ['https://www.linkedin.com','LinkedIn · 职业机会'],
  ['https://chatgpt.com','ChatGPT · JD 分析与简历修改'],
  ['https://gemini.google.com','Gemini · 面试准备'],
  ['https://www.perplexity.ai','Perplexity · 公司与行业研究'],
  ['https://mail.google.com','Gmail · 求职邮件'],
];
export function launchJobMode(){
  workflowUrls = jobTools.map(([url])=>url);
  const list = document.getElementById('workflowLinks');
  list.replaceChildren();
  jobTools.forEach(([url,label])=>{
    const link = document.createElement('a');
    link.className = 'btn';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label;
    list.appendChild(link);
  });
  document.getElementById('workflowTitle').textContent = '求职工具';
  document.getElementById('workflowStatus').textContent = '';
  document.getElementById('workflowDialog').showModal();
}
export function openAllWorkflowLinks(){
  let blocked = 0;
  workflowUrls.forEach(url=>{
    const tab = window.open(url,'_blank');
    if(tab) tab.opener = null;
    else blocked += 1;
  });
  document.getElementById('workflowStatus').textContent = blocked ? '浏览器拦截了部分窗口，请使用上方链接逐个打开。' : '已打开全部工具。';
}
