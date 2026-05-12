const GAS_URL='YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL';
const LS_KEY='viralClips_v1';
const AUTH_KEY='vcc_auth';
const USERS={viralclip:'Viral@2026'};
let clips=[],editId=null;

document.addEventListener('DOMContentLoaded',()=>{
  if(sessionStorage.getItem(AUTH_KEY)==='ok'){showApp();}else{showLogin();}
});

function showLogin(){
  document.getElementById('loginPage').style.display='flex';
  document.getElementById('mainApp').style.display='none';
  document.getElementById('loginForm').addEventListener('submit',handleLogin);
}

function handleLogin(e){
  e.preventDefault();
  const user=document.getElementById('loginUser').value.trim();
  const pass=document.getElementById('loginPass').value;
  const err=document.getElementById('loginErr');
  if(USERS[user]&&USERS[user]===pass){
    sessionStorage.setItem(AUTH_KEY,'ok');
    document.getElementById('loginPage').style.display='none';
    showApp();
  }else{
    err.textContent='Invalid username or password';
    document.getElementById('loginPass').value='';
    setTimeout(()=>{err.textContent='';},3000);
  }
}

function showApp(){
  document.getElementById('mainApp').style.display='block';
  loadFromLocalStorage();renderTable();updateStats();
  document.getElementById('clipForm').addEventListener('submit',handleSave);
  document.getElementById('exportBtn').addEventListener('click',exportCSV);
  document.getElementById('searchInput').addEventListener('input',renderTable);
  document.getElementById('filterPlatform').addEventListener('change',renderTable);
  document.getElementById('filterStatus').addEventListener('change',renderTable);
  document.getElementById('sortSelect').addEventListener('change',renderTable);
  document.getElementById('logoutBtn').addEventListener('click',()=>{sessionStorage.removeItem(AUTH_KEY);location.reload();});
}

function loadFromLocalStorage(){const raw=localStorage.getItem(LS_KEY);clips=raw?JSON.parse(raw):[];}
function saveToLocalStorage(){localStorage.setItem(LS_KEY,JSON.stringify(clips));}

async function handleSave(e){
  e.preventDefault();
  const msg=document.getElementById('formMsg');
  const clip={
    id:editId||Date.now().toString(),
    timestamp:editId?(clips.find(c=>c.id===editId)?.timestamp||new Date().toISOString()):new Date().toISOString(),
    platform:v('platform'),url:v('url'),song:v('song'),dance:v('dance'),
    character:v('character'),product:v('product'),score:parseInt(v('score'))||0,
    status:v('status'),note:v('note'),
  };
  if(editId){clips=clips.map(c=>c.id===editId?clip:c);editId=null;}else{clips.unshift(clip);}
  saveToLocalStorage();renderTable();updateStats();resetForm();
  showToast('Clip saved!');
  msg.textContent='Saved locally!';msg.className='form-msg success';
  if(GAS_URL&&GAS_URL!=='YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL'){
    try{
      const res=await fetch(GAS_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(clip)});
      const text=await res.text();
      if(text.includes('OK')){msg.textContent='Saved to Google Sheet!';}
    }catch{msg.textContent+=' Sheet sync failed';msg.className='form-msg error';}
  }
  setTimeout(()=>{msg.textContent='';msg.className='form-msg';},3000);
}

function v(id){return document.getElementById(id).value.trim();}
function resetForm(){document.getElementById('clipForm').reset();editId=null;document.querySelector('#clipForm .btn--primary').textContent='Save Clip';}

