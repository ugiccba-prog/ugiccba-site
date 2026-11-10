const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

test('el generador acepta un checkout CRLF de Windows y detecta cambios reales',()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'muni360-crlf-'));
  try{
    for(const file of ['scripts/build-apps-script.cjs','server/muni360/domain.cjs','server/muni360/policy.cjs','apps-script/Muni360Domain.gs']){
      const destination=path.join(temporary,file);
      fs.mkdirSync(path.dirname(destination),{recursive:true});
      fs.writeFileSync(destination,fs.readFileSync(file,'utf8').replace(/\r?\n/g,'\r\n'));
    }
    const run=()=>execFileSync(process.execPath,['scripts/build-apps-script.cjs','--check'],{cwd:temporary,stdio:'pipe'});
    assert.doesNotThrow(run);
    fs.appendFileSync(path.join(temporary,'apps-script/Muni360Domain.gs'),'\r\n// Cambio real sin regenerar\r\n');
    assert.throws(run);
  }finally{
    fs.rmSync(temporary,{recursive:true,force:true});
  }
});
