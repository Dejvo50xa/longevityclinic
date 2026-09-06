import React, {useEffect,useRef,useState} from 'react'
import * as T from 'three'
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js'
import './sauna.css'
const stops=[
 {name:'Lesní sauna',tag:'01 / ARCHITEKTURA',text:'Dřevo, sklo a ticho mezi stromy. Prozkoumejte prostor ze všech stran tažením prstu nebo myši.',pos:[10,7,12],target:[0,1,0],point:[0,3,0]},
 {name:'Uvnitř tepla',tag:'02 / INTERIÉR',text:'Dvě úrovně dřevěných lavic a velkorysý výhled do lesa. Otevřený řez odkrývá uspořádání interiéru.',pos:[5,4,7],target:[0,1,0],point:[-1,1.3,0]},
 {name:'Srdce sauny',tag:'03 / KAMNA',text:'Kamna s kameny tvoří střed saunového rituálu. Model ukazuje prostorový koncept, konkrétní technologii upřesní návrh.',pos:[3,2.8,4],target:[1.5,.8,.1],point:[1.5,1.3,.1]},
 {name:'Nádech v lese',tag:'04 / TERASA',text:'Místo pro odpočinek mezi cykly. Dřevěná terasa přirozeně navazuje na saunu a lesní pěšinu.',pos:[7,5,10],target:[1,.3,3.5],point:[0,.5,3.3]},
 {name:'Dotek chladu',tag:'05 / OCHLAZENÍ',text:'Samostatná ochlazovací káď vedle terasy. Teplo a chlad propojuje krátká cesta pod korunami stromů.',pos:[8,4,7],target:[4.5,.5,2.7],point:[4.5,1.2,2.7]}
]
export default function Sauna(){
 const host=useRef(),api=useRef();const [active,setActive]=useState(0),[cut,setCut]=useState(false),[error,setError]=useState(false),[details,setDetails]=useState(false)
 const choose=i=>{setActive(i);setCut(i===1||i===2);api.current?.go(i)}
 useEffect(()=>{document.title='Lesní sauna · AEVUM';const el=host.current;let renderer
 try{renderer=new T.WebGLRenderer({antialias:true})}catch{setError(true);return}
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.setClearColor('#172823');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;el.appendChild(renderer.domElement)
 const scene=new T.Scene();scene.fog=new T.FogExp2('#172823',.026)
 const camera=new T.PerspectiveCamera(43,1,.1,110);camera.position.set(...stops[0].pos)
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1,0);controls.enableDamping=true;controls.minDistance=2;controls.maxDistance=26;controls.maxPolarAngle=Math.PI*.48;controls.enablePan=false;controls.enableRotate=true;controls.minAzimuthAngle=-Infinity;controls.maxAzimuthAngle=Infinity;controls.mouseButtons.LEFT=T.MOUSE.ROTATE;controls.mouseButtons.RIGHT=T.MOUSE.ROTATE;controls.touches.ONE=T.TOUCH.ROTATE
 scene.add(new T.HemisphereLight(0xdcebe1,0x443c26,2.2));const sun=new T.DirectionalLight(0xffd4a0,4);sun.position.set(-8,16,6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18});sun.shadow.bias=-.001;scene.add(sun)
 const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.8,...extra})
 const wood=mat('#c49b69'),dark=mat('#252c27'),bark=mat('#574b3a'),leaf=mat('#294b38'),ground=mat('#3d4833'),stone=mat('#66726a'),water=mat('#43776d',{metalness:.55,roughness:.17}),glass=mat('#bddbcc',{transparent:true,opacity:.16,metalness:.25,roughness:.08,depthWrite:false})

 // Procedural grain stays sharp at close viewing distances without image downloads.
 wood.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 timberPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\ntimberPosition = position;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 timberPosition;').replace('#include <color_fragment>',`#include <color_fragment>
   vec3 p = timberPosition;
   float along = p.y; float across = p.x + p.z;
   float bend = sin(along * 2.7 + across * 3.0) * .09 + sin(along * 7.0) * .012;
   float grain = sin((across + bend) * 170.0);
   float fine = sin((across + bend*.8) * 630.0 + sin(along*13.0));
   float rings = sin(length(vec2(across*3.0, along*.45)) * 46.0);
   float variation = .88 + grain*.075 + fine*.035 + rings*.025;
   diffuseColor.rgb *= variation;
  `);
 };
 const waterTime={value:0};
 water.color.set('#3b9f9d');water.metalness=.3;water.roughness=.12;
 water.onBeforeCompile=shader=>{
  shader.uniforms.waterTime=waterTime;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float waterTime;\nvarying vec3 waterPosition;').replace('#include <begin_vertex>',`#include <begin_vertex>
   waterPosition = position;
   transformed.z += sin(position.x*15.0 + waterTime)*.009 + sin(position.y*19.0-waterTime*.8)*.006;
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float waterTime;\nvarying vec3 waterPosition;').replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
   normal = normalize(normal + vec3(cos(waterPosition.x*15.0+waterTime)*.12, sin(waterPosition.y*19.0-waterTime*.8)*.10, 0.0));
  `).replace('#include <color_fragment>',`#include <color_fragment>
   float ripple = sin(length(waterPosition.xy-vec2(.2,-.3))*55.0-waterTime*1.6);
   float caustic = pow(max(0.0,sin(waterPosition.x*21.0+sin(waterPosition.y*15.0+waterTime*.4))),12.0);
   diffuseColor.rgb += vec3(.09,.16,.14)*caustic + vec3(.025)*ripple;
  `);
 };
 function mesh(g,m,x,y,z,parent=scene){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
 const box=(w,h,d,m,x,y,z,p)=>mesh(new T.BoxGeometry(w,h,d),m,x,y,z,p)
 mesh(new T.CylinderGeometry(24,24,.35,80),ground,0,-.4,0)
 // Cabin: individual timber boards, glazed front, benches and removable roof.
 const shell=new T.Group();scene.add(shell)
 for(let i=0;i<37;i++){box(.155,.16,7,wood,-3+i*.165,0,1.2)}
 for(let i=0;i<32;i++)box(.17,2.65,.16,i%4===0?dark:wood,-2.8+i*.18,1.43,-2,shell)
 for(let z=0;z<21;z++){box(.15,2.65,.17,wood,-2.88,1.43,-1.85+z*.18,shell);box(.15,2.65,.17,wood,2.88,1.43,-1.85+z*.18,shell)}
 box(6.2,.22,4.5,dark,0,2.9,0,shell)
 for(const x of [-2.8,0,2.8])box(.09,2.65,.1,dark,x,1.43,1.96)
 box(5.6,2.5,.025,glass,0,1.4,1.96,shell);box(5.8,.1,.1,dark,0,2.73,1.96)
 for(const [z,y] of [[-1.15,.88],[-.45,.48]]){for(let j=0;j<5;j++)box(4.6,.09,.105,wood,-.35,y,z+j*.115);for(const x of [-2.25,1.55])box(.09,y,.48,dark,x,y/2,z+.23)}
 box(.66,.82,.66,dark,1.9,.53,.55)
 for(let i=0;i<15;i++)mesh(new T.DodecahedronGeometry(.13,0),stone,1.65+(i%3)*.21,1+(i%2)*.08,.33+Math.floor(i/3)*.11)
 box(.06,.5,.06,wood,1.94,1.2,1.99)
 const glow=new T.PointLight(0xffaa48,18,7);glow.position.set(0,2,-1);scene.add(glow)
 for(let i=0;i<3;i++)box(.6,.16,2.1,wood,-.7+i*.72,.18,5.7)
 // Individual staves, interior lining and a high, visibly rippling water surface.
 const lining=mat('#245855',{side:T.DoubleSide});
 mesh(new T.CylinderGeometry(.89,.82,.92,64,true),lining,4.5,.49,2.7);
 for(let i=0;i<48;i++){const a=i/48*Math.PI*2;const stave=box(.119,1,.095,wood,4.5+Math.sin(a)*.94,.5,2.7+Math.cos(a)*.94);stave.rotation.y=a;}
 const surface=mesh(new T.CircleGeometry(.889,96,0,Math.PI*2),water,4.5,.91,2.7);surface.rotation.x=-Math.PI/2;surface.castShadow=false;
 const rim=mesh(new T.TorusGeometry(.942,.064,10,96),wood,4.5,1,2.7);rim.rotation.x=Math.PI/2;
 mesh(new T.CylinderGeometry(.84,.84,.05,48),lining,4.5,.08,2.7);
 for(const y of [.18,.76]){const ring=mesh(new T.TorusGeometry(.95,.025,8,48),dark,4.5,y,2.7);ring.rotation.x=Math.PI/2}
 for(const x of [-1.8,.1]){box(.9,.12,1.65,wood,x,.38,3.3);for(const z of [2.65,3.9])box(.1,.34,.1,dark,x,.17,z)}
 // Timber finishing: base rails, fascia, backrests and recessed warm light.
 for(const z of [-1.91,1.91])box(5.8,.095,.1,wood,0,.22,z,shell);
 for(const x of [-2.92,2.92])box(.1,.15,4.15,dark,x,2.75,0,shell);
 for(let j=0;j<3;j++)box(4.6,.105,.065,wood,-.35,1.18+j*.16,-1.81);
 const led=mat('#ffc77a',{emissive:'#ffad42',emissiveIntensity:2});
 box(4.45,.022,.025,led,-.35,.78,-1.35);
 for(let i=0;i<37;i++){for(const z of [-1.8,4.4]){const screw=mesh(new T.CylinderGeometry(.012,.012,.004,6),dark,-3+i*.165,.083,z);screw.castShadow=false;}}
 // Seeded forest keeps the landscape stable across visits.
 let seed=42;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
 // Shared instanced branch clusters: detailed silhouettes with few draw calls.
 const foliageGeometry=new T.ConeGeometry(1,1,7,2);foliageGeometry.translate(0,.5,0);
 const clusters=new T.InstancedMesh(foliageGeometry,leaf,105*9*8);clusters.castShadow=true;clusters.receiveShadow=true;scene.add(clusters);
 const twigGeometry=new T.CylinderGeometry(.025,.07,1,5);twigGeometry.translate(0,.5,0);
 const branches=new T.InstancedMesh(twigGeometry,bark,105*9*4);branches.castShadow=true;scene.add(branches);
 const dummy=new T.Object3D(),up=new T.Vector3(0,1,0),direction=new T.Vector3();let foliageIndex=0,branchIndex=0;
 bark.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 barkPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nbarkPosition=position;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 barkPosition;').replace('#include <color_fragment>',`#include <color_fragment>
 float groove=sin(atan(barkPosition.z,barkPosition.x)*48.0+sin(barkPosition.y*4.0)*1.8);
 diffuseColor.rgb *= .75 + .23*smoothstep(-.7,.5,groove);
 `)};
 for(let i=0;i<105;i++){
  const a=rand()*Math.PI*2,r=8+rand()*20,x=Math.cos(a)*r,z=Math.sin(a)*r,h=5+rand()*7;
  mesh(new T.CylinderGeometry(.07,.23,h,12,6),bark,x,h/2-.2,z);
  const tiers=r<17?9:6;
  for(let j=0;j<tiers;j++){
   const fraction=j/tiers,y=h*(.28+fraction*.65),reach=(1-fraction)*2.1+.18;
   for(let k=0;k<4;k++){
    const angle=k*Math.PI/2+j*1.7+rand()*.5;
    direction.set(Math.cos(angle),.12,Math.sin(angle)).normalize();
    dummy.position.set(x,y,z);dummy.quaternion.setFromUnitVectors(up,direction);dummy.scale.set(1,reach,1);dummy.updateMatrix();branches.setMatrixAt(branchIndex++,dummy.matrix);
    for(let t=0;t<2;t++){
     const d=reach*(.32+t*.43);dummy.position.set(x+Math.cos(angle)*d,y+.08,z+Math.sin(angle)*d);
     direction.set(Math.cos(angle)*.35,1,Math.sin(angle)*.35).normalize();dummy.quaternion.setFromUnitVectors(up,direction);dummy.scale.set(reach*.45,.65+reach*.48,reach*.38);dummy.updateMatrix();clusters.setMatrixAt(foliageIndex,dummy.matrix);clusters.setColorAt(foliageIndex++,new T.Color().setHSL(.29+rand()*.06,.24+rand()*.16,.13+rand()*.10));
    }
   }
  }
 }
 clusters.count=foliageIndex;branches.count=branchIndex;
 clusters.instanceMatrix.needsUpdate=true;clusters.instanceColor.needsUpdate=true;branches.instanceMatrix.needsUpdate=true;

 for(let i=0;i<70;i++){const x=(rand()-.5)*36,z=(rand()-.5)*36;if(Math.abs(x)<6&&Math.abs(z)<7)continue;const rock=mesh(new T.DodecahedronGeometry(.15+rand()*.45),stone,x,0,z);rock.scale.y=.55}
 const markers=stops.slice(1).map((s,i)=>{const m=mesh(new T.SphereGeometry(.13,16,12),new T.MeshBasicMaterial({color:0xffdb8f}),...s.point);m.userData.index=i+1;return m})
 let destination=null;const rotate=direction=>{destination=null;const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new T.Vector3(0,1,0),direction*Math.PI/8);camera.position.copy(controls.target).add(offset);controls.update()};api.current={rotate,go(i){destination={pos:new T.Vector3(...stops[i].pos),target:new T.Vector3(...stops[i].target)}},cut(v){shell.visible=!v}}
 controls.addEventListener('start',()=>destination=null)
 renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','3D sauna. Táhněte pro otáčení nebo použijte šipky vlevo a vpravo.');const onKey=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();rotate(e.key==='ArrowLeft'?1:-1)}};renderer.domElement.addEventListener('keydown',onKey)
 const ray=new T.Raycaster(),pointer=new T.Vector2();let down=[0,0]
 const onDown=e=>down=[e.clientX,e.clientY]
 const onUp=e=>{if(Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(markers)[0];if(hit)choose(hit.object.userData.index)}
 renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointerup',onUp)
 const resize=new ResizeObserver(()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()});resize.observe(el)
 let frame;const tick=()=>{frame=requestAnimationFrame(tick);if(document.hidden)return;waterTime.value=window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:performance.now()*.001;if(destination){camera.position.lerp(destination.pos,.065);controls.target.lerp(destination.target,.065);if(camera.position.distanceTo(destination.pos)<.015)destination=null}controls.update();renderer.render(scene,camera)};tick()
 return()=>{cancelAnimationFrame(frame);resize.disconnect();controls.dispose();renderer.domElement.removeEventListener('keydown',onKey);renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointerup',onUp);scene.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose()});renderer.dispose();renderer.domElement.remove();api.current=null}
 },[])
 useEffect(()=>api.current?.cut(cut),[cut])
 return <main className="sauna-page"><div ref={host} className="sauna-scene" aria-label="Interaktivní 3D model sauny v lese"/><header className="sauna-header"><a href="/">AEVUM <span>← Zpět na kliniku</span></a><span>LESNÍ RETREAT / 3D STUDIE</span></header><div className="sauna-heading"><p>TEPLO. TICHO. PŘÍRODA.</p><h1>Mezi stromy.</h1><span>Prostor pro návrat k sobě.</span></div>{error&&<div className="sauna-error">3D zobrazení není dostupné. Zkuste prohlížeč s podporou WebGL. Popis míst si můžete projít níže.</div>}<button className="sauna-info-toggle" aria-expanded={details} aria-controls="sauna-info" onClick={()=>setDetails(!details)}>{details ? 'Zavřít detail ×' : 'O místě ⓘ'}</button>{details && <aside id="sauna-info" className="sauna-detail" aria-live="polite"><span>{stops[active].tag}</span><h2>{stops[active].name}</h2><p>{stops[active].text}</p><button onClick={()=>setCut(!cut)} aria-pressed={cut}>{cut?'Zavřít řez saunou':'Otevřít řez saunou'} ↗</button></aside>}<div className="sauna-rotate" role="group" aria-label="Otáčení pohledu"><button aria-label="Otočit pohled doleva" onClick={()=>api.current?.rotate(1)}>←</button><span>Otočit pohled</span><button aria-label="Otočit pohled doprava" onClick={()=>api.current?.rotate(-1)}>→</button></div><footer className="sauna-bottom"><nav aria-label="Místa v sauně">{stops.map((s,i)=><button key={s.name} aria-pressed={active===i} className={active===i?'selected':''} onClick={()=>choose(i)}><span>0{i+1}</span>{s.name}</button>)}</nav><div><span>Táhněte pro otáčení · přibližujte kolečkem nebo dvěma prsty</span><span>Koncept prostoru, nikoli realizační dokumentace</span></div></footer></main>
}