function renderTable(){
  const search=document.getElementById('searchInput').value.toLowerCase();
  const platform=document.getElementById('filterPlatform').value;
  const status=document.getElementById('filterStatus').value;
  const sort=document.getElementById('sortSelect').value;
  let filtered=[...clips];
  if(platform)filtered=filtered.filter(c=>c.platform===platform);
  if(status)filtered=filtered.filter(c=>c.status===status);
  if(search)filtered=filtered.filter(c=>[c.platform,c.url,c.song,c.dance,c.character,c.product,c.note].join(' ').toLowerCase().includes(search));
  if(sort==='oldest')filtered.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
  else if(sort==='score_desc')filtered.sort((a,b)=>b.score-a.score);
  else if(sort==='score_asc')filtered.sort((a,b)=>a.score-b.score);
  const tbody=document.getElementById('clipBody');
  const empty=document.getElementById('emptyState');
  document.getElementById('clipCount').textContent=filtered.length;
  if(!filtered.length){tbody.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';
  tbody.innerHTML=filtered.map((c,i)=>`
    <tr>
      <td style="color:var(--muted);font-family:var(--font-mono)">${i+1}</td>
      <td>${platformBadge(c.platform)}</td>
      <td><a href="${escHtml(c.url)}" target="_blank" class="url-cell" title="${escHtml(c.url)}">${escHtml(c.url)}</a></td>
      <td>${escHtml(c.song)}</td><td>${escHtml(c.dance)}</td><td>${escHtml(c.character)}</td>
      <td>${scoreBadge(c.score)}</td><td>${statusBadge(c.status)}</td>
      <td style="font-size:12px;color:var(--muted);max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(c.note)}</td>
      <td><div class="action-btns">
        <button class="action-btn" onclick="openURL('${escAttr(c.url)}')">Open</button>
        <button class="action-btn" onclick="copyURL('${escAttr(c.url)}')">Copy</button>
        <button class="action-btn" onclick="editClip('${c.id}')">Edit</button>
        <button class="action-btn action-btn--danger" onclick="deleteClip('${c.id}')">Del</button>
      </div></td>
    </tr>
  `).join('');
}

function openURL(url){window.open(url,'_blank','noopener,noreferrer');}
function copyURL(url){navigator.clipboard.writeText(url).then(()=>showToast('Copied!'));}
function editClip(id){
  const c=clips.find(x=>x.id===id);if(!c)return;editId=id;
  ['platform','url','song','dance','character','product','score','status','note'].forEach(k=>document.getElementById(k).value=c[k]??'');
  document.querySelector('#clipForm .btn--primary').textContent='Update Clip';
  document.getElementById('clipForm').scrollIntoView({behavior:'smooth'});
}
function deleteClip(id){
  if(!confirm('Delete this clip?'))return;
  clips=clips.filter(c=>c.id!==id);saveToLocalStorage();renderTable();updateStats();showToast('Deleted',true);
}
function exportCSV(){
  if(!clips.length){showToast('No clips!',true);return;}
  const h=['Timestamp','Platform','URL','Song','Dance','Character','Product','Score','Status','Note'];
  const rows=clips.map(c=>[c.timestamp,c.platform,c.url,c.song,c.dance,c.character,c.product,c.score,c.status,c.note].map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(','));
  const blob=new Blob(['\uFEFF'+[h.join(','),...rows].join('\n')],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`viral_clips_${new Date().toISOString().slice(0,10)}.csv`;a.click();
  showToast('CSV Exported!');
}
function updateStats(){
  document.getElementById('totalCount').textContent=clips.length;
  document.getElementById('highScore').textContent=clips.length?Math.max(...clips.map(c=>c.score||0)):0;
}
function platformBadge(p){const m={'TikTok':'badge--tiktok','Facebook':'badge--facebook','YouTube Shorts':'badge--youtube','Instagram':'badge--instagram'};return `<span class="badge ${m[p]||''}">${escHtml(p)}</span>`;}
function statusBadge(s){const m={'New':'new','In Progress':'inprogress','Done':'done','Archived':'archived'};return `<span class="status status--${m[s]||'new'}">${escHtml(s)}</span>`;}
function scoreBadge(n){const c=n>=70?'score--high':n>=40?'score--mid':'score--low';return `<span class="score ${c}">${n||'-'}</span>`;}
function showToast(msg,isErr=false){const t=document.getElementById('toast');t.textContent=msg;t.className='toast show'+(isErr?' error':'');setTimeout(()=>{t.className='toast';},2500);}
function escHtml(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function escAttr(s){return String(s??'').replace(/'/g,"&#39;").replace(/"/g,'&quot;');}
