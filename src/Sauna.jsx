import React, {useEffect,useRef,useState} from 'react'
import * as T from 'three'
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js'
import './sauna.css'
const stops=[
 {name:'Celý areál',tag:'01 / AREÁL',text:'Tři sauny a odpočívárna v otevřené louce. Cestičky se setkávají u ochlazovací kádě a navazují na přístupovou cestu.',pos:[44,48,61],target:[0,0,-3],point:[0,3,0]},
 {name:'Finská',tag:'02 / FINSKÁ SAUNA',text:'Dřevěná sauna s kamny a stupňovitými lavicemi. Řez odkrývá její interiér.',pos:[7,5,8],target:[0,1,0],point:[0,3.4,0]},
 {name:'Herbal',tag:'03 / BYLINNÁ SAUNA',text:'Bylinná sauna do L se dvěma propojenými křídly, zalomenými lavicemi a chráněným vstupním dvorkem.',pos:[-13,7,6],target:[-24,1,-7],point:[-24,3.5,-7]},
 {name:'Solná / ceremoniální',tag:'04 / SOLNÁ SAUNA',text:'Velká kruhová ceremoniální sauna: tři soustředné řady lavic, centrální kamna a podsvícené solné bloky.',pos:[34,7,5],target:[24,1,-9],point:[24,3.5,-9]},
 {name:'Odpočívárna',tag:'05 / ODPOČINEK',text:'Velká odpočívárna s 18 lehátky, prosklenými stěnami a širokou krytou terasou.',pos:[11,11,-12],target:[0,1,-29],point:[0,4,-29]},
 {name:'Ochlazení',tag:'06 / VODA',text:'Ochlazovací káď při centrální cestě. Odtud vedou samostatné pěšiny ke všem pavilonům.',pos:[9,4,8],target:[4.5,.5,2.7],point:[4.5,1.3,2.7]},
 {name:'Kamenný bazének',tag:'07 / VODNÍ ZAHRADA',text:'Oválný bazének s kamenným lemem, vodou a širokým pobytovým okrajem. Druhá odpočívárna s 12 lehátky navazuje na jeho terasu.',pos:[-5,14,34],target:[-19,0,20],point:[-19,1.5,20]},
 {name:'U vody',tag:'08 / DRUHÁ ODPOČÍVÁRNA',text:'Vzdušná pergola s 12 lehátky a výhledem na hladinu, stranou od hlavního saunového okruhu.',pos:[-20,10,38],target:[-31,1,24],point:[-31,4,24]},
 {name:'Vstup / odchod',tag:'07 / PŘÍSTUP',text:'Hlavní přístupová cesta pokračuje od centrálního rozcestí ven z areálu, volným průsekem mezi vzdálenými stromy.',pos:[12,14,30],target:[0,0,16],point:[0,1,17]}
]
export default function Sauna(){
 const host=useRef(),api=useRef();const [active,setActive]=useState(0),[cut,setCut]=useState(false),[error,setError]=useState(false),[details,setDetails]=useState(false)
 const choose=i=>{setActive(i);setCut(false);api.current?.go(i)}
 useEffect(()=>{document.title='Lesní sauna · AEVUM';const el=host.current;let renderer
 try{renderer=new T.WebGLRenderer({antialias:true})}catch{setError(true);return}
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.setClearColor('#172823');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;el.appendChild(renderer.domElement)
 const scene=new T.Scene();scene.fog=new T.FogExp2('#172823',.008)
 const camera=new T.PerspectiveCamera(43,1,.1,180);camera.position.set(...stops[0].pos)
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(...stops[0].target);controls.enableDamping=true;controls.minDistance=2;controls.maxDistance=110;controls.maxPolarAngle=Math.PI*.48;controls.enablePan=true;controls.zoomToCursor=true;controls.screenSpacePanning=false;controls.enableRotate=true;controls.minAzimuthAngle=-Infinity;controls.maxAzimuthAngle=Infinity;controls.mouseButtons.LEFT=T.MOUSE.ROTATE;controls.mouseButtons.RIGHT=T.MOUSE.PAN;controls.touches.ONE=T.TOUCH.ROTATE;controls.touches.TWO=T.TOUCH.DOLLY_PAN
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
 mesh(new T.CylinderGeometry(76,76,.35,100),ground,0,-.4,0)
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
  const a=rand()*Math.PI*2,r=53+rand()*15,x=Math.cos(a)*r,z=Math.sin(a)*r,h=5+rand()*7;
  if(z>0 && Math.abs(x)<5)continue;
  mesh(new T.CylinderGeometry(.07,.23,h,12,6),bark,x,h/2-.2,z);
  const tiers=6;
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

 for(let i=0;i<70;i++){const x=(rand()-.5)*36,z=(rand()-.5)*36;if(Math.abs(x)<19&&Math.abs(z)<22)continue;const rock=mesh(new T.DodecahedronGeometry(.15+rand()*.45),stone,x,0,z);rock.scale.y=.55}

 // Separate pavilions and a connected pedestrian network across the clearing.
 const roofs=[shell];
 const herbal=mat('#647d4e'),salt=mat('#e9a878',{emissive:'#d57735',emissiveIntensity:.4}),linen=mat('#ddd2b9');
 // Each sauna has its own footprint and orientation.
 function rotatedBuilding(cx,cz,angle,build){
  const before=new Set(scene.children);build();const group=new T.Group();group.position.set(cx,0,cz);scene.add(group);
  for(const child of [...scene.children])if(child!==group&&!before.has(child)){child.position.x-=cx;child.position.z-=cz;group.add(child);}
  group.rotation.y=angle;
 }
 rotatedBuilding(-24,-7,-Math.PI/5,()=>{
  const cover=new T.Group();scene.add(cover);roofs.push(cover);
  // L footprint: long wing and a perpendicular side wing, no dividing wall.
  box(8,.18,3.7,wood,-24,0,-8.5);box(3.3,.18,4.7,wood,-26.35,0,-4.3);
  for(let i=0;i<44;i++)box(.17,2.8,.14,wood,-27.9+i*.18,1.5,-10.3,cover);
  for(let i=0;i<43;i++)box(.14,2.8,.17,wood,-28,1.5,-10.2+i*.18,cover);
  box(.14,2.8,3.7,wood,-20,1.5,-8.5,cover);
  box(4.7,2.7,.025,glass,-22.35,1.5,-6.65,cover);
  box(.025,2.7,4.5,glass,-24.7,1.5,-4.35,cover);
  box(3.3,2.7,.025,glass,-26.35,1.5,-2,cover);
  box(8.3,.2,3.9,herbal,-24,3,-8.5,cover);box(3.5,.2,4.7,herbal,-26.35,3,-4.3,cover);
  for(let row=0;row<2;row++){
   box(6.8,.12,.6,wood,-24,.55+row*.4,-9.4+row*.7);
   box(.6,.12,6.5,wood,-27.1+row*.7,.55+row*.4,-6.3);
  }
  box(.7,.8,.7,dark,-21.2,.5,-8.4);
  box(1.5,.7,.4,wood,-25.6,.4,-2.3);
  for(let i=0;i<3;i++)mesh(new T.SphereGeometry(.16,12,8),herbal,-26+i*.4,.9,-2.3);
 });
 rotatedBuilding(24,-9,Math.PI/3,()=>{
  const cover=new T.Group();scene.add(cover);roofs.push(cover);
  mesh(new T.CylinderGeometry(5.3,5.3,.22,80),wood,24,0,-9);
  // Front opening is left clear; rear wall follows the circular plan.
  for(let i=0;i<100;i++){const a=.5+i/99*(Math.PI*2-1);const x=24+Math.sin(a)*5,z=-9+Math.cos(a)*5;const board=box(.27,3.7,.15,wood,x,1.95,z,cover);board.rotation.y=a;}
  mesh(new T.ConeGeometry(5.65,1.3,80),dark,24,4.42,-9,cover);
  for(let row=0;row<3;row++){
   const radius=2.6+row*.78;
   for(let i=0;i<43;i++){const a=.42+i/42*(Math.PI*2-.84);const seat=box(.56,.12,.64,wood,24+Math.sin(a)*radius,.5+row*.42,-9+Math.cos(a)*radius);seat.rotation.y=a;}
  }
  mesh(new T.CylinderGeometry(.72,.8,1,24),dark,24,.62,-9);
  for(let i=0;i<20;i++)mesh(new T.DodecahedronGeometry(.18),stone,24+Math.cos(i*2.4)*.5,1.18+(i%3)*.07,-9+Math.sin(i*2.4)*.5);
  for(let i=0;i<22;i++){const a=1.5+i/21*3.2;const tile=box(.5,.75,.13,salt,24+Math.sin(a)*4.86,2.5,-9+Math.cos(a)*4.86,cover);tile.rotation.y=a;}
 });
 const gravel=mat('#a79e86');
 function path(points,width=1.35){for(let i=1;i<points.length;i++){const [x,z]=points[i-1],[nx,nz]=points[i];const length=Math.hypot(nx-x,nz-z);const strip=box(width,.06,length,gravel,(x+nx)/2,-.15,(z+nz)/2);strip.rotation.y=Math.atan2(nx-x,nz-z);mesh(new T.CylinderGeometry(width/2,width/2,.06,24),gravel,x,-.15,z);}}
 // Smooth paths skirt the gardens, with comfortable open lawns between buildings.
 function curved(points,width=1.65){const curve=new T.CatmullRomCurve3(points.map(([x,z])=>new T.Vector3(x,0,z)));path(curve.getPoints(70).map(v=>[v.x,v.z]),width);}
 curved([[0,73],[0,40],[0,20],[0,8],[0,5]],2.4);
 curved([[0,8],[-10,9],[-22,5],[-24,-3.5]]);
 curved([[0,8],[12,8],[24,2],[24,-5.5]]);
 curved([[-24,-3.5],[-17,-13],[-10,-22],[0,-22.5]],2);
 curved([[24,-5.5],[18,-17],[9,-23],[0,-22.5]],2);
 curved([[0,20],[-7,21],[-12,25],[-19,28]],2);
 curved([[-19,28],[-24,31],[-31,29]],2);
 path([[0,5],[4.5,5],[4.5,3.7]],1);
 curved([[-24,-3.5],[-26,-1.5],[-28.85,-4.33]],1.5);
 curved([[24,-5.5],[28,-3],[28.5,-6.4]],1.8);
 curved([[0,20],[6,20],[9,18]],1.5);
 curved([[6,20],[10,23],[12,24]],1.5);
 // Outdoor rinse court, social seating and a small tea station.
 const steel=mat('#a0aaa8',{metalness:.8,roughness:.25});
 box(4,.12,3,stone,9,0,17);
 for(const x of [8,10]){mesh(new T.CylinderGeometry(.04,.04,2.4,12),steel,x,1.2,16.5);box(.06,.06,.65,steel,x,2.4,16.8);mesh(new T.CylinderGeometry(.18,.18,.035,20),steel,x,2.38,17.1);}
 for(let i=0;i<20;i++)box(.12,2,.08,wood,6.9+i*.22,1,15.5);
 mesh(new T.CylinderGeometry(3.4,3.4,.08,48),stone,12,-.12,27);
 for(let i=0;i<5;i++){const a=i/5*Math.PI*2;const seat=box(1.7,.2,.6,wood,12+Math.sin(a)*2.4,.45,27+Math.cos(a)*2.4);seat.rotation.y=a;}
 mesh(new T.CylinderGeometry(.8,.85,.55,32),stone,12,.23,27);
 box(2.5,.85,.8,wood,-8,.42,-20);box(2.7,.08,1,stone,-8,.88,-20);
 for(const x of [-8.7,-7.4])mesh(new T.CylinderGeometry(.16,.18,.4,16),steel,x,1.12,-20);
 function lounger(x,z){box(1.05,.18,2.2,wood,x,.35,z);box(.95,.13,1.65,linen,x,.51,z+.13);const back=box(.95,.14,.78,linen,x,.74,z-.86);back.rotation.x=.48;for(const dz of [-.85,.85])box(.08,.3,.08,dark,x,.15,z+dz);}
 function lounge(cx,cz,cols,rows,enclosed){
  const w=cols*1.65+2,d=rows*3+2,roof=new T.Group();scene.add(roof);roofs.push(roof);
  box(w,.2,d+2,wood,cx,.01,cz+1);
  for(let i=0;i<cols;i++)for(let j=0;j<rows;j++)lounger(cx+(i-(cols-1)/2)*1.65,cz+(j-(rows-1)/2)*3);
  for(const dx of [-w/2+.3,w/2-.3])for(const dz of [-d/2+.3,0,d/2+.3])box(.16,3.5,.16,wood,cx+dx,1.75,cz+dz);
  if(enclosed){box(w,.2,d+2,dark,cx,3.6,cz+.5,roof);box(w,3.2,.025,glass,cx,1.7,cz-d/2,roof);for(const dx of [-w/2,w/2])box(.025,3.2,d,glass,cx+dx,1.7,cz,roof);}
  else{for(let i=0;i<=18;i++)box(.12,.19,d+1,wood,cx-w/2+i*w/18,3.5,cz,roof);for(const dz of [-d/2,d/2])box(w,.2,.18,dark,cx,3.3,cz+dz,roof);}
  box(w-.6,.035,.04,led,cx,3.35,cz-d/2+.1,roof);
 }
 lounge(0,-29,6,3,true);lounge(-31,24,4,3,false);
 // Raised stone basin keeps the water and its enclosing wall above the lawn.
 const poolX=-19,poolZ=20;
 const poolWall=mesh(new T.CylinderGeometry(1,1,.65,96),stone,poolX,.05,poolZ);poolWall.scale.set(6,1,4.3);
 const poolSurface=mesh(new T.CircleGeometry(1,128),water,poolX,.4,poolZ);poolSurface.rotation.x=-Math.PI/2;poolSurface.scale.set(5.55,3.85,1);poolSurface.castShadow=false;
 const coping=mat('#c1b8a1');
 for(let i=0;i<56;i++){const a=i/56*Math.PI*2;const block=box(.62,.2,.54,coping,poolX+5.82*Math.cos(a),.45,poolZ+4.08*Math.sin(a));block.rotation.y=-a;}
 for(let i=0;i<17;i++){const a=Math.PI*.07+i/17*Math.PI*.88;const rock=mesh(new T.IcosahedronGeometry(.45+(i%3)*.17,1),stone,poolX+6.4*Math.cos(a),.28,poolZ-4.9*Math.sin(a));rock.scale.set(1.3,.8,1);}
 for(let i=0;i<3;i++)box(2.1,.16, .6,coping,poolX,.08+i*.12,poolZ+5.5-i*.5);
 // Low planting islands give the open space a composed garden rhythm.
 const shrubs=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),herbal,96);scene.add(shrubs);
 const planting=new T.Object3D();let pi=0;
 for(const [gx,gz] of [[-13,-4],[12,-5],[-12,-23],[13,-24],[-26,14],[-9,29]])for(let i=0;i<16;i++){const a=i*2.399,r=Math.sqrt(i)*.5;planting.position.set(gx+Math.cos(a)*r,.25,gz+Math.sin(a)*r);planting.scale.set(.6,.4+(i%3)*.13,.6);planting.updateMatrix();shrubs.setMatrixAt(pi++,planting.matrix);}
 shrubs.instanceMatrix.needsUpdate=true;
 for(const x of [-1.5,1.5])for(const z of [11,17,23]){box(.1,.7,.1,dark,x,.2,z);box(.16,.08,.16,led,x,.58,z);}
 // Only typography is drawn here; all scenery remains actual 3D geometry.
 const labels=[];
 function sign(text,x,z){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#18362e';ctx.fillRect(0,0,512,96);ctx.fillStyle='#f1e5c7';ctx.font='34px Arial';ctx.textAlign='center';ctx.fillText(text,256,60);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;labels.push(texture);const label=mesh(new T.PlaneGeometry(3.1,.58),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}),x,2.35,z);label.castShadow=false;}
 sign('FINSKÁ',0,2.06);sign('HERBAL · L',-24,-1.5);sign('CEREMONIÁLNÍ',29,-6);sign('ODPOČÍVÁRNA · 18 MÍST',0,-22.4);sign('U VODY · 12 MÍST',-31,30);
 sign('VSTUP / ODCHOD',0,20);for(const x of [-1.4,1.4])box(.08,2.6,.08,wood,x,1.15,20);
 const markers=stops.slice(1).map((s,i)=>{const m=mesh(new T.SphereGeometry(.13,16,12),new T.MeshBasicMaterial({color:0xffdb8f}),...s.point);m.userData.index=i+1;return m})
 let destination=null;const rotate=direction=>{destination=null;const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new T.Vector3(0,1,0),direction*Math.PI/8);camera.position.copy(controls.target).add(offset);controls.update()};api.current={rotate,go(i){destination={pos:new T.Vector3(...stops[i].pos),target:new T.Vector3(...stops[i].target)}},cut(v){roofs.forEach(roof=>roof.visible=!v)}}
 controls.addEventListener('start',()=>destination=null)
 renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','3D sauna. Táhněte pro otáčení nebo použijte šipky vlevo a vpravo.');const onKey=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();rotate(e.key==='ArrowLeft'?1:-1)}};renderer.domElement.addEventListener('keydown',onKey)
 const ray=new T.Raycaster(),pointer=new T.Vector2();let down=[0,0]
 const onDown=e=>down=[e.clientX,e.clientY]
 const onUp=e=>{if(Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(markers)[0];if(hit)choose(hit.object.userData.index)}
 renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointerup',onUp)
 const resize=new ResizeObserver(()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()});resize.observe(el)
 let frame;const tick=()=>{frame=requestAnimationFrame(tick);if(document.hidden)return;waterTime.value=window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:performance.now()*.001;if(destination){camera.position.lerp(destination.pos,.065);controls.target.lerp(destination.target,.065);if(camera.position.distanceTo(destination.pos)<.015)destination=null}controls.update();renderer.render(scene,camera)};tick()
 return()=>{cancelAnimationFrame(frame);resize.disconnect();controls.dispose();renderer.domElement.removeEventListener('keydown',onKey);renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointerup',onUp);labels.forEach(texture=>texture.dispose());scene.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose()});renderer.dispose();renderer.domElement.remove();api.current=null}
 },[])
 useEffect(()=>api.current?.cut(cut),[cut])
 return <main className="sauna-page"><div ref={host} className="sauna-scene" aria-label="Interaktivní 3D model sauny v lese"/><header className="sauna-header"><a href="/">AEVUM <span>← Zpět na kliniku</span></a><span>LESNÍ RETREAT / 3D STUDIE</span></header><div className="sauna-heading"><p>TŘI SAUNY. JEDEN KLID.</p><h1>Lesní lázně.</h1><span>Finská · herbal · solná · odpočívárna</span></div>{error&&<div className="sauna-error">3D zobrazení není dostupné. Zkuste prohlížeč s podporou WebGL. Popis míst si můžete projít níže.</div>}<button className="sauna-info-toggle" aria-expanded={details} aria-controls="sauna-info" onClick={()=>setDetails(!details)}>{details ? 'Zavřít detail ×' : 'O místě ⓘ'}</button>{details && <aside id="sauna-info" className="sauna-detail" aria-live="polite"><span>{stops[active].tag}</span><h2>{stops[active].name}</h2><p>{stops[active].text}</p><button onClick={()=>setCut(!cut)} aria-pressed={cut}>{cut?'Zavřít řez saunou':'Otevřít řez saunou'} ↗</button></aside>}<div className="sauna-rotate" role="group" aria-label="Otáčení pohledu"><button aria-label="Otočit pohled doleva" onClick={()=>api.current?.rotate(1)}>←</button><span>Otočit pohled</span><button aria-label="Otočit pohled doprava" onClick={()=>api.current?.rotate(-1)}>→</button></div><footer className="sauna-bottom"><nav aria-label="Místa v sauně">{stops.map((s,i)=><button key={s.name} aria-pressed={active===i} className={active===i?'selected':''} onClick={()=>choose(i)}><span>0{i+1}</span>{s.name}</button>)}</nav><div><span>Levé tlačítko: otáčení · pravé: posun · kolečko: zoom ke kurzoru · dva prsty: posun a zoom</span><span>Koncept prostoru, nikoli realizační dokumentace</span></div></footer></main>
}
