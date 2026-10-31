// Installed only in the versioned delivery copy; compiled Unity bytes unchanged.
const parentOrigin=new URLSearchParams(location.search).get('parentOrigin');
let validOrigin=null;
try{if(new URL(parentOrigin).origin===parentOrigin)validOrigin=parentOrigin;}catch{}
if(validOrigin){
  window.careerExperienceParentOrigin=validOrigin;
  window.addEventListener('message',e=>{
    if(e.source!==parent||e.origin!==validOrigin||e.data?.channel!=='career-preview')return;
    const ready=window.officeUnity&&window.workplaceState;
    if(e.data.type==='hello'&&ready)parent.postMessage({channel:'career-preview',type:'ready',buildId:'career-pilot-v007'},validOrigin);
    if(e.data.type==='control'&&ready)window.officeUnity.SendMessage('CareerProtocol','ReceiveControl',JSON.stringify(e.data.request));
    if(e.data.type==='replay'&&ready)window.officeUnity.SendMessage('CareerProtocol','Replay','');
  });
}
