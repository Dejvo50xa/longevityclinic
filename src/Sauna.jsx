import React, {useEffect,useRef,useState} from 'react'
import * as T from 'three'
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js'
import {Sky} from 'three/examples/jsm/objects/Sky.js'
import {Reflector} from 'three/examples/jsm/objects/Reflector.js'
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js'
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js'
import {GTAOPass} from 'three/examples/jsm/postprocessing/GTAOPass.js'
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js'
import {mergeGeometries,mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {ImprovedNoise} from 'three/examples/jsm/math/ImprovedNoise.js'
import './sauna.css'
const stops=[
 {name:'Celý areál',tag:'01 / AREÁL',text:'Tři sauny a odpočívárna v otevřené louce. Cestičky se setkávají u ochlazovací kádě a navazují na přístupovou cestu.',pos:[44,48,61],target:[0,0,-3],point:[0,3,0]},
 {name:'Finská',tag:'02 / FINSKÁ SAUNA',text:'Dřevěná sauna s kamny, stupňovitými lavicemi a šatnou se sprchou. Pod přesahem střechy je zásoba dřeva, řez odkrývá interiér.',pos:[7,5,8],target:[0,1,0],point:[0,3.4,0]},
 {name:'Herbal',tag:'03 / BYLINNÁ SAUNA',text:'Bylinná sauna do L se dvěma propojenými křídly, zelenou střechou a svazky bylin pod stropem. U vstupu jsou vyvýšené záhony levandule.',pos:[-24,9,15],target:[-34,1,2],point:[-34,3.5,2]},
 {name:'Solná / ceremoniální',tag:'04 / SOLNÁ SAUNA',text:'Velká kruhová ceremoniální sauna pod šindelovou střechou: tři soustředné řady lavic, centrální kamna s místem pro saunového mistra a podsvícená stěna ze solných bloků.',pos:[33,12,-23],target:[18,1,-39],point:[18,5,-39]},
 {name:'Odpočívárna',tag:'05 / ODPOČINEK',text:'Velká odpočívárna s 18 lehátky, prosklenými stěnami, zelenou střechou a širokou krytou terasou.',pos:[11,11,-12],target:[0,1,-29],point:[0,4,-29]},
 {name:'Ochlazení',tag:'06 / VODA',text:'Ochlazovací káď při centrální cestě. Odtud vedou samostatné pěšiny ke všem pavilonům.',pos:[9,4,8],target:[4.5,.5,2.7],point:[4.5,1.3,2.7]},
 {name:'Kamenný bazének',tag:'07 / VODNÍ ZAHRADA',text:'Oválný bazének s kamenným lemem, ve kterém se zrcadlí les. Od pergoly s 12 lehátky k němu vedou nášlapné kameny.',pos:[-5,14,34],target:[-19,0,20],point:[-19,1.5,20]},
 {name:'U vody',tag:'08 / DRUHÁ ODPOČÍVÁRNA',text:'Vzdušná pergola porostlá zelení, s 12 lehátky a výhledem na hladinu, stranou od hlavního saunového okruhu.',pos:[-20,10,38],target:[-31,1,24],point:[-31,4,24]},
 {name:'Klinika',tag:'09 / KLINIKA',text:'Samostatná klinika na vzdáleném okraji území, propojená pěší cestou se saunovou zahradou. Architektonická studie recepce a vyšetřovacích křídel.',pos:[123,25,-46],target:[101,3,-70],point:[101,7,-70]},
 {name:'Vstup / odchod',tag:'10 / PŘÍSTUP',text:'Hlavní přístupová cesta pokračuje od centrálního rozcestí ven z areálu, volným průsekem mezi vzdálenými stromy.',pos:[12,14,30],target:[0,0,16],point:[0,1,17]},
 {name:'Potok',tag:'11 / POTOK',text:'Lesní potok napájí jezírko s dřevěným molem a lavičkou. Přes jeho odtok vede lávka na lesní stezku k odpočívárně.',pos:[-13,9,-9],target:[-27,0,-24],point:[-28.6,1.5,-20.6]}
]

// Shared GLSL: cheap hash-based value noise used by every procedural material (no image downloads).
const NOISE=`
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash12(i),hash12(i+vec2(1.,0.)),f.x),mix(hash12(i+vec2(0.,1.)),hash12(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*vnoise(p);p=p*2.03+vec2(17.3,9.1);a*=.5;}return v;}
`
// Boards: grain follows each board's long axis, every board gets its own tone and occasional knots.
const WOOD=`
float ax=vInfo.y,seed=vInfo.x;
float along=ax<.5?vLocal.x:ax<1.5?vLocal.y:vLocal.z;
vec2 cr=ax<.5?vLocal.yz:ax<1.5?vLocal.xz:vLocal.xy;
float across=cr.x+cr.y+seed*9.;
float lod=1.-smoothstep(.15,.6,fwidth(across)*24.);
float grain=sin((across+vnoise(vec2(along*1.6+seed*20.,across*3.))*.08+sin(along*1.3+seed*6.)*.03)*150.)*lod;
float fibre=(vnoise(vec2(along*40.,across*500.))-.5)*lod;
float kp=along*.7+seed*5.;
float knot=step(.74,hash12(vec2(floor(kp),seed*37.)))*smoothstep(.1,.0,length(vec2((fract(kp)-.5)*1.4,(cr.x+cr.y)*3.)));
vec3 tone=mix(vec3(.8,.78,.74),vec3(1.1,1.05,.98),seed)*mix(vec3(1.),vec3(1.07,.94,.84),step(.72,fract(seed*7.13)));
diffuseColor.rgb*=tone*(.9+grain*.06+fibre*.16)*(1.-knot*.55);
`
const MEADOW=`uniform vec3 uLush,uDry,uDeep;
vec3 meadow(vec2 xz){float n=fbm(xz*.045+3.7),m=fbm(xz*.23+11.1),f=vnoise(xz*2.7);vec3 c=mix(uLush,uDry,smoothstep(.42,.72,n));c=mix(c,uDeep,smoothstep(.5,.78,m)*.55);return c*(.9+.2*f);}
`
// Lawn → forest floor → distant canopy, with trampled soil along paths from the occupancy map.
const GROUND=`
vec2 xz=vWorld.xz;float gR=length(xz);
vec3 gC=meadow(xz);
float detailLod=1.-smoothstep(.15,.7,fwidth(xz.x)*40.);
gC*=mix(1.,.7+.6*(vnoise(xz*vec2(38.,41.))*.6+vnoise(xz*vec2(97.,89.))*.4),detailLod);
float forest=smoothstep(51.,60.,gR+(fbm(xz*.05)-.5)*12.)*smoothstep(36.,48.,length(xz-vec2(101.,-70.)));
gC=mix(gC,uFloor*(.75+.5*vnoise(xz*1.7))*(.8+.4*fbm(xz*.3)),forest*.9);
gC=mix(gC,uCanopy*(.75+.5*fbm(xz*.015)),smoothstep(300.,420.,gR));
vec2 mu=vec2(xz.x-uMaskBox.x+uMaskBox.z,uMaskBox.y+uMaskBox.z-xz.y)/(2.*uMaskBox.z);
float inMap=step(0.,mu.x)*step(mu.x,1.)*step(0.,mu.y)*step(mu.y,1.);if(inMap*texture2D(uHole,clamp(mu,0.,1.)).r>.5)discard;
float wear=texture2D(uMask,clamp(mu,0.,1.)).r*inMap;
gC=mix(gC,uWorn*(.85+.3*vnoise(xz*5.)),smoothstep(.03,.5,wear)*.7);
diffuseColor.rgb=gC;
`
const GRASS_WIND=`float gust=sin(uTime*1.3+worldP.x*.21+worldP.z*.17)*.5+.5;float flutter=sin(uTime*3.3+worldP.x*1.9+worldP.z*1.3);windOffset=vec3(gust*.8+flutter*.2,0.,gust*.35+flutter*.1)*vH*vH*uSway;`
const UP_NORMAL='normal=normalize((viewMatrix*vec4(0.,1.,0.,0.)).xyz);'
const TREE_WIND=`float bend=position.y*position.y;float ph=worldP.x*.05+worldP.z*.04;windOffset=vec3(sin(uTime*.8+ph)*.7+sin(uTime*1.9+ph*3.)*.25,0.,cos(uTime*.6+ph)*.35)*bend*uSway;`
const WATER_NORMAL=`
vec2 wp=vWorld.xz;float wt=uTime;vec2 wg=vec2(0.);
wg+=vec2(1.9,0.)*cos(wp.x*1.9+wt*1.2)*.02;
wg+=vec2(0.,2.3)*cos(wp.y*2.3-wt*.9)*.017;
wg+=vec2(3.7,2.9)*cos(dot(wp,vec2(3.7,2.9))+wt*1.8)*.006;
wg+=vec2(-5.3,6.1)*cos(dot(wp,vec2(-5.3,6.1))-wt*2.3)*.003;
wg+=(vec2(vnoise(wp*5.+wt*.5),vnoise(wp*5.-wt*.4+9.))-.5)*.16;
normal=normalize((viewMatrix*vec4(normalize(vec3(-wg.x,1.,-wg.y)),0.)).xyz);
`
const WATER_COLOR=`
float rr=length(vLocal.xy);
diffuseColor.rgb=mix(uWDeep,uWShallow,smoothstep(.45,1.,rr));
float caus=pow(max(0.,sin(vWorld.x*9.+sin(vWorld.z*7.+uTime*.7)*1.6+uTime*.5)*sin(vWorld.z*8.-uTime*.4+sin(vWorld.x*6.)*1.4)),6.);
diffuseColor.rgb+=uWShallow*caus*.5*smoothstep(.3,1.,rr);
`
const CLOUDS=`uniform float uTime,uBright,uCover;uniform vec3 uSun,uTint;varying vec3 vDir;${NOISE}
void main(){vec3 d=normalize(vDir);if(d.y<=0.)discard;
vec2 p=d.xz/(d.y+.12)*2.2+vec2(uTime*.006,uTime*.002);
float n=fbm(p)*.65+fbm(p*2.7+5.)*.35;
float cover=smoothstep(uCover,uCover+.24,n)*smoothstep(0.,.1,d.y);
vec3 lit=mix(vec3(.55,.6,.68),vec3(1.,.96,.9),smoothstep(.5,.85,n))+pow(max(dot(d,uSun),0.),6.)*.35;
gl_FragColor=vec4(lit*uTint*uBright,cover*.9);}`
const SMOKE_V=`attribute float aSeed;uniform float uTime,uRise,uRate,uSize,uDrift,uPeriod,uLife,uWobble;uniform vec3 uOrigin;varying vec2 vUv;varying float vA,vS;
void main(){float life=uPeriod>0.?(mod(uTime,uPeriod)-aSeed*.6)/uLife:fract(uTime*uRate+aSeed);float on=step(0.,life)*step(life,1.);life=clamp(life,0.,1.);
vec3 c=uOrigin+vec3(life*life*uDrift+sin(aSeed*40.+uTime*.6)*uWobble*life,life*uRise,life*life*uDrift*.45+cos(aSeed*23.+uTime*.5)*uWobble*life);
vec4 mv=viewMatrix*vec4(c,1.);float s=uSize*mix(.35,2.6,sqrt(life))*on;float a=aSeed*6.2831+uTime*.15*(aSeed-.5);
mv.xy+=mat2(cos(a),sin(a),-sin(a),cos(a))*position.xy*s;gl_Position=projectionMatrix*mv;
vUv=uv;vA=smoothstep(0.,.12,life)*(1.-life)*on;vS=aSeed;}`
const SMOKE_F=`uniform vec3 uColor;uniform float uOpacity,uLight;varying vec2 vUv;varying float vA,vS;${NOISE}
void main(){vec2 p=vUv-.5;float n=fbm(p*3.+vS*17.);float a=smoothstep(1.,.15,length(p)*2.+n*.35)*vA*uOpacity;gl_FragColor=vec4(uColor*uLight*(.8+.3*n),a);}`

// Snow settles only on the topmost surface: compare against a height map rendered from above (height + 50).
const SNOW_TOP=`{vec2 hu=vec2(vWorld.x-uHeightBox.x+uHeightBox.z,uHeightBox.y+uHeightBox.z-vWorld.z)/(2.*uHeightBox.z);if(hu.x>0.&&hu.x<1.&&hu.y>0.&&hu.y<1.){float top=textureLod(uHeight,hu,0.).r-50.;snowAmt*=smoothstep(top-.25,top-.06,vWorld.y);}}`
const HEIGHT_V=`varying float vY;void main(){vec4 p=vec4(position,1.);
#ifdef USE_INSTANCING
p=instanceMatrix*p;
#endif
p=modelMatrix*p;vY=p.y;gl_Position=projectionMatrix*viewMatrix*p;}`
// Pool surface: live mirror of the forest and sky, rippled, with a deeper centre.
const POOL={name:'Pool',uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null},uTime:{value:0},uBody:{value:1},uDeep:{value:new T.Color('#0c3433')},uShallow:{value:new T.Color('#2f7c73')}},
 vertexShader:'uniform mat4 textureMatrix;varying vec4 vUv;varying vec3 vWorld;varying vec2 vLocal;void main(){vUv=textureMatrix*vec4(position,1.);vLocal=position.xy;vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
 fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime,uBody;uniform vec3 uDeep,uShallow;varying vec4 vUv;varying vec3 vWorld;varying vec2 vLocal;${NOISE}
void main(){vec2 wp=vWorld.xz;float wt=uTime;vec2 wg=vec2(1.9,0.)*cos(wp.x*1.9+wt*1.2)*.02+vec2(0.,2.3)*cos(wp.y*2.3-wt*.9)*.017+vec2(3.7,2.9)*cos(dot(wp,vec2(3.7,2.9))+wt*1.8)*.006+(vec2(vnoise(wp*5.+wt*.5),vnoise(wp*5.-wt*.4+9.))-.5)*.16;
vec3 n=normalize(vec3(-wg.x,1.,-wg.y));float fres=.02+.98*pow(1.-max(dot(normalize(cameraPosition-vWorld),n),0.),5.);
vec4 uv=vUv;uv.xy+=wg*.035*uv.w;vec3 refl=texture2DProj(tDiffuse,uv).rgb;
vec3 body=mix(uDeep,uShallow,smoothstep(.45,1.,length(vLocal)))*uBody;
gl_FragColor=vec4(mix(body,refl,clamp(fres*1.15+.1,0.,.92)),1.);}`}
const SNOWFALL_V=`uniform float uTime,uScale;varying float vA;void main(){vec3 box=vec3(80.,45.,80.);vec3 p=position*box;float sp=.6+.5*fract(position.x*97.+position.z*13.);p.y-=uTime*sp*1.1;p.x+=sin(uTime*.5+position.z*30.)*.8+uTime*.35;p.z+=cos(uTime*.4+position.x*27.)*.6;p=mod(p-cameraPosition+box*.5,box)+cameraPosition-box*.5;vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(uScale*.05/-mv.z,1.,22.);vA=smoothstep(55.,15.,-mv.z);}`
const SNOWFALL_F='uniform float uLight;varying float vA;void main(){float a=smoothstep(.5,.1,length(gl_PointCoord-.5))*vA*.9;gl_FragColor=vec4(vec3(uLight),a);}'
// Light presets: sun position in degrees, sky scattering, lights, haze and exposure for each time of day and season.
const MODES={
 day:{elev:26,az:-58,sky:[3.2,1.9,.0035,.8],sun:['#ffe2bf',3.1],hemi:['#cfe0ea','#4a4630',.45],env:.85,fog:['#aebcc0',.0021],exposure:.95,clouds:[1.5,.44,'#ffffff'],night:0,smoke:1.25,body:1},
 dusk:{elev:3.5,az:-100,sky:[6,2.8,.006,.92],sun:['#ff8f55',1.1],hemi:['#6f7fa8','#2b2622',.22],env:.5,fog:['#737a8c',.0024],exposure:1.3,clouds:[.8,.46,'#ffb08a'],night:1,smoke:.4,body:.35},
 winterDay:{elev:14,az:-40,sky:[10,1.1,.008,.78],sun:['#f3f5ff',2],hemi:['#dde7ef','#b9bec6',.55],env:.85,fog:['#c7cfd5',.0032],exposure:.68,clouds:[1.7,.34,'#ffffff'],night:0,smoke:1.2,body:.9},
 winterDusk:{elev:3,az:-100,sky:[7,2.4,.006,.9],sun:['#ff9c6e',.8],hemi:['#7483aa','#5a5f6c',.28],env:.5,fog:['#7a8193',.003],exposure:1.25,clouds:[.75,.38,'#ffb08a'],night:1,smoke:.45,body:.35}
}

export default function Sauna(){
 const host=useRef(),api=useRef();const [active,setActive]=useState(0),[cut,setCut]=useState(false),[error,setError]=useState(false),[details,setDetails]=useState(false),[dusk,setDusk]=useState(false),[winter,setWinter]=useState(false)
 const choose=i=>{setActive(i);setCut(false);api.current?.go(i)}
 useEffect(()=>{document.title='Lesní sauna · AEVUM';const el=host.current;let renderer
 try{renderer=new T.WebGLRenderer({antialias:false,powerPreference:'high-performance'})}catch{setError(true);return}
 // Phones and touch devices get fewer grass tufts and trees, a smaller shadow map and no ambient occlusion.
 const low=matchMedia('(max-width: 760px), (pointer: coarse)').matches,reduced=matchMedia('(prefers-reduced-motion: reduce)')
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;el.appendChild(renderer.domElement)
 const scene=new T.Scene(),skyScene=new T.Scene();scene.fog=new T.FogExp2('#aebcc0',.0021)
 const camera=new T.PerspectiveCamera(43,1,.1,1600);camera.position.set(...stops[0].pos)
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(...stops[0].target);controls.enableDamping=false;controls.minDistance=2;controls.maxDistance=350;controls.maxPolarAngle=Math.PI*.48;controls.enablePan=true;controls.zoomToCursor=true;controls.screenSpacePanning=true;controls.enableRotate=true;controls.minAzimuthAngle=-Infinity;controls.maxAzimuthAngle=Infinity;controls.mouseButtons.LEFT=T.MOUSE.PAN;controls.mouseButtons.RIGHT=T.MOUSE.ROTATE;controls.touches.ONE=T.TOUCH.PAN;controls.touches.TWO=T.TOUCH.DOLLY_PAN
 const uTime={value:0},uSnow={value:0},snowU={uSnow,uSnowColor:{value:new T.Color('#e4eaef')},uHeight:{value:null},uHeightBox:{value:new T.Vector3()}},smokeLight={value:1.25}

 // Late-afternoon sun, physical sky with drifting clouds, and the sky as image-based light for every material.
 const sunDir=new T.Vector3().setFromSphericalCoords(1,T.MathUtils.degToRad(64),T.MathUtils.degToRad(-58))
 const sky=new Sky();sky.scale.setScalar(900);skyScene.add(sky)
 Object.entries({turbidity:3.2,rayleigh:1.9,mieCoefficient:.0035,mieDirectionalG:.8}).forEach(([k,v])=>sky.material.uniforms[k].value=v);sky.material.uniforms.sunPosition.value.copy(sunDir)
 const clouds=new T.Mesh(new T.SphereGeometry(800,48,24),new T.ShaderMaterial({side:T.BackSide,transparent:true,depthWrite:false,depthTest:false,uniforms:{uTime,uSun:{value:sunDir},uBright:{value:1.5},uCover:{value:.44},uTint:{value:new T.Color('#ffffff')}},vertexShader:'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:CLOUDS}));skyScene.add(clouds)
 const pmrem=new T.PMREMGenerator(renderer);let envTarget=pmrem.fromScene(skyScene,0,.1,1000);scene.environment=envTarget.texture;scene.environmentIntensity=.85
 const hemi=new T.HemisphereLight(0xcfe0ea,0x4a4630,.45);scene.add(hemi)
 const sun=new T.DirectionalLight(0xffe2bf,3.1);sun.castShadow=true;const shadowSize=low?2048:4096;sun.shadow.mapSize.set(shadowSize,shadowSize);sun.shadow.bias=-.0004;sun.shadow.normalBias=.035;scene.add(sun,sun.target)

 // Procedural materials: shader snippets injected into MeshStandardMaterial so lighting, shadows and fog stay standard.
 const programs=new Map()
 function patch(material,{uniforms={},head='',vertex='',wind='',color='',rough='',normal='',emissive='',snow=true,snowTop=true,snowExtra=''}={}){
  const snowCode=snow?`float snowN=vnoise(vWorld.xz*2.3)*.5+vnoise(vWorld.xz*11.)*.5;float snowAmt=uSnow*smoothstep(.3,.72,vUpW+(snowN-.5)*.45);${snowTop?SNOW_TOP:''}${snowExtra}diffuseColor.rgb=mix(diffuseColor.rgb,uSnowColor*(.9+.1*snowN),snowAmt);`:'float snowAmt=0.;'
  const code=[head,vertex,wind,color,rough,normal,emissive,snowCode].join('§');if(!programs.has(code))programs.set(code,'patch'+programs.size);const key=programs.get(code);material.customProgramCacheKey=()=>key
  material.onBeforeCompile=s=>{
   Object.assign(s.uniforms,{uTime},snowU,uniforms)
   const vary=`varying vec3 vWorld;varying vec3 vLocal;varying vec2 vInfo;varying float vUpW;uniform float uTime,uSnow;uniform vec3 uSnowColor,uHeightBox;uniform sampler2D uHeight;${NOISE}${head}`
   s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>\nattribute vec3 aLocal;attribute vec2 aInfo;${vary}`).replace('#include <begin_vertex>',`#include <begin_vertex>\n${vertex}
    #ifdef USE_INSTANCING
     vLocal=position;vInfo=vec2(fract(instanceMatrix[3].x*.371+instanceMatrix[3].z*.713),1.);vec4 worldP=modelMatrix*instanceMatrix*vec4(transformed,1.);vUpW=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*objectNormal).y;
    #else
     vLocal=aLocal;vInfo=aInfo;vec4 worldP=modelMatrix*vec4(transformed,1.);vUpW=normalize(mat3(modelMatrix)*objectNormal).y;
    #endif
    vec3 windOffset=vec3(0.);${wind}vWorld=worldP.xyz+windOffset;`).replace('#include <project_vertex>',`vec4 mvPosition=vec4(transformed,1.);
    #ifdef USE_INSTANCING
     mvPosition=instanceMatrix*mvPosition;
    #endif
    mvPosition=modelMatrix*mvPosition;mvPosition.xyz+=windOffset;mvPosition=viewMatrix*mvPosition;gl_Position=projectionMatrix*mvPosition;`)
   s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>\n${vary}`).replace('#include <color_fragment>',`#include <color_fragment>\n${color}\n${snowCode}`).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\n${rough}roughnessFactor=mix(roughnessFactor,.85,snowAmt);`).replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>\n${normal}`).replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>\n${emissive}`)
  }
  return material
 }
 const std=(color,o={})=>new T.MeshStandardMaterial({color,roughness:.8,...o})
 const col=hex=>({value:new T.Color(hex)})
 const wood=patch(std('#b8895a',{roughness:.72}),{color:WOOD,rough:'roughnessFactor=clamp(roughnessFactor+grain*.05+knot*.12,0.,1.);'})
 const charred=std('#222725',{roughness:.62}),steel=std('#2c302f',{metalness:.7,roughness:.42}),chrome=std('#b3bab9',{metalness:.9,roughness:.2}),metalRoof=std('#383d3c',{metalness:.55,roughness:.5})
 const rock=patch(std('#7b7f78',{roughness:.92}),{head:'uniform vec3 uMoss;',uniforms:{uMoss:col('#55602f')},color:'float rn=fbm(vWorld.xz*1.9+vWorld.y*1.3),rs=vnoise(vWorld.xz*13.+vWorld.y*9.);diffuseColor.rgb*=.6+.55*rn+.15*rs;float moss=smoothstep(.45,.85,vUpW)*smoothstep(.4,.62,fbm(vWorld.xz*2.4+4.));diffuseColor.rgb=mix(diffuseColor.rgb,uMoss*(.75+.5*rs),moss*.8);'})
 const saunaStone=patch(std('#4d4d4a',{roughness:.85}),{color:'diffuseColor.rgb*=.6+.7*vnoise(vWorld.xz*40.+vWorld.y*30.);'})
 const coping=patch(std('#c4bba6',{roughness:.85}),{color:'diffuseColor.rgb*=(.86+.18*vInfo.x)*(.92+.12*vnoise(vWorld.xz*9.));'})
 const paving=patch(std('#8b8f88',{roughness:.9}),{color:'diffuseColor.rgb*=(.84+.2*vInfo.x)*(.85+.25*(vnoise(vWorld.xz*4.)*.5+vnoise(vWorld.xz*19.)*.5));'})
 const gravel=patch(std('#a39a82',{roughness:.95}),{color:'vec2 gp=vWorld.xz;float gl=1.-smoothstep(.2,.9,fwidth(gp.x)*42.);float g1=hash12(floor(gp*42.)),g3=hash12(floor(gp*42.)+7.);diffuseColor.rgb*=.8+.25*vnoise(gp*7.+3.);diffuseColor.rgb*=mix(1.,.72+.5*g1,.8*gl);diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.82,.86,.9),step(.82,g3)*.7*gl);',snowExtra:'snowAmt*=.55+.45*vnoise(vWorld.xz*.6);'})
 const water=patch(std('#123f3f',{roughness:.05,metalness:0,envMapIntensity:1.4}),{head:'uniform vec3 uWDeep,uWShallow;',uniforms:{uWDeep:col('#0c3433'),uWShallow:col('#2f7c73')},color:WATER_COLOR,normal:WATER_NORMAL,snow:false})
 const glass=std('#d3e6df',{transparent:true,opacity:.24,metalness:0,roughness:.03,envMapIntensity:1.8,depthWrite:false})
 const linen=std('#ddd4c0',{roughness:.95}),towels=['#8d9f86','#c9b48c','#ece8df','#4a4f4c'].map(c=>std(c,{roughness:1}))
 const led=std('#ffc77a',{emissive:'#ffad42',emissiveIntensity:2}),lampGlow=std('#ffd9a0',{emissive:'#ffb65c',emissiveIntensity:3}),fire=std('#ff8a3a',{emissive:'#ff5a14',emissiveIntensity:4})
 const salt=patch(std('#f0b88a',{emissive:'#e07a3a',emissiveIntensity:.55,roughness:.7}),{color:'diffuseColor.rgb*=.85+.3*vInfo.x;',emissive:'totalEmissiveRadiance*=.5+vInfo.x*1.1;'})
 const sedum=patch(std('#556b33',{roughness:.95}),{color:'vec2 sp=vWorld.xz;float sa=fbm(sp*1.3),sb=vnoise(sp*11.),sc2=fbm(sp*.55+5.);vec3 sc=mix(vec3(.07,.13,.03),vec3(.22,.2,.05),smoothstep(.4,.72,sa));sc=mix(sc,vec3(.2,.05,.03),smoothstep(.6,.78,sc2)*.75);diffuseColor.rgb=sc*(.7+.55*sb);'})
 const shingle=patch(std('#7a6a58',{roughness:.9,side:T.DoubleSide}),{color:'float ang=atan(vLocal.z,vLocal.x)/6.2831853+.5;float row=floor(vLocal.y/.25+.08);float u=ang*170.+row*.5;float cell=hash12(vec2(floor(u),row));float seam=smoothstep(0.,.08,fract(u))*smoothstep(1.,.92,fract(u));diffuseColor.rgb*=(.84+.24*cell)*(.8+.2*seam)*(.85+.15*smoothstep(0.,.5,fract(vLocal.y/.25+.08)));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.23,.23,.22),vnoise(vec2(u*.2,vLocal.y*3.))*.35);'})
 const clinicStone=patch(std('#d8d5c8',{roughness:.85}),{color:'float cy=vWorld.y/.62,rowi=floor(cy);float cx=(vLocal.x+vLocal.z)/1.24+mod(rowi,2.)*.5;float jy=smoothstep(0.,.03,fract(cy))*smoothstep(1.,.97,fract(cy));float jx=smoothstep(0.,.015,fract(cx))*smoothstep(1.,.985,fract(cx));diffuseColor.rgb*=(.9+.12*hash12(vec2(floor(cx),rowi)))*mix(.72,1.,jx*jy);'})
 const clinicGlass=std('#6f9599',{metalness:.5,roughness:.1,envMapIntensity:1.4})
 const corten=patch(std('#7b4526',{roughness:.8,metalness:.25}),{color:'diffuseColor.rgb*=.75+.45*fbm(vWorld.xz*3.+vWorld.y*4.);'})
 const copper=std('#b06a3c',{metalness:.85,roughness:.35}),ceramic=std('#40464a',{roughness:.55}),terracotta=std('#9d5d3d',{roughness:.85})
 const herbs=['#5f7a3e','#7c6aa0','#b59a54'].map(c=>std(c,{roughness:.95})),plant=patch(std('#4b6a33',{roughness:.9}),{color:'diffuseColor.rgb*=.75+.5*vnoise(vWorld.xz*6.+vWorld.y*5.);'})
 const bucketWater=std('#1d4543',{roughness:.1}),lampShade=std('#2c302f',{metalness:.6,roughness:.45,side:T.DoubleSide}),panel=std('#1d2a3a',{metalness:.4,roughness:.25})
 for(const m of [charred,steel,chrome,metalRoof,linen,...towels,ceramic,terracotta,copper,panel,lampShade])patch(m)
 const concrete=patch(std('#9b9b95',{roughness:.9}),{color:'diffuseColor.rgb*=.82+.22*vnoise(vWorld.xz*5.+vWorld.y*7.);'}),soil=patch(std('#3b2f24',{roughness:1}))
 const mud=patch(std('#5a4c3b',{roughness:.85}),{color:'float mn=vnoise(vWorld.xz*3.)*.6+vnoise(vWorld.xz*17.)*.4;diffuseColor.rgb*=.7+.5*mn;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.16,.2,.09),smoothstep(.55,.8,fbm(vWorld.xz*.9))*.6);'})
 const streamWater=patch(std('#132b28',{roughness:.08,envMapIntensity:1.1}),{snow:false,head:'varying vec2 vFlow;',vertex:'vFlow=uv;',normal:'vec2 fp=vec2(vFlow.x*3.,vFlow.y*1.2-uTime*.9);vec2 fg=(vec2(vnoise(fp*2.),vnoise(fp*2.+7.))-.5)*.16+(vec2(vnoise(fp*6.+3.),vnoise(fp*6.+11.))-.5)*.06;normal=normalize((viewMatrix*vec4(normalize(vec3(fg.x,1.,fg.y)),0.)).xyz);',color:'diffuseColor.rgb*=.8+.3*vnoise(vec2(vFlow.x*4.,vFlow.y*2.-uTime));'})
 const ice=patch(std('#d6e4e8',{roughness:.25,envMapIntensity:1.2}),{head:'uniform vec2 uHole,uHoleR;',uniforms:{uHole:{value:new T.Vector2(.25,-.55)},uHoleR:{value:new T.Vector2(.2,.28)}},color:'if(length((vLocal.xy-uHole)/uHoleR)<1.)discard;float ic=vnoise(vWorld.xz*1.3)*.6+vnoise(vWorld.xz*7.)*.4;diffuseColor.rgb*=.78+.3*ic;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.35,.45,.5),smoothstep(.02,0.,abs(vnoise(vWorld.xz*2.)-.5))*.5);'})
 const skin=patch(std('#c9c0b3',{roughness:.85}),{snow:false}),robes=['#ece8df','#8d9f86','#b9a37a'].map(c=>patch(std(c,{roughness:1}),{snow:false}))
 const twig=patch(std('#4f433e',{roughness:.95}),{snowTop:false}),footprint=new T.MeshStandardMaterial({color:'#9aa6b4',roughness:1,transparent:true,opacity:.55,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2})
 const endgrain=patch(std('#c8a06a',{roughness:.9}),{color:'float rr=length(vLocal.yz);diffuseColor.rgb*=(.82+.12*sin(rr*38.+vnoise(vLocal.yz*6.)*3.))*mix(1.,.5,smoothstep(.86,.97,rr));'})
 const logBark=patch(std('#5b4a3a',{roughness:.95}),{color:'float gr=sin(atan(vLocal.z,vLocal.y)*14.+vnoise(vLocal.xz*vec2(12.,3.))*3.);diffuseColor.rgb*=.7+.3*smoothstep(-.5,.6,gr);'})
 const foliage=(hex,sway,up=.25)=>patch(std(hex,{vertexColors:true,side:T.DoubleSide,roughness:.88}),{snowTop:false,snowExtra:'snowAmt=uSnow*smoothstep(.62,.95,vUpW+(snowN-.5)*.7)*.85;',head:'uniform float uSway,uUp;',uniforms:{uSway:{value:sway},uUp:{value:up}},wind:TREE_WIND,normal:'normal=normalize(mix(normal,(viewMatrix*vec4(0.,1.,0.,0.)).xyz,uUp));',color:'float fl=vnoise(vec2(vWorld.x+vWorld.z,vWorld.y)*4.)*.5+vnoise(vec2(vWorld.x-vWorld.z,vWorld.y)*9.)*.5;diffuseColor.rgb*=(.88+.24*vnoise(vWorld.xz*.9+vWorld.y*.7))*(.74+.46*fl);'})

 function mesh(g,m,x,y,z,parent=scene){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=m!==glass;o.receiveShadow=true;parent.add(o);return o}
 const box=(w,h,d,m,x,y,z,p)=>mesh(new T.BoxGeometry(w,h,d),m,x,y,z,p)
 const cyl=(rt,rb,h,m,x,y,z,p,seg=16)=>mesh(new T.CylinderGeometry(rt,rb,h,seg),m,x,y,z,p)
 const keep=o=>{o.userData.keep=true;return o}
 // Seeded randomness keeps the landscape identical across visits.
 let seed=42;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
 const noise=new ImprovedNoise(),smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)}
 const segDist=(px,pz,ax,az,bx,bz)=>{const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((px-ax)*dx+(pz-az)*dz)/(dx*dx+dz*dz)));return Math.hypot(px-ax-dx*t,pz-az-dz*t)}
 // Irregular lumps for rocks, bushes and crowns.
 function blob(detail,amp,k){let g=new T.IcosahedronGeometry(1,detail);g.deleteAttribute('normal');g.deleteAttribute('uv');g=mergeVertices(g);const p=g.attributes.position,v=new T.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);v.multiplyScalar(1+noise.noise(v.x*1.4+k*3.1,v.y*1.4+k,v.z*1.4)*amp+noise.noise(v.x*3.3,v.y*3.3,v.z*3.3+k*2)*amp*.35);p.setXYZ(i,v.x,v.y,v.z)}g.computeVertexNormals();return g}
 const rockGeos=[0,1,2,3,4,5].map(k=>{const g=blob(2,.34,k);g.scale(1,.72,1);g.computeVertexNormals();return g}),pebbleGeos=[0,1,2].map(k=>blob(1,.25,k+9))
 const rockAt=(x,y,z,s,m=rock,p)=>{const o=mesh(rockGeos[Math.floor(rand()*6)],m,x,y,z,p);o.scale.set(s*(.8+rand()*.5),s*(.7+rand()*.5),s*(.8+rand()*.5));o.rotation.y=rand()*6.28;return o}
 function shade(g,lo=.5,hi=1.05,up=0){const n=g.attributes.normal,p=g.attributes.position,c=[];for(let i=0;i<n.count;i++){const f=(lo+(hi-lo)*(n.getY(i)*.5+.5))*(1+up*p.getY(i));c.push(f,f,f)}g.setAttribute('color',new T.Float32BufferAttribute(c,3));return g}

 // Faceless figures for scale, in the manner of an architectural model.
 const upAxis=new T.Vector3(0,1,0)
 function limb(a,b,r,m,g){const dir=b.clone().sub(a),len=dir.length(),o=new T.Mesh(new T.CapsuleGeometry(r,Math.max(.01,len),3,8),m);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(upAxis,dir.normalize());o.castShadow=o.receiveShadow=true;g.add(o)}
 function person(pose,x,y,z,ry,{S=.45,W=0,robe}={}){
  const V=(a,b,c)=>new T.Vector3(a,b,c),g=new T.Group(),body=robe||skin,w=pose==='walk'?1:0;let J
  if(pose==='sit')J={p:V(0,S+.1,0),c:V(0,S+.5,-.04),h:V(0,S+.77,-.03),hip:[V(-.09,S+.1,0),V(.09,S+.1,0)],knee:[V(-.1,S+.1,.42),V(.1,S+.1,.42)],ank:[V(-.1,.08,.46),V(.1,.08,.46)],sh:[V(-.19,S+.55,-.03),V(.19,S+.55,-.03)],el:[V(-.22,S+.3,.08),V(.22,S+.3,.08)],wr:[V(-.16,S+.17,.3),V(.16,S+.17,.3)],foot:V(0,0,1)}
  else if(pose==='lie')J={p:V(0,.66,-.38),c:V(0,.86,-.78),h:V(0,1.02,-1.03),hip:[V(-.09,.64,-.35),V(.09,.64,-.35)],knee:[V(-.09,.68,.08),V(.09,.68,.08)],ank:[V(-.09,.64,.52),V(.09,.64,.52)],sh:[V(-.19,.89,-.83),V(.19,.89,-.83)],el:[V(-.27,.73,-.58),V(.27,.73,-.58)],wr:[V(-.23,.67,-.32),V(.23,.67,-.32)],foot:V(0,1,.3)}
  else if(pose==='bathe')J={p:V(0,W-.3,0),c:V(0,W+.16,0),h:V(0,W+.44,0),sh:[V(-.19,W+.21,0),V(.19,W+.21,0)],el:[V(-.32,W+.01,.12),V(.32,W+.01,.12)],wr:[V(-.3,W-.06,.34),V(.3,W-.06,.34)]}
  else J={p:V(0,.95,0),c:V(0,1.36,0),h:V(0,1.64,0),hip:[V(-.09,.93,0),V(.09,.93,0)],knee:[V(-.09,.5,.12*w),V(.09,.5,-.08*w)],ank:[V(-.09,.08,.22*w),V(.09,.08,-.2*w)],sh:[V(-.19,1.43,0),V(.19,1.43,0)],el:[V(-.23,1.14,-.1*w),V(.23,1.14,.1*w)],wr:[V(-.24,.88,-.16*w+.03),V(.24,.88,.18*w+.03)],foot:V(0,0,1)}
  limb(J.p,J.c,.14,body,g);limb(J.sh[0],J.sh[1],.07,body,g);limb(J.c,J.h,.05,skin,g)
  const head=new T.Mesh(new T.SphereGeometry(.1,14,10),skin);head.position.copy(J.h);head.scale.y=1.15;head.castShadow=head.receiveShadow=true;g.add(head)
  for(let k=0;k<2;k++){limb(J.sh[k],J.el[k],.047,body,g);limb(J.el[k],J.wr[k],.04,skin,g);if(J.hip){limb(J.hip[k],J.knee[k],.07,skin,g);limb(J.knee[k],J.ank[k],.058,skin,g);limb(J.ank[k],J.ank[k].clone().addScaledVector(J.foot,.14),.045,skin,g)}}
  if(J.hip)limb(J.hip[0],J.hip[1],.095,body,g)
  g.position.set(x,y,z);g.rotation.y=ry;g.updateMatrix();for(const o of [...g.children]){o.applyMatrix4(g.matrix);scene.add(o)}
 }

 // Terrain: level clearing and clinic meadow, rolling hills beyond the forest.
 const terrainHeight=(x,z)=>{const d=Math.min(Math.hypot(x,z),Math.hypot(x-101,z+70)+22,segDist(x,z,30,-29,101,-59)+40),amp=smooth(60,190,d);return amp?amp*((noise.noise(x*.009,z*.009,1.7)*.5+.5)*16+noise.noise(x*.035,z*.035,4.1)*3):0}
 const groundU={uLush:col('#5b7a37'),uDry:col('#9a9459'),uDeep:col('#3b5a2a'),uFloor:col('#4b3f2f'),uWorn:col('#857759'),uCanopy:col('#27392a'),uMask:{value:null},uHole:{value:null},uMaskBox:{value:new T.Vector3()}}
 const groundMat=patch(std('#5b7a37',{roughness:1}),{head:MEADOW+'uniform vec3 uFloor,uWorn,uCanopy,uMaskBox;uniform sampler2D uMask,uHole;',uniforms:groundU,color:GROUND,snowExtra:'snowAmt*=1.-forest*.3-smoothstep(.15,.6,wear)*.2;'})
 const terrainGeo=new T.PlaneGeometry(2000,2000,200,200);terrainGeo.rotateX(-Math.PI/2);{const p=terrainGeo.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,-.225+terrainHeight(p.getX(i),p.getZ(i)));terrainGeo.computeVertexNormals()}
 const terrain=keep(mesh(terrainGeo,groundMat,0,0,0));terrain.castShadow=false
 const groundY=(x,z)=>-.225+terrainHeight(x,z),MASK={cx:27,cz:-12,R:110,N:768}
 // Objects shown only in one season, and warm light pools on the ground that appear at dusk.
 const summerOnly=[],winterOnly=[],pools=[]

 // ——— Finnish sauna: board-by-board shell, pitched metal roof, stove with a stone cage ———
 const shell=new T.Group();scene.add(shell);const roofs=[shell]
 for(let i=0;i<37;i++){box(.155,.16,7,wood,-3+i*.165,0,1.2)}
 // Buildings stand on concrete piers with a gravel drip strip, not straight on the grass.
 function piers(x0,x1,z0,z1,top,parent=scene){const nx=Math.max(2,Math.round((x1-x0)/1.5)+1),nz=Math.max(2,Math.round((z1-z0)/1.5)+1);for(let i=0;i<nx;i++)for(let j=0;j<nz;j++)box(.2,top+.25,.2,concrete,x0+(x1-x0)*i/(nx-1),(top-.25)/2,z0+(z1-z0)*j/(nz-1),parent)}
 piers(-2.9,2.85,-2.1,4.5,-.08);piers(3.1,4.45,-1.8,1,-.08)
 for(const [w,d,x,z] of [[8.9,.45,.6,-2.55],[.45,7.6,-3.75,1.2]])box(w,.05,d,gravel,x,-.2,z)
 box(2.6,.24,2.6,concrete,4.35,-.11,2.7);for(let i=0;i<3;i++)for(const z of [4.9,6.5])box(.16,.35,.16,concrete,-.7+i*.72,-.075,z)
 for(let i=0;i<32;i++)box(.17,2.65,.16,i%4===0?charred:wood,-2.8+i*.18,1.43,-2,shell)
 const roofUnder=z=>2.95+z*.0889
 for(let z=0;z<21;z++){const zz=-1.85+z*.18,h=roofUnder(zz)-.105;for(const x of [-2.88,2.88])box(.15,h,.17,wood,x,.105+h/2,zz,shell)}
 for(const x of [-2.8,0,2.8])box(.09,2.65,.1,charred,x,1.43,1.96)
 box(5.6,2.5,.025,glass,0,1.4,1.96,shell);box(5.8,.1,.1,charred,0,2.73,1.96);box(.045,2.5,.06,charred,1.86,1.4,1.975,shell)
 for(let j=0;j<2;j++)box(5.9,.17,.05,wood,0,2.87+j*.17,1.97,shell)
 const roof=new T.Group();roof.position.set(-.25,3.04,.1);roof.rotation.x=-Math.atan(.0889);shell.add(roof)
 box(7.2,.16,5.5,metalRoof,0,0,0,roof);for(let i=0;i<15;i++)box(.035,.05,5.5,metalRoof,-3.5+i*.5,.1,0,roof)
 for(const s of [-1,1]){box(7.24,.3,.05,wood,0,-.05,s*2.77,roof);box(.05,.3,5.58,wood,s*3.62,-.05,0,roof)}
 box(7.1,.1,.14,steel,0,-.16,-2.85,roof);cyl(.04,.04,2.9,steel,3.25,1.45,-2.72,shell,8)
 for(const [z,y] of [[-1.15,.88],[-.45,.48]]){for(let j=0;j<5;j++)box(4.6,.09,.105,wood,-.35,y,z+j*.115);for(const x of [-2.25,1.55])box(.09,y,.48,charred,x,y/2,z+.23)}
 for(let j=0;j<3;j++)box(4.6,.105,.065,wood,-.35,1.18+j*.16,-1.81)
 box(4.45,.022,.025,led,-.35,.78,-1.35);box(.34,.1,.14,wood,-2.3,1.0,-1.3).rotation.x=-.4
 // Stove: steel body, glowing firebox facing the glass, open cage of sauna stones, flue through the roof.
 box(.54,.6,.48,steel,1.9,.43,.55);for(const [dx,dz] of [[-.22,-.18],[.22,-.18],[-.22,.18],[.22,.18]])box(.05,.1,.05,steel,1.9+dx,.08,.55+dz)
 box(.36,.26,.015,charred,1.9,.36,.79);box(.28,.18,.02,fire,1.9,.36,.8)
 for(const [dx,dz] of [[-.24,-.2],[.24,-.2],[-.24,.2],[.24,.2]])box(.025,.5,.025,steel,1.9+dx,.98,.55+dz)
 for(const s of [-1,1]){box(.5,.025,.025,steel,1.9,1.22,.55+s*.2);box(.025,.025,.42,steel,1.9+s*.24,1.22,.55)}
 for(let i=0;i<38;i++){const st=mesh(pebbleGeos[i%3],saunaStone,1.9+(rand()-.5)*.42,.8+rand()*.38,.55+(rand()-.5)*.34);st.scale.setScalar(.06+rand()*.04);st.rotation.set(rand()*3,rand()*3,rand()*3)}
 cyl(.075,.075,3.6,steel,1.9,2.55,.3,scene,12);mesh(new T.ConeGeometry(.2,.16,16),steel,1.9,4.5,.3);for(const a of [0,2.1,4.2])box(.015,.14,.015,steel,1.9+Math.cos(a)*.1,4.39,.3+Math.sin(a)*.1)
 cyl(.13,.2,.14,steel,1.9,roofUnder(.3)+.26,.3,shell)
 const glow=new T.PointLight(0xffaa48,14,7);glow.position.set(0,2,-1);scene.add(glow)
 const stoveLight=new T.PointLight(0xff7a2e,5,4,2);stoveLight.position.set(1.9,.5,1.15);scene.add(stoveLight)
 // Interior details: bucket and ladle, thermometer, slatted corner lamp, folded towels.
 cyl(.13,.1,.22,wood,1.25,.64,-.38);for(const y of [.58,.7])mesh(new T.TorusGeometry(.12,.008,6,24),steel,1.25,y,-.38).rotation.x=Math.PI/2
 mesh(new T.CircleGeometry(.11,20),bucketWater,1.25,.73,-.38).rotation.x=-Math.PI/2
 const ladle=cyl(.012,.012,.5,wood,1.36,.86,-.36,scene,6);ladle.rotation.z=-.45;mesh(new T.SphereGeometry(.05,10,6,0,Math.PI*2,Math.PI/2,Math.PI/2),wood,1.22,.72,-.37)
 const dial=cyl(.09,.09,.025,wood,-1.5,2.05,-1.905,shell,24);dial.rotation.x=Math.PI/2;const face=cyl(.072,.072,.03,linen,-1.5,2.05,-1.9,shell,24);face.rotation.x=Math.PI/2;box(.005,.06,.004,charred,-1.5,2.07,-1.884,shell)
 box(.12,.22,.12,lampGlow,-2.62,2.25,-1.74,shell);for(let i=0;i<5;i++)box(.025,.3,.02,wood,-2.7+i*.04,2.25,-1.66,shell)
 box(.55,.05,.38,towels[2],-1.5,.955,-1.15);box(.5,.05,.36,towels[0],.4,.955,-1.1)
 person('sit',-1.5,.525,-.95,0,{S:.4});person('sit',.4,.525,-.95,0,{S:.4,robe:robes[0]});person('stand',2.7,.08,3.6,Math.PI/2,{robe:robes[0]});person('bathe',4.5,0,2.7,-Math.PI/2,{W:.91});pools.push([.5,3.4,4,.1])
 // Cold plunge: individual staves, lining, hoops, water and two timber steps.
 const lining=std('#245855',{side:T.DoubleSide})
 mesh(new T.CylinderGeometry(.89,.82,.92,64,1,true),lining,4.5,.49,2.7);mesh(new T.CylinderGeometry(.84,.84,.05,48),lining,4.5,.08,2.7)
 for(let i=0;i<48;i++){const a=i/48*Math.PI*2;box(.119,1,.095,wood,4.5+Math.sin(a)*.94,.5,2.7+Math.cos(a)*.94).rotation.y=a}
 const tubWater=keep(mesh(new T.CircleGeometry(1,96),water,4.5,.91,2.7));tubWater.scale.setScalar(.889);tubWater.rotation.x=-Math.PI/2;tubWater.castShadow=false
 mesh(new T.TorusGeometry(.942,.064,10,96),wood,4.5,1,2.7).rotation.x=Math.PI/2
 for(const y of [.18,.76])mesh(new T.TorusGeometry(.95,.025,8,48),steel,4.5,y,2.7).rotation.x=Math.PI/2
 box(.25,.3,.7,wood,3.22,.15,2.7);box(.2,.6,.7,wood,3.45,.3,2.7)
 for(const x of [-1.8,.1]){box(.9,.12,1.65,wood,x,.38,3.3);for(const z of [2.65,3.9])box(.1,.34,.1,charred,x,.17,z)}
 for(let i=0;i<3;i++)box(.6,.16,2.1,wood,-.7+i*.72,.18,5.7)
 for(const z of [-1.91,1.91])box(5.8,.095,.1,wood,0,.22,z,shell)
 for(let i=0;i<37;i++){for(const z of [-1.8,4.4]){mesh(new T.CylinderGeometry(.012,.012,.004,6),charred,-3+i*.165,.083,z).castShadow=false}}
 // Firewood under the roof overhang, chopping block with an axe, towels, slippers and a planter.
 for(const x of [-3.42,-3.18])box(.08,.26,3.5,wood,x,-.07,-.1)
 const logGeo=new T.CylinderGeometry(1,1,1,10);logGeo.rotateZ(Math.PI/2)
 {const logs=new T.InstancedMesh(logGeo,[logBark,endgrain,endgrain],240);logs.castShadow=logs.receiveShadow=true;const d=new T.Object3D();let n=0
  for(let row=0;row<11;row++)for(let i=0;i<22&&n<240;i++){if(row>8&&rand()<.35)continue;const r=.055+rand()*.022;d.position.set(-3.3+(rand()-.5)*.05,.13+row*.135,-1.75+i*.155+(row%2)*.075);d.rotation.set(rand()*.5,0,(rand()-.5)*.04);d.scale.set(.42+rand()*.05,r,r);d.updateMatrix();logs.setMatrixAt(n++,d.matrix)}
  logs.count=n;scene.add(logs)}
 {const blockGeo=new T.CylinderGeometry(.25,.25,.46,18);blockGeo.rotateZ(Math.PI/2);const block=new T.Mesh(blockGeo,[logBark,endgrain,endgrain]);block.rotation.z=Math.PI/2;block.position.set(-4.25,.01,2.5);block.castShadow=block.receiveShadow=true;scene.add(block);const handle=cyl(.018,.022,.72,wood,-4.18,.52,2.62,scene,8);handle.rotation.set(.62,0,-.3);box(.03,.1,.16,steel,-4.24,.26,2.47).rotation.x=.62}
 // Changing room annex: bench, robes on hooks, a shower and a door open to the deck.
 box(1.65,.16,3.2,wood,3.78,0,-.4)
 for(let i=0;i<9;i++)box(.18,2.4,.14,wood,3.05+i*.18,1.28,-1.98,shell);for(let i=0;i<17;i++)box(.14,2.4,.17,wood,4.56,1.28,-1.88+i*.18,shell)
 for(const x of [3.05,3.23,4.19,4.37,4.5])box(.18,2.4,.14,wood,x,1.28,1.12,shell);box(.82,.3,.14,wood,3.7,2.33,1.12,shell)
 box(.8,2.05,.05,wood,4.1-.4*Math.cos(1.1),1.1,1.12+.4*Math.sin(1.1),shell).rotation.y=1.1;box(.03,.18,.03,chrome,3.8,1.05,1.76,shell)
 box(1.95,.14,3.5,metalRoof,3.78,2.55,-.4,shell);for(const s of [-1,1])box(1.99,.22,.05,wood,3.78,2.52,-.4+s*1.76,shell);box(.05,.22,3.5,wood,4.77,2.52,-.4,shell)
 box(.42,.06,2,wood,4.28,.46,-.55);for(const z of [-1.4,.3])box(.36,.4,.06,charred,4.28,.24,z)
 box(1.1,.06,.04,wood,3.75,1.72,-1.9,shell);for(const [x,m] of [[3.5,towels[2]],[4,towels[0]]])box(.38,.85,.06,m,x,1.26,-1.86,shell)
 cyl(.018,.018,2.05,chrome,3.2,1.12,-1.82,shell,8);box(.03,.03,.22,chrome,3.2,2.12,-1.72,shell);cyl(.09,.09,.02,chrome,3.2,2.1,-1.6,shell,16);for(let i=0;i<6;i++)box(.7,.02,.08,charred,3.3,.1,-1.9+i*.13)
 for(const [x,r] of [[1.12,.12],[1.3,.05],[1.55,-.08],[1.72,-.02]])box(.1,.04,.25,towels[r>0?3:1],x,.1,2.55).rotation.y=r
 box(.5,.45,.5,ceramic,-2.6,.3,4.15)
 // ——— Forest and meadow palettes are set here; vegetation itself is planted after the occupancy map below ———
 const tuftGeo=(()=>{const pos=[],uv=[],nor=[],idx=[];for(let b=0;b<3;b++){const a=rand()*Math.PI*2,lean=.15+rand()*.35,h=.6+rand()*.4,w=.04+rand()*.02,ox=(rand()-.5)*.12,oz=(rand()-.5)*.12,base=pos.length/3;for(let s=0;s<=3;s++){const t=s/3,bend=lean*t*t*h,cx=ox+Math.cos(a)*bend,cz=oz+Math.sin(a)*bend,y=h*t,px=-Math.sin(a)*w*(1-t),pz=Math.cos(a)*w*(1-t);pos.push(cx-px,y,cz-pz,cx+px,y,cz+pz);uv.push(0,t,1,t);nor.push(0,1,0,0,1,0);if(s<3){const i=base+s*2;idx.push(i,i+1,i+2,i+1,i+3,i+2)}}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);return g})()
 const tuftMat=(base,tip,from,sway,shrink)=>patch(std(base,{side:T.DoubleSide,roughness:.85}),{snow:false,head:'varying float vH;uniform vec3 uBaseC,uTipC;uniform float uTipFrom,uSway,uShrink;',uniforms:{uBaseC:col(base),uTipC:col(tip),uTipFrom:{value:from},uSway:{value:sway},uShrink:{value:shrink}},vertex:'vH=uv.y;transformed*=1.-uSnow*uShrink;',wind:GRASS_WIND,normal:UP_NORMAL,color:'diffuseColor.rgb=mix(mix(uBaseC,uTipC,smoothstep(uTipFrom,1.,vH)),vec3(.55,.48,.33),uSnow*.8)*mix(.45,1.1,vH)*vColor;'})
 const reedMat=tuftMat('#50682f','#b9a76a',.55,.12,.15),lavenderMat=tuftMat('#56663f','#9479c4',.45,.06,.6)
 function tufts(list,m,parent=scene){const im=new T.InstancedMesh(tuftGeo,m,list.length);const d=new T.Object3D();list.forEach(([x,y,z,s,sy=s],i)=>{d.position.set(x,y,z);d.rotation.set(0,rand()*6.28,0);d.scale.set(s,sy,s);d.updateMatrix();im.setMatrixAt(i,d.matrix);im.setColorAt(i,new T.Color().setScalar(.85+rand()*.3))});im.receiveShadow=true;parent.add(im);return im}
 tufts([...Array(9)].map((_,i)=>[-2.6+Math.cos(i*2.4)*.12,.52,4.15+Math.sin(i*2.4)*.12,.5+rand()*.25]),reedMat)

 // ——— Pavilions around the clearing ———
 function rotatedBuilding(cx,cz,angle,build){
  const before=new Set(scene.children);build();const group=new T.Group();group.position.set(cx,0,cz);scene.add(group);
  for(const child of [...scene.children])if(child!==group&&!before.has(child)){child.position.x-=cx;child.position.z-=cz;group.add(child);}
  group.rotation.y=angle;return group;
 }
 function greenRoof(w,d,x,y,z,parent){box(w,.2,d,charred,x,y,z,parent);box(w-.24,.08,d-.24,sedum,x,y+.13,z,parent);for(const s of [-1,1]){box(w+.06,.32,.06,wood,x,y+.08,z+s*(d/2+.03),parent);box(.06,.32,d,wood,x+s*(w/2+.03),y+.08,z,parent)}}
 let herbLight,ceremonyLight
 const herbalBuilding=rotatedBuilding(-24,-7,-Math.PI/5,()=>{
  const cover=new T.Group();scene.add(cover);roofs.push(cover);
  // L footprint: long wing and a perpendicular side wing, no dividing wall.
  box(8,.18,3.7,wood,-24,0,-8.5);box(3.3,.18,4.7,wood,-26.35,0,-4.3);piers(-27.8,-20.2,-10.1,-6.9,-.09);piers(-27.8,-24.9,-6.2,-2.2,-.09)
  herbLight=new T.PointLight(0xffb36b,0,8,2);herbLight.position.set(-24,2.2,-8.5);scene.add(herbLight)
  for(let i=0;i<44;i++)box(.17,2.8,.14,wood,-27.9+i*.18,1.5,-10.3,cover);
  for(let i=0;i<43;i++)box(.14,2.8,.17,wood,-28,1.5,-10.2+i*.18,cover);
  for(let i=0;i<20;i++)box(.14,2.8,.17,wood,-20,1.5,-10.2+i*.18,cover);
  box(4.7,2.7,.025,glass,-22.35,1.5,-6.65,cover);box(.025,2.7,4.5,glass,-24.7,1.5,-4.35,cover);box(3.3,2.7,.025,glass,-26.35,1.5,-2,cover);
  for(let i=0;i<=4;i++)box(.05,2.7,.06,charred,-24.7+i*1.175,1.5,-6.64,cover);for(let i=0;i<=3;i++)box(.06,2.7,.05,charred,-24.69,1.5,-6.6+i*1.5,cover);for(let i=0;i<=2;i++)box(.05,2.7,.06,charred,-28+i*1.65,1.5,-1.99,cover)
  greenRoof(8.3,3.9,-24,3,-8.5,cover);greenRoof(3.5,4.7,-26.35,3,-4.3,cover);
  const clumps=new T.InstancedMesh(shade(blob(1,.3,4)),foliage('#ffffff',.02),220),d=new T.Object3D(),tints=['#5d7a32','#6e4a2a','#7d8a3a','#46632a']
  for(let i=0;i<220;i++){const wing=i<150;d.position.set(wing?-28+rand()*7.9:-27.9+rand()*3.1,3.19,wing?-10.2+rand()*3.4:-6.4+rand()*4.2);d.scale.set(.07+rand()*.09,.03+rand()*.03,.07+rand()*.09);d.rotation.y=rand()*6;d.updateMatrix();clumps.setMatrixAt(i,d.matrix);clumps.setColorAt(i,new T.Color(tints[i%4]).multiplyScalar(.6+rand()*.3))}
  cover.add(clumps)
  for(let row=0;row<2;row++){
   box(6.8,.12,.6,wood,-24,.55+row*.4,-9.4+row*.7);
   box(.6,.12,6.5,wood,-27.1+row*.7,.55+row*.4,-6.3);
  }
  // Steam generator clad in stone with a copper bowl of herbs; dried bundles hang from the ceiling.
  box(.7,.8,.7,paving,-21.2,.5,-8.4);cyl(.26,.18,.12,copper,-21.2,.96,-8.4,scene,20);for(let i=0;i<5;i++)mesh(pebbleGeos[i%3],herbs[0],-21.2+(rand()-.5)*.25,1.02,-8.4+(rand()-.5)*.25).scale.setScalar(.07)
  for(let i=0;i<11;i++){const x=-27+i*.6;cyl(.004,.004,.36,charred,x,2.72,-7.25,cover,4);const b=mesh(new T.ConeGeometry(.075,.34,8),herbs[i%3],x,2.38,-7.25,cover);b.rotation.x=Math.PI}
  // Raised herb beds in the entrance courtyard.
  const beds=[];for(const [bx,bz,w,d2] of [[-25.6,-2.3,1.5,.4],[-22.4,-4.9,2.2,.7],[-22.4,-3.3,2.2,.7]]){box(w,.75,d2,wood,bx,.13,bz);box(w-.08,.04,d2-.08,soil,bx,.5,bz);for(let i=0;i<Math.round(w*d2*40);i++)beds.push([bx+(rand()-.5)*(w-.15),.5,bz+(rand()-.5)*(d2-.15),.28+rand()*.18])}
  tufts(beds,lavenderMat)
 });
 const ceremonyBuilding=rotatedBuilding(24,-9,Math.PI/3,()=>{
  const cover=new T.Group();scene.add(cover);roofs.push(cover);
  mesh(new T.CylinderGeometry(5.3,5.3,.22,80),wood,24,0,-9);cyl(5.45,5.55,.2,concrete,24,-.14,-9,scene,64);mesh(new T.RingGeometry(5.5,6.1,64),gravel,24,-.2,-9).rotation.x=-Math.PI/2
  // Sauna master's stool facing the benches, with a bucket and a birch whisk; guests on the first row.
  cyl(.2,.2,.05,wood,24,.5,-7.5,scene,20);for(let i=0;i<3;i++){const a=i*2.09;box(.04,.4,.04,charred,24+Math.sin(a)*.13,.3,-7.5+Math.cos(a)*.13)}
  cyl(.15,.12,.26,wood,24.55,.24,-7.3);mesh(new T.CircleGeometry(.13,16),bucketWater,24.55,.36,-7.3).rotation.x=-Math.PI/2;mesh(new T.ConeGeometry(.12,.45,10),herbs[0],23.5,.2,-7.35).rotation.z=Math.PI/2+.2
  person('sit',24,.11,-7.5,Math.PI,{S:.44,robe:robes[0]});for(const a of [2.55,3.3,4.05])person('sit',24+Math.sin(a)*2.75,.11,-9+Math.cos(a)*2.75,a+Math.PI,{S:.45})
  // Front opening is left clear; rear wall follows the circular plan.
  for(let i=0;i<100;i++){const a=.5+i/99*(Math.PI*2-1);const x=24+Math.sin(a)*5,z=-9+Math.cos(a)*5;const board=box(.27,3.7,.15,wood,x,1.95,z,cover);board.rotation.y=a;}
  // Stepped shingle courses on a steeper cone, soffit, rafter tails and a vented crown.
  const prof=[];for(let k=0;k<10;k++){const r0=5.85-k*.54;prof.push(new T.Vector2(r0+.05,k*.25-.03),new T.Vector2(r0-.54,k*.25+.25))}prof.push(new T.Vector2(.001,2.62))
  mesh(new T.LatheGeometry(prof,72),shingle,24,3.78,-9,cover)
  const soffit=mesh(new T.RingGeometry(4.95,5.85,64),wood,24,3.76,-9,cover);soffit.rotation.x=Math.PI/2
  for(let i=0;i<24;i++){const a=i/24*Math.PI*2;box(.1,.14,.8,wood,24+Math.sin(a)*5.3,3.7,-9+Math.cos(a)*5.3,cover).rotation.y=a}
  cyl(.3,.34,.3,steel,24,6.45,-9,cover,20);mesh(new T.ConeGeometry(.62,.3,24),steel,24,6.98,-9,cover);for(let i=0;i<4;i++){const a=i*Math.PI/2;box(.025,.3,.025,steel,24+Math.sin(a)*.27,6.72,-9+Math.cos(a)*.27,cover)}
  for(const s of [-1,1]){const a=s*.55;box(.2,3.7,.2,charred,24+Math.sin(a)*5.05,1.95,-9+Math.cos(a)*5.05,cover)}
  box(5.2,.24,.24,charred,24,3.72,-9+Math.cos(.55)*5.05,cover)
  for(let row=0;row<3;row++){
   const radius=2.6+row*.78;
   for(let i=0;i<43;i++){const a=.42+i/42*(Math.PI*2-.84);const seat=box(.56,.12,.64,wood,24+Math.sin(a)*radius,.5+row*.42,-9+Math.cos(a)*radius);seat.rotation.y=a;}
  }
  cyl(.78,.9,.9,paving,24,.56,-9,scene,24);cyl(.82,.82,.06,steel,24,1.03,-9,scene,24);box(.34,.2,.03,fire,24,.42,-9+.9)
  for(let i=0;i<26;i++){const st=mesh(pebbleGeos[i%3],saunaStone,24+Math.cos(i*2.4)*.55*Math.sqrt(rand()),1.12+rand()*.2,-9+Math.sin(i*2.4)*.55*Math.sqrt(rand()));st.scale.setScalar(.1+rand()*.06)}
  cyl(.09,.09,2.7,steel,24,2.45,-9,scene,12);cyl(.09,.09,3.2,steel,24,5.4,-9,cover,12)
  // Salt wall: three courses of individually lit blocks behind the upper bench.
  for(let row=0;row<3;row++)for(let i=0;i<24;i++){const a=1.5+(i+(row%2)*.5)/24*3.2;const tile=box(.36,.25,.1,salt,24+Math.sin(a)*4.86,2.12+row*.28,-9+Math.cos(a)*4.86,cover);tile.rotation.y=a}
  ceremonyLight=new T.PointLight(0xff8a45,10,9,2);ceremonyLight.position.set(24,1.4,-9);scene.add(ceremonyLight)
  for(const s of [-1,1]){const a=s*.62,x=24+Math.sin(a)*5.3,z=-9+Math.cos(a)*5.3;box(.16,.24,.16,charred,x,2.25,z,cover);box(.1,.16,.1,lampGlow,x,2.25,z,cover)}
 });
 herbalBuilding.position.set(-34,0,2);herbalBuilding.rotation.y=-Math.PI*.32;
 ceremonyBuilding.position.set(18,0,-39);ceremonyBuilding.rotation.y=Math.PI*.73;
 scene.updateMatrixWorld(true);for(const s of [-1,1]){const a=s*.62,q=ceremonyBuilding.localToWorld(new T.Vector3(Math.sin(a)*5.6,0,Math.cos(a)*5.6));pools.push([q.x,q.z,2.6])}{const q=herbalBuilding.localToWorld(new T.Vector3(1,0,3));pools.push([q.x,q.z,4])}
 // ——— Forest stream feeding a pond; the forest trail crosses its outflow on a footbridge ———
 const pond={x:-28.6,z:-20.6,rx:4.4,rz:3.1},wobble=a=>1+.07*Math.sin(3*a)+.05*Math.sin(5*a+1),toCurve=pts=>new T.CatmullRomCurve3(pts.map(([x,z])=>new T.Vector3(x,0,z)))
 const inlet=toCurve([[-64,-37],[-55,-31],[-46,-27],[-38,-24],[-32.8,-21.8]]),outlet=toCurve([[-25.4,-23],[-25,-28.5],[-24.2,-34],[-22.8,-42],[-21.2,-52],[-20,-64]])
 const streamPts=[...inlet.getSpacedPoints(90),...outlet.getSpacedPoints(110)],streamDist=(x,z)=>{let m=1e9;for(const q of streamPts)m=Math.min(m,Math.hypot(q.x-x,q.z-z));return m}
 function channel(curve,n){const prof=[[-1.5,-.03],[-1.05,-.2],[-.5,-.36],[0,-.4],[.5,-.36],[1.05,-.2],[1.5,-.03]],pos=[],idx=[],wpos=[],wuv=[],wnor=[],widx=[],pts=curve.getSpacedPoints(n);let along=0
  pts.forEach((q,i)=>{const t=curve.getTangentAt(i/n),nx=-t.z,nz=t.x,g=groundY(q.x,q.z);if(i)along+=q.distanceTo(pts[i-1])
   for(const [o,dy] of prof)pos.push(q.x+nx*o,g+dy,q.z+nz*o)
   for(const o of [-.92,.92]){wpos.push(q.x+nx*o,g-.28,q.z+nz*o);wnor.push(0,1,0)}wuv.push(0,along,1,along)
   if(i){const a=(i-1)*7,b=i*7;for(let k=0;k<6;k++)idx.push(a+k,a+k+1,b+k,a+k+1,b+k+1,b+k);const c=(i-1)*2,e=i*2;widx.push(c,c+1,e,c+1,e+1,e)}})
  const bed=new T.BufferGeometry();bed.setAttribute('position',new T.Float32BufferAttribute(pos,3));bed.setIndex(idx);bed.computeVertexNormals();mesh(bed,mud,0,0,0)
  const wg=new T.BufferGeometry();wg.setAttribute('position',new T.Float32BufferAttribute(wpos,3));wg.setAttribute('normal',new T.Float32BufferAttribute(wnor,3));wg.setAttribute('uv',new T.Float32BufferAttribute(wuv,2));wg.setIndex(widx);keep(mesh(wg,streamWater,0,0,0)).castShadow=false
  for(let i=4;i<pts.length-2;i+=3)if(rand()<.7){const q=pts[i],t=curve.getTangentAt(i/n),sd=rand()<.5?-1:1;rockAt(q.x-t.z*sd*(1.1+rand()*.4),groundY(q.x,q.z)-.12,q.z+t.x*sd*(1.1+rand()*.4),.18+rand()*.25)}}
 channel(inlet,90);channel(outlet,110)
 {const rings=[[0,-.62],[.35,-.6],[.65,-.5],[.85,-.34],[1,-.14],[1.12,-.03]],seg=64,pos=[],idx=[]
  rings.forEach(([r,dy])=>{for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2,w=wobble(a);pos.push(pond.x+Math.cos(a)*pond.rx*r*w,-.225+dy,pond.z+Math.sin(a)*pond.rz*r*w)}})
  for(let k=0;k<rings.length-1;k++)for(let i=0;i<seg;i++){const a=k*(seg+1)+i,b=a+seg+1;idx.push(a,a+1,b,a+1,b+1,b)}
  const bowl=new T.BufferGeometry();bowl.setAttribute('position',new T.Float32BufferAttribute(pos,3));bowl.setIndex(idx);bowl.computeVertexNormals();mesh(bowl,mud,0,0,0)
  const pondWater=patch(std('#123f3f',{roughness:.05,metalness:0,envMapIntensity:1.2}),{head:'uniform vec3 uWDeep,uWShallow;',uniforms:{uWDeep:col('#0b1f1b'),uWShallow:col('#27402f')},color:WATER_COLOR,normal:WATER_NORMAL,snow:false})
  const surface=keep(mesh(new T.CircleGeometry(1,64),pondWater,pond.x,-.505,pond.z));surface.rotation.x=-Math.PI/2;surface.scale.set(pond.rx*.95,pond.rz*.95,1);surface.castShadow=false
  const lily=new T.InstancedMesh(new T.CircleGeometry(.24,12,.3,5.8).rotateX(-Math.PI/2),plant,9),ld=new T.Object3D();for(let i=0;i<9;i++){const a=rand()*6.28,r=.3+rand()*.5;ld.position.set(pond.x+Math.cos(a)*pond.rx*r,-.495,pond.z+Math.sin(a)*pond.rz*r);ld.rotation.y=rand()*6;ld.scale.setScalar(.7+rand()*.6);ld.updateMatrix();lily.setMatrixAt(i,ld.matrix)}lily.receiveShadow=true;scene.add(lily);summerOnly.push(lily)
  const reeds=[];for(let i=0;i<90;i++){const a=rand()*6.28,r=1.02+rand()*.25,w=wobble(a);if(Math.abs(a-3.8)<.5)continue;reeds.push([pond.x+Math.cos(a)*pond.rx*r*w,-.3,pond.z+Math.sin(a)*pond.rz*r*w,.5+rand()*.5,1+rand()*.9])}tufts(reeds,reedMat)}
 // The ground is cut away where the stream and pond sit below it.
 let holeTexture
 {const c=document.createElement('canvas');c.width=c.height=1024;const g=c.getContext('2d'),sc=1024/(2*MASK.R),px=(x,z)=>[(x-MASK.cx+MASK.R)*sc,(MASK.cz+MASK.R-z)*sc];g.fillStyle='#000';g.fillRect(0,0,1024,1024);g.strokeStyle=g.fillStyle='#fff';g.lineCap=g.lineJoin='round';g.lineWidth=2.6*sc
  for(const cv of [inlet,outlet]){g.beginPath();cv.getSpacedPoints(160).forEach((q,i)=>g[i?'lineTo':'moveTo'](...px(q.x,q.z)));g.stroke()}
  g.beginPath();for(let i=0;i<=72;i++){const a=i/72*Math.PI*2,w=wobble(a)*1.02;g[i?'lineTo':'moveTo'](...px(pond.x+Math.cos(a)*pond.rx*w,pond.z+Math.sin(a)*pond.rz*w))}g.fill()
  holeTexture=new T.CanvasTexture(c);holeTexture.flipY=false;groundU.uHole.value=holeTexture}

 const pathSegs=[];let pathId=0
 function path(points,width=1.35,{skip}={}){const id=pathId++;for(let i=1;i<points.length;i++){const [x,z]=points[i-1],[nx,nz]=points[i];if(skip&&skip((x+nx)/2,(z+nz)/2))continue;const length=Math.hypot(nx-x,nz-z);const strip=box(width,.06,length,gravel,(x+nx)/2,-.15,(z+nz)/2);strip.rotation.y=Math.atan2(nx-x,nz-z);mesh(new T.CylinderGeometry(width/2,width/2,.06,24),gravel,x,-.15,z);pathSegs.push([x,z,nx,nz,width,id])}}
 // Smooth paths skirt the gardens, with comfortable open lawns between buildings.
 function curved(points,width=1.65,opts){const curve=toCurve(points),pts=curve.getPoints(70).map(v=>[v.x,v.z]);path(pts,width,opts);return pts}
 const entryPath=curved([[0,73],[0,40],[0,20],[0,8],[0,5]],2.4);
 const westPath=curved([[0,8],[-11,12],[-25,13],[-38,8],[-39.5,2.7]]);
 const eastPath=curved([[0,8],[16,4],[32,-12],[30,-29],[21.75,-42.3]]);
 const innerPath=curved([[-25,13],[-22,-6],[-14,-18],[0,-22.5]],2);
 const southPath=curved([[30,-29],[26,-26],[14,-22],[0,-22.5]],2);
 curved([[0,20],[-7,21],[-12,25],[-19,28]],2);
 curved([[-19,28],[-24,31],[-31,29]],2);
 path([[0,5],[4.5,5],[4.5,3.7]],1);
 curved([[0,20],[6,20],[9,18]],1.5);
 curved([[6,20],[10,23],[12,24]],1.5);
 // Forest trail from the lounge past the pond, over the outflow on a small arched footbridge.
 const trail=curved([[-6,-24.5],[-13,-28.5],[-20,-31],[-28,-30.5],[-33.5,-27.5]],1.4,{skip:(x,z)=>streamDist(x,z)<2.1})
 {let best=null;for(let i=1;i<trail.length;i++){const [x,z]=trail[i],dd=streamDist(x,z);if(!best||dd<best.d)best={d:dd,x,z,dx:x-trail[i-1][0],dz:z-trail[i-1][1]}}
  const g=new T.Group();g.position.set(best.x,0,best.z);g.rotation.y=Math.atan2(best.dx,best.dz);scene.add(g)
  const arch=z=>.04+.16*Math.cos(z/2.5*Math.PI/2)
  for(let i=0;i<25;i++){const z=-2.4+i*.2;box(1.7,.06,.17,wood,0,arch(z),z,g)}
  for(const x of [-.75,.75]){box(.12,.18,4.9,wood,x,-.06,0,g);for(const z of [-2.2,-.75,.75,2.2])box(.09,1,.09,wood,x*1.08,arch(z)+.5,z,g);box(.07,.07,4.6,wood,x*1.08,1.1,0,g);box(.05,.05,4.6,wood,x*1.08,.62,0,g)}
  for(const z of [-2.55,2.55])box(2.1,.35,.5,concrete,0,-.15,z,g)}
 // Boardwalk out to a small platform over the pond, with a bench and a lamp.
 {const a=[-33.5,-27.5],b=[-31.1,-23.2],len=Math.hypot(b[0]-a[0],b[1]-a[1]),g=new T.Group();g.position.set((a[0]+b[0])/2,0,(a[1]+b[1])/2);g.rotation.y=Math.atan2(b[0]-a[0],b[1]-a[1]);scene.add(g)
  for(let i=0;i<Math.round(len/.18);i++)box(1.2,.05,.15,wood,0,.08,-len/2+.09+i*.18,g);for(const x of [-.5,.5]){box(.08,.12,len,wood,x,0,0,g);for(let z=-len/2+.3;z<len/2;z+=1.2)box(.1,.5,.1,wood,x,-.2,z,g)}
  const pl=new T.Group();pl.position.set(0,0,len/2+1.1);g.add(pl)
  for(let i=0;i<12;i++)box(2.6,.05,.17,wood,0,.08,-1.05+i*.19,pl);for(const x of [-1.2,1.2])for(const z of [-1,0,1])box(.12,.7,.12,wood,x,-.28,z,pl)
  box(1.6,.07,.38,wood,0,.5,-.85,pl);for(const x of [-.65,.65])box(.07,.42,.34,charred,x,.27,-.85,pl);box(.1,1.2,.1,wood,1.15,.65,-.95,pl);box(.18,.24,.18,charred,1.15,1.35,-.95,pl);box(.12,.16,.12,lampGlow,1.15,1.35,-.95,pl)
  g.updateMatrixWorld(true);const seat=pl.localToWorld(new T.Vector3(-.35,.105,-.85)),lamp=pl.localToWorld(new T.Vector3(1.15,0,-.95));person('sit',seat.x,seat.y,seat.z,g.rotation.y,{S:.4});pools.push([lamp.x,lamp.z,2.6,.12])}
 // Outdoor rinse court, fire circle and a small tea station.
 box(4,.3,3,paving,9,-.09,17);for(let i=0;i<9;i++)box(1.3,.03,.1,wood,9,.075,16.4+i*.14)
 for(const x of [8,10]){mesh(new T.CylinderGeometry(.04,.04,2.4,12),chrome,x,1.2,16.5);box(.06,.06,.65,chrome,x,2.4,16.8);mesh(new T.CylinderGeometry(.18,.18,.035,20),chrome,x,2.38,17.1);}
 for(let i=0;i<20;i++)box(.12,2,.08,wood,6.9+i*.22,1,15.5);
 box(1.6,.08,.42,wood,9.6,.45,18.2);for(const x of [8.95,10.25])box(.08,.42,.36,charred,x,.21,18.2)
 mesh(new T.CylinderGeometry(3.4,3.4,.16,48),paving,12,-.155,27);
 for(let i=0;i<5;i++){const a=i/5*Math.PI*2;const seat=box(1.7,.2,.6,wood,12+Math.sin(a)*2.4,.45,27+Math.cos(a)*2.4);seat.rotation.y=a;for(const s of [-.6,.6])box(.12,.58,.4,charred,12+Math.sin(a)*2.4+Math.cos(a)*s,.06,27+Math.cos(a)*2.4-Math.sin(a)*s).rotation.y=a}
 for(const i of [1,3]){const a=i/5*Math.PI*2;person('sit',12+Math.sin(a)*2.55,-.225,27+Math.cos(a)*2.55,a+Math.PI,{S:.77})}
 cyl(.5,.55,.3,paving,12,.1,27,scene,24);cyl(.78,.45,.34,corten,12,.42,27,scene,32);mesh(new T.CircleGeometry(.66,24),fire,12,.5,27).rotation.x=-Math.PI/2
 for(let i=0;i<4;i++){const l=cyl(.06,.06,.8,charred,12,.58,27,scene,8);l.rotation.set(Math.PI/2,i*.8,.3)}
 box(2.5,1.07,.8,wood,-8,.31,-20);box(2.7,.08,1,paving,-8,.88,-20);
 for(const x of [-8.7,-7.4])mesh(new T.CylinderGeometry(.16,.18,.4,16),chrome,x,1.12,-20);
 for(let i=0;i<6;i++)cyl(.035,.03,.08,towels[2],-8.1+i*.12,.96,-19.75,scene,10)
 person('stand',-8.3,-.225,-19.2,Math.PI);person('stand',8,.06,16.95,0);person('walk',.7,-.12,12,Math.PI);person('walk',-17,-.12,12.9,-Math.PI/2+.1,{robe:robes[2]});person('walk',31.5,-.12,-18,Math.PI+.1)
 // Open woodsheds near the ceremonial sauna and the fire circle.
 function woodShed(x,z,ry){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=ry;scene.add(g)
  box(2.7,.14,1.3,concrete,0,-.16,0,g);for(const [px,pz,h] of [[-1.25,-.55,2.05],[1.25,-.55,2.05],[-1.25,.55,2.3],[1.25,.55,2.3]])box(.1,h,.1,wood,px,h/2-.09,pz,g)
  box(3,.07,1.7,metalRoof,0,2.13,0,g).rotation.x=-.16;for(let i=0;i<14;i++)box(.17,1.95,.03,wood,-1.2+i*.185,.9,-.62,g)
  const logs=new T.InstancedMesh(logGeo,[logBark,endgrain,endgrain],170),ld=new T.Object3D();let n=0
  for(let row=0;row<12;row++)for(let i=0;i<14&&n<170;i++){if(row>9&&rand()<.4)continue;const r=.055+rand()*.02;ld.position.set(-1.12+i*.165+(row%2)*.08,.02+row*.13,-.05+(rand()-.5)*.04);ld.rotation.set(rand()*.5,Math.PI/2,0,'ZYX');ld.scale.set(.4+rand()*.05,r,r);ld.updateMatrix();logs.setMatrixAt(n++,ld.matrix)}
  logs.count=n;logs.castShadow=logs.receiveShadow=true;g.add(logs)}
 woodShed(7.4,-43.5,Math.PI/2);woodShed(16.9,31.3,-2.29)
 // Lounges: loungers with rolled towels, side tables, potted plants, pendant lamps.
 function lounger(x,z,k){box(1.05,.18,2.2,wood,x,.35,z);box(.95,.13,1.65,linen,x,.51,z+.13);const back=box(.95,.14,.78,linen,x,.74,z-.86);back.rotation.x=.48;for(const dz of [-.85,.85])box(.08,.3,.08,charred,x,.15,z+dz);cyl(.075,.075,.78,towels[k%3],x,.65,z+.72,scene,12).rotation.z=Math.PI/2}
 function potPlant(x,z,s=1){cyl(.26*s,.2*s,.5*s,ceramic,x,.25*s,z,scene,18);const p=mesh(rockGeos[Math.floor(rand()*6)],plant,x,.72*s,z);p.scale.set(.42*s,.5*s,.42*s)}
 function lounge(cx,cz,cols,rows,enclosed){
  const w=cols*1.65+2,d=rows*3+2,roof=new T.Group();scene.add(roof);roofs.push(roof);
  box(w,.2,d+2,wood,cx,.01,cz+1);piers(cx-w/2+.3,cx+w/2-.3,cz-d/2+.2,cz+d/2+1.8,-.09)
  for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){lounger(cx+(i-(cols-1)/2)*1.65,cz+(j-(rows-1)/2)*3,i+j);if(i<cols-1&&(i+j)%2===0){const tx=cx+(i-(cols-1)/2)*1.65+.82,tz=cz+(j-(rows-1)/2)*3-.3;cyl(.19,.19,.03,wood,tx,.5,tz,scene,20);cyl(.025,.025,.48,charred,tx,.25,tz,scene,6);cyl(.04,.035,.08,towels[2],tx+.06,.555,tz,scene,10)}}
  for(const dx of [-w/2+.3,w/2-.3])for(const dz of [-d/2+.3,0,d/2+.3])box(.16,3.5,.16,wood,cx+dx,1.75,cz+dz);
  for(const [dx,dz] of [[-w/2+.7,d/2+1.4],[w/2-.7,d/2+1.4]])potPlant(cx+dx,cz+dz,1.1)
  if(enclosed){box(w,.2,d+2,charred,cx,3.6,cz+.5,roof);box(w-.3,.08,d+1.7,sedum,cx,3.73,cz+.5,roof);for(const s of [-1,1]){box(w+.1,.34,.08,wood,cx,3.68,cz+.5+s*(d/2+1.04),roof);box(.08,.34,d+2.1,wood,cx+s*(w/2+.04),3.68,cz+.5,roof)}
   box(w,3.2,.025,glass,cx,1.7,cz-d/2,roof);for(const dx of [-w/2,w/2])box(.025,3.2,d,glass,cx+dx,1.7,cz,roof);
   const n=Math.round(w/1.6);for(let i=0;i<=n;i++)box(.05,3.2,.06,charred,cx-w/2+i*w/n,1.7,cz-d/2,roof);for(const dx of [-w/2,w/2])for(let i=1;i<7;i++)box(.06,3.2,.05,charred,cx+dx,1.7,cz-d/2+i*d/7,roof)
   for(let i=0;i<cols;i+=2)for(let j=0;j<rows;j++){const lx=cx+(i-(cols-1)/2+.5)*1.65,lz=cz+(j-(rows-1)/2)*3;cyl(.006,.006,.7,charred,lx,3.15,lz,roof,4);mesh(new T.CylinderGeometry(.09,.2,.2,20,1,true),lampShade,lx,2.72,lz,roof);mesh(new T.SphereGeometry(.06,10,8),lampGlow,lx,2.66,lz,roof)}}
  else{for(let i=0;i<=18;i++)box(.12,.19,d+1,wood,cx-w/2+i*w/18,3.5,cz,roof);for(const dz of [-d/2,d/2])box(w,.2,.18,charred,cx,3.3,cz+dz,roof);
   // Climbing vines over the pergola beams and down the posts.
   const vines=new T.InstancedMesh(shade(blob(1,.35,7)),foliage('#ffffff',.05),200),v=new T.Object3D()
   for(let i=0;i<200;i++){const post=i>=110,k=i%6,beam=Math.floor(rand()*19),px=post?cx+(k<3?-w/2+.3:w/2-.3):cx-w/2+beam*w/18+(rand()-.5)*.25,pz=post?cz+[-d/2+.3,0,d/2+.3][k%3]+(rand()-.5)*.3:cz+(rand()-.5)*(d+1)*(beam%3?.45:1);v.position.set(px+(post?(rand()-.5)*.3:0),post?.4+rand()*3.1:3.6+rand()*.1,pz);const s=post?.13+rand()*.1:.16+rand()*.18;v.scale.set(s,s*.6,s);v.rotation.y=rand()*6;v.updateMatrix();vines.setMatrixAt(i,v.matrix);vines.setColorAt(i,new T.Color('#4d6b30').multiplyScalar(.75+rand()*.5))}
   vines.castShadow=true;roof.add(vines);summerOnly.push(vines)
   const bulbs=new T.InstancedMesh(new T.SphereGeometry(.04,8,6),lampGlow,60),bd=new T.Object3D();let bi=0;for(const lz of [-3,0,3])for(let i=0;i<20;i++){const t=i/19;bd.position.set(cx-w/2+.35+t*(w-.7),3.32-.28*Math.sin(Math.PI*t),cz+lz);bd.updateMatrix();bulbs.setMatrixAt(bi++,bd.matrix)}roof.add(bulbs)}
  box(w-.6,.035,.04,led,cx,3.35,cz-d/2+.1,roof);
 }
 lounge(0,-29,6,3,true);lounge(-31,24,4,3,false);
 person('lie',-2.475,0,-32,0);person('lie',2.475,0,-26,0,{robe:robes[1]});person('lie',-33.475,0,24,0,{robe:robes[0]})
 const loungeLight=new T.PointLight(0xffc98a,0,14,2),pergolaLight=new T.PointLight(0xffc27a,0,10,2),fireLight=new T.PointLight(0xff7a30,1.5,9,2);loungeLight.position.set(0,2.7,-29);pergolaLight.position.set(-31,3,24);fireLight.position.set(12,1.1,27);scene.add(loungeLight,pergolaLight,fireLight)
 pools.push([0,-21.8,5,.13],[-31,24,5.5,.13],[12,27,5,-.06])
 // Raised stone basin: the water reads deeper toward the centre, reeds and boulders on the far side.
 const poolX=-19,poolZ=20;
 const poolWall=mesh(new T.CylinderGeometry(1,1,.65,96),paving,poolX,.05,poolZ);poolWall.scale.set(6,1,4.3);
 const poolSurface=keep(mesh(new T.CircleGeometry(1,128),water,poolX,.4,poolZ));poolSurface.rotation.x=-Math.PI/2;poolSurface.scale.set(5.55,3.85,1);poolSurface.castShadow=false;
 for(let i=0;i<56;i++){const a=i/56*Math.PI*2;const block=box(.62,.2,.54,coping,poolX+5.82*Math.cos(a),.45,poolZ+4.08*Math.sin(a));block.rotation.y=-a;}
 for(let i=0;i<17;i++){const a=Math.PI*.07+i/17*Math.PI*.88;rockAt(poolX+6.5*Math.cos(a),.2,poolZ-5*Math.sin(a),.5+(i%3)*.18)}
 for(let i=0;i<3;i++)box(2.1,.16,.6,coping,poolX,.08+i*.12,poolZ+5.5-i*.5);
 const iceSheet=keep(mesh(new T.CircleGeometry(1,96),ice,poolX,.42,poolZ));iceSheet.rotation.x=-Math.PI/2;iceSheet.scale.set(5.62,3.9,1);iceSheet.castShadow=false;winterOnly.push(iceSheet)
 person('bathe',poolX+1.39,0,poolZ+2.12,Math.PI*.8,{W:.4})
 for(const [x,z] of [[-26.2,27.4],[-24.8,27.1],[-23.3,26.8],[-21.8,26.4],[-20.4,26.1]]){const st=mesh(rockGeos[Math.floor(rand()*6)],paving,x,-.2,z);st.scale.set(.42,.1,.34);st.rotation.y=rand()*3}
 {const reeds=[];for(let i=0;i<70;i++){const a=Math.PI*.12+rand()*Math.PI*.76,rr=6.9+rand()*1.4;reeds.push([poolX+rr*Math.cos(a),-.2,poolZ-rr*.78*Math.sin(a),.6+rand()*.5,1.1+rand()*.7])}tufts(reeds,reedMat)}
 // Rocks along the clearing edge, half sunk into the ground.
 for(let i=0;i<70;i++){const x=(rand()-.5)*36,z=(rand()-.5)*36;if(Math.abs(x)<19&&Math.abs(z)<22)continue;rockAt(x,-.1,z,.2+rand()*.45)}
 for(let i=0;i<34;i++){const a=rand()*Math.PI*2,r=49+rand()*9;rockAt(Math.cos(a)*r,-.2,Math.sin(a)*r,.5+rand()*.9)}
 for(const x of [-1.5,1.5])for(const z of [11,17,23]){box(.1,.7,.1,charred,x,.2,z);box(.16,.08,.16,led,x,.58,z);pools.push([x,z,2.4])}
 // Signs: painted boards on posts, or mounted on the building.
 const labels=[];
 function sign(text,x,z,{y=2.35,w=3.1,h=.58,posts=true,parent=scene}={}){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=Math.round(1024*h/w);const ctx=canvas.getContext('2d'),H=canvas.height;ctx.fillStyle='#1c392f';ctx.fillRect(0,0,1024,H);ctx.strokeStyle='#b9a676';ctx.lineWidth=3;ctx.strokeRect(12,12,1000,H-24);ctx.fillStyle='#efe6cc';ctx.font=`${Math.round(H*.4)}px Georgia, serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.letterSpacing='6px';ctx.fillText(text,512,H/2+2);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;labels.push(texture);const label=keep(mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}),x,y,z,parent));label.castShadow=false;box(w+.08,h+.08,.04,charred,x,y,z-.03,parent);if(posts)for(const s of [-1,1])box(.09,y+h/2+.1,.09,wood,x+s*(w/2-.2),(y+h/2+.1)/2-.1,z-.08)}
 sign('FINSKÁ',0,2.02,{y:2.95,w:1.9,h:.3,posts:false,parent:shell});sign('HERBAL · L',-39,4);sign('CEREMONIÁLNÍ',22,-42);sign('ODPOČÍVÁRNA · 18 MÍST',0,-21.9,{y:1.3});sign('U VODY · 12 MÍST',-31,30,{y:1.3});
 sign('VSTUP / ODCHOD',0,20,{posts:false});for(const x of [-1.4,1.4])box(.08,2.6,.08,wood,x,1.15,20);
 // A separate clinical campus, beyond the retreat and its forest edge.
 const clinic=new T.Group();scene.add(clinic);clinic.position.set(101,0,-70);clinic.rotation.y=-.22;
 box(34,.3,22,paving,0,0,2,clinic);box(34.4,.2,22.4,concrete,0,-.2,2,clinic);
 box(24,6,9,clinicStone,0,3,-3,clinic);box(9,4,13,clinicStone,-10,2,6,clinic);
 box(25,.35,10,charred,0,6.2,-3,clinic);for(const s of [-1,1]){box(25,.5,.2,clinicStone,0,6.6,-3+s*4.9,clinic);box(.2,.5,10,clinicStone,s*12.4,6.6,-3,clinic)}
 greenRoof(10,14,-10,4.1,6,clinic)
 for(let r=0;r<3;r++)for(let i=0;i<6;i++){box(1.6,.05,1,panel,-6+i*2.2,6.75,-6+r*2.3,clinic).rotation.x=-.45}
 box(3,1.2,2,paving,8,7,-4,clinic)
 for(let floor=0;floor<2;floor++)for(let i=0;i<10;i++)box(1.85,2,.08,clinicGlass,-10.7+i*2.35,1.5+floor*2.8,1.55,clinic);
 for(let i=0;i<11;i++)box(.14,5.6,.5,wood,-11.87+i*2.35,2.9,1.75,clinic);box(24,.3,.4,clinicStone,0,2.95,1.7,clinic)
 box(7,3.8,.08,clinicGlass,2,1.9,2,clinic);for(let i=0;i<=4;i++)box(.06,3.8,.1,charred,-1.5+i*1.75,1.9,2.03,clinic);box(11,.2,5,wood,2,4,4,clinic);
 for(const x of [-2.8,6.8])box(.16,4,.16,charred,x,2,5.8,clinic);
 for(let i=0;i<8;i++)box(.12,3.8,.13,wood,-13+i*.9,2,12.6,clinic);
 const reflecting=keep(mesh(new T.CircleGeometry(1,64),water,10,.19,9,clinic));reflecting.rotation.x=-Math.PI/2;reflecting.scale.set(3.4,2,1);reflecting.castShadow=false;box(7.1,.14,4.3,coping,10,.1,9,clinic)
 for(const [x,z] of [[-3.5,8],[0,8.5],[15.5,4]])box(1.8,.1,.5,wood,x,.45,z,clinic)
 const clinicPath=curved([[30,-29],[45,-31],[67,-43],[83,-52],[101,-59]],2.6);
 person('walk',98.5,-.12,-57.9,2.45);scene.updateMatrixWorld(true);{const q=clinic.localToWorld(new T.Vector3(2,0,6.5));pools.push([q.x,q.z,5,.17])}
 // Low stone edging on both sides of every path, left out where paths meet.
 const nearPath=(x,z,id,m)=>pathSegs.some(([ax,az,bx,bz,w,j])=>j!==id&&segDist(x,z,ax,az,bx,bz)<w/2+m)
 for(const [x,z,nx,nz,w,id] of pathSegs){const len=Math.hypot(nx-x,nz-z),ux=(nx-x)/len,uz=(nz-z)/len;for(const sd of [-1,1]){const mx=(x+nx)/2-uz*sd*(w/2+.05),mz=(z+nz)/2+ux*sd*(w/2+.05);if(!nearPath(mx,mz,id,.12))box(.09,.1,len+.04,coping,mx,-.14,mz).rotation.y=Math.atan2(nx-x,nz-z)}}
 // Path lights every few metres, alternating sides.
 function bollard(x,z){box(.1,.7,.1,charred,x,.13,z);box(.16,.08,.16,led,x,.5,z);pools.push([x,z,2.2])}
 function lightsAlong(pts,w,every){let acc=0,next=4,n=0;const total=pts.reduce((t,q,i)=>i?t+Math.hypot(q[0]-pts[i-1][0],q[1]-pts[i-1][1]):0,0);for(let i=1;i<pts.length;i++){const [x0,z0]=pts[i-1],[x1,z1]=pts[i],l=Math.hypot(x1-x0,z1-z0);while(acc+l>=next&&next<total-4){const t=(next-acc)/l,sd=n++%2?1:-1,bx=x0+(x1-x0)*t-(z1-z0)/l*sd*(w/2+.45),bz=z0+(z1-z0)*t+(x1-x0)/l*sd*(w/2+.45);if(!nearPath(bx,bz,-1,.3)&&streamDist(bx,bz)>2.2)bollard(bx,bz);next+=every}acc+=l}}
 for(const [pts,w] of [[westPath,1.65],[eastPath,1.65],[innerPath,2],[southPath,2],[trail,1.4]])lightsAlong(pts,w,11);lightsAlong(clinicPath,2.6,16)
 sign('AEVUM · KLINIKA',102,-60);
 // Broad irregular mountain ridge with layered foothills, forest below the tree line and bare rock above.
 const peaks=[[-125,-30,65,64,53],[-25,-5,115,66,62],[82,-18,80,62,50],[170,-36,48,54,44]]
 const mountainHeight=(x,z)=>{let e=0;for(const [px,pz,h,sx,sz] of peaks)e+=h*Math.exp(-(((x-px)/sx)**2+((z-pz)/sz)**2));const edge=Math.max(0,1-(Math.abs(z)/110)**4)*Math.max(0,1-(Math.abs(x)/265)**6);return Math.max(-.2,(e+Math.sin(x*.11+z*.14)*4+Math.sin(x*.27-z*.19)*2+Math.abs(noise.noise(x*.03,z*.03,8))*9*Math.min(1,e/40))*edge)}
 const mountainGeometry=new T.PlaneGeometry(530,220,160,66);mountainGeometry.rotateX(-Math.PI/2);
 {const v=mountainGeometry.attributes.position,colors=[],c=new T.Color(),forestC=new T.Color('#2d4232'),meadowC=new T.Color('#566b45'),rockC=new T.Color('#747c78'),topC=new T.Color('#a7ada6')
  for(let i=0;i<v.count;i++){const x=v.getX(i),z=v.getZ(i),e=mountainHeight(x,z),n=noise.noise(x*.05,z*.05,3)*12;v.setY(i,e);c.copy(forestC).lerp(meadowC,smooth(50,66,e+n)).lerp(rockC,smooth(66,88,e+n)).lerp(topC,smooth(96,112,e+n*.6)).multiplyScalar(.85+noise.noise(x*.2,z*.2,1)*.25);colors.push(c.r,c.g,c.b)}
  mountainGeometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));mountainGeometry.computeVertexNormals()}
 const mountain=keep(mesh(mountainGeometry,patch(new T.MeshStandardMaterial({vertexColors:true,roughness:1}),{snowTop:false,snowExtra:'snowAmt=max(snowAmt,uSnow*smoothstep(25.,60.,vWorld.y+snowN*12.));'}),0,-1,-265));mountain.castShadow=false;mountain.receiveShadow=false

 // Merge static meshes per material and parent: ~2000 draw calls become ~150, which pays for the added detail.
 function tag(g){g.computeBoundingBox();const s=g.boundingBox.getSize(new T.Vector3()),ax=s.x>=s.y&&s.x>=s.z?0:s.y>=s.z?1:2,n=g.attributes.position.count,info=new Float32Array(n*2),sd=rand();for(let i=0;i<n;i++){info[i*2]=sd;info[i*2+1]=ax}g.setAttribute('aLocal',g.attributes.position.clone());g.setAttribute('aInfo',new T.BufferAttribute(info,2))}
 function bake(root){
  const buckets=new Map()
  for(const o of [...root.children]){
   if(o.children.length)bake(o)
   if(!o.isMesh||o.isInstancedMesh)continue
   if(o.userData.keep||Array.isArray(o.material)){if(!o.geometry.attributes.aInfo)tag(o.geometry);continue}
   const key=o.material.uuid+o.castShadow+o.receiveShadow;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o)
  }
  for(const list of buckets.values()){
   const parts=list.map(o=>{o.updateMatrix();const src=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(),g=new T.BufferGeometry();g.setAttribute('position',src.attributes.position);g.setAttribute('normal',src.attributes.normal);tag(g);g.applyMatrix4(o.matrix);return g})
   const merged=new T.Mesh(mergeGeometries(parts),list[0].material);merged.castShadow=list[0].castShadow;merged.receiveShadow=list[0].receiveShadow;root.add(merged)
   for(const o of list){root.remove(o);o.geometry.dispose()}parts.forEach(g=>g.dispose())
  }
 }
 bake(scene)

 // Top-down render of everything built so far: where grass and trees must not grow, and where soil is trampled.
 const occupancy=new Uint8Array(MASK.N*MASK.N),heightTarget=new T.WebGLRenderTarget(MASK.N,MASK.N,{type:T.HalfFloatType});let wearTexture
 {const rt=new T.WebGLRenderTarget(MASK.N,MASK.N),cam=new T.OrthographicCamera(-MASK.R,MASK.R,MASK.R,-MASK.R,1,400),white=new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide}),pixels=new Uint8Array(MASK.N*MASK.N*4),fog=scene.fog
  cam.position.set(MASK.cx,200,MASK.cz);cam.up.set(0,0,-1);cam.lookAt(MASK.cx,0,MASK.cz);terrain.visible=mountain.visible=false;scene.fog=null;scene.overrideMaterial=white
  renderer.setRenderTarget(rt);renderer.setClearColor(0x000000,1);renderer.clear();renderer.render(scene,cam);renderer.readRenderTargetPixels(rt,0,0,MASK.N,MASK.N,pixels)
  const heightMat=new T.ShaderMaterial({side:T.DoubleSide,vertexShader:HEIGHT_V,fragmentShader:'varying float vY;void main(){gl_FragColor=vec4(vY+50.,0.,0.,1.);}'});scene.overrideMaterial=heightMat;renderer.setRenderTarget(heightTarget);renderer.setClearColor(0x000000,0);renderer.clear();renderer.render(scene,cam);renderer.setRenderTarget(null);heightMat.dispose();snowU.uHeight.value=heightTarget.texture;snowU.uHeightBox.value.set(MASK.cx,MASK.cz,MASK.R)
  scene.overrideMaterial=null;scene.fog=fog;terrain.visible=mountain.visible=true;rt.dispose();white.dispose()
  const N=MASK.N,a=new Float32Array(N*N),b=new Float32Array(N*N);for(let i=0;i<N*N;i++){occupancy[i]=pixels[i*4]>0?1:0;a[i]=occupancy[i]}
  const pass=(src,dst,r,horizontal)=>{for(let j=0;j<N;j++){let acc=0;const at=i=>horizontal?src[j*N+Math.min(N-1,Math.max(0,i))]:src[Math.min(N-1,Math.max(0,i))*N+j];for(let i=-r;i<=r;i++)acc+=at(i);for(let i=0;i<N;i++){dst[horizontal?j*N+i:i*N+j]=acc/(2*r+1);acc+=at(i+r+1)-at(i-r)}}}
  pass(a,b,3,true);pass(b,a,3,false);pass(a,b,3,true);pass(b,a,3,false)
  const wear=new Uint8Array(N*N);for(let i=0;i<N*N;i++)wear[i]=Math.min(255,a[i]*255)
  wearTexture=new T.DataTexture(wear,N,N,T.RedFormat);wearTexture.magFilter=wearTexture.minFilter=T.LinearFilter;wearTexture.needsUpdate=true;groundU.uMask.value=wearTexture;groundU.uMaskBox.value.set(MASK.cx,MASK.cz,MASK.R)}
 const occupied=(x,z)=>{const N=MASK.N,px=Math.floor((x-MASK.cx+MASK.R)/(2*MASK.R)*N),py=Math.floor((MASK.cz+MASK.R-z)/(2*MASK.R)*N);return px>=0&&py>=0&&px<N&&py<N&&occupancy[py*N+px]===1}
 const clearAround=(x,z,m)=>!occupied(x,z)&&!occupied(x+m,z)&&!occupied(x-m,z)&&!occupied(x,z+m)&&!occupied(x,z-m)

 // ——— Vegetation, all instanced: meadow grass, wild flowers, ferns, undergrowth and a mixed forest ———
 const d=new T.Object3D()
 function instanced(geo,mat,list,{cast=false,tint}={}){const im=new T.InstancedMesh(geo,mat,Math.max(1,list.length));list.forEach(([x,y,z,sx,sy,sz,ry],i)=>{d.position.set(x,y,z);d.rotation.set(0,ry??rand()*6.28,0);d.scale.set(sx,sy??sx,sz??sx);d.updateMatrix();im.setMatrixAt(i,d.matrix);im.setColorAt(i,tint?tint(i):new T.Color().setScalar(.85+rand()*.3))});im.count=list.length;im.castShadow=cast;im.receiveShadow=true;scene.add(im);return im}
 const grassMat=patch(std('#5b7a37',{side:T.DoubleSide,roughness:.85}),{head:MEADOW+'varying float vH;varying vec2 vBase;uniform float uSway;',uniforms:{uLush:groundU.uLush,uDry:groundU.uDry,uDeep:groundU.uDeep,uSway:{value:.14}},vertex:'vH=uv.y;vBase=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xz;transformed*=(1.-smoothstep(40.,60.,distance(cameraPosition,vec3(vBase.x,0.,vBase.y))))*(1.-uSnow*.85);',snow:false,wind:GRASS_WIND,normal:UP_NORMAL,color:'vec3 gc=mix(meadow(vBase),vec3(.5,.45,.3),uSnow*.7);gc=mix(gc,uDry*1.15,vH*vH*.4);diffuseColor.rgb=gc*mix(.4,1.15,vH)*vColor;'})
 {const hot=[[0,1],[-34,2],[18,-39],[0,-29],[4.5,2.7],[-19,20],[-31,24],[10,20],[101,-70,26],[-8,-20],[12,27],[0,14],[-24,-6],[20,-14]],grass=[],per=low?900:4600
  const add=(x,z)=>{if(!clearAround(x,z,.25))return;const tall=fbmLike(x,z);grass.push([x,groundY(x,z),z,.22+tall*.32+rand()*.08])}
  const fbmLike=(x,z)=>noise.noise(x*.08,z*.08,6)*.5+.5
  for(const [hx,hz,hr=15] of hot)for(let i=0;i<per;i++){const a=rand()*Math.PI*2,r=Math.sqrt(rand())*hr;add(hx+Math.cos(a)*r,hz+Math.sin(a)*r)}
  for(let i=0;i<(low?4000:16000);i++){const a=rand()*Math.PI*2,r=Math.sqrt(rand())*64;add(Math.cos(a)*r,Math.sin(a)*r)}
  instanced(tuftGeo,grassMat,grass).userData.noReflect=true
  // Flowers cluster in drifts where the meadow is left longer.
  const flowerGeo=(()=>{const stem=new T.CylinderGeometry(.006,.008,1,3);stem.translate(0,.5,0);const head=new T.IcosahedronGeometry(.07,0);head.translate(0,1,0);const parts=[stem,head].map((g,k)=>{g.deleteAttribute('uv');const c=[];for(let i=0;i<g.attributes.position.count;i++)k?c.push(1,1,1):c.push(.3,.45,.2);g.setAttribute('color',new T.Float32BufferAttribute(c,3));return g.index?g.toNonIndexed():g});return mergeGeometries(parts)})()
  const flowers=[],hues=['#f4f1e6','#f1d45a','#9b7fd0','#e9e3f5','#d9774e'];for(let i=0;i<(low?800:3200);i++){const a=rand()*Math.PI*2,r=14+Math.sqrt(rand())*50,x=Math.cos(a)*r,z=Math.sin(a)*r;if(noise.noise(x*.07,z*.07,2)<.05||!clearAround(x,z,.3))continue;flowers.push([x,groundY(x,z),z,.28+rand()*.18])}
  const fl=instanced(flowerGeo,foliage('#ffffff',.05,.6),flowers,{tint:()=>new T.Color(hues[Math.floor(rand()*hues.length)])});fl.userData.noReflect=true;summerOnly.push(fl)}
 // Ferns and bilberry-like undergrowth fill the forest edge.
 const fernGeo=(()=>{const pos=[],nor=[],colr=[],idx=[];for(let f=0;f<7;f++){const a=f/7*Math.PI*2+rand()*.4,L=.8+rand()*.3,ca=Math.cos(a),sa=Math.sin(a),base=pos.length/3;for(let s=0;s<=10;s++){const t=s/10,hr=t*L*.9,y=Math.sin(t*2.2)*.45*L-t*t*.3,w=.13*Math.sin(Math.PI*Math.min(1,t*1.1))*(s%2?1:.55);pos.push(ca*hr-sa*w,y,sa*hr+ca*w,ca*hr+sa*w,y,sa*hr-ca*w);nor.push(0,1,0,0,1,0);const c=.55+t*.5;colr.push(c,c,c,c,c,c);if(s<10){const i=base+s*2;idx.push(i,i+1,i+2,i+1,i+3,i+2)}}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('color',new T.Float32BufferAttribute(colr,3));g.setIndex(idx);return g})()
 {const ferns=[],bushes=[];for(let i=0;i<(low?500:1800);i++){const a=rand()*Math.PI*2,r=47+rand()*40,x=Math.cos(a)*r,z=Math.sin(a)*r;if(!clearAround(x,z,.8)||Math.hypot(x-101,z+70)<40)continue;const y=groundY(x,z);if(noise.noise(x*.1,z*.1,9)>0)ferns.push([x,y,z,.7+rand()*.6]);else{const s=.35+rand()*.45;bushes.push([x,y+s*.25,z,s,s*.6,s])}}
  const fe=instanced(fernGeo,foliage('#4e7a33',.08,.8),ferns);fe.userData.noReflect=true;summerOnly.push(fe);instanced(shade(blob(1,.35,11)),foliage('#34502a',.03),bushes,{cast:true})}
 // Planting islands in the clearing: shrubs with a few flowering grasses.
 {const list=[],grasses=[];for(const [gx,gz] of [[-13,-4],[12,-5],[-12,-23],[13,-24],[-26,14],[-9,29]])for(let i=0;i<16;i++){const a=i*2.399,r=Math.sqrt(i)*.5;list.push([gx+Math.cos(a)*r,.15,gz+Math.sin(a)*r,.55+(i%3)*.1,.38+(i%3)*.13,.55+(i%3)*.1]);grasses.push([gx+Math.cos(a+1)*(r+.9),-.2,gz+Math.sin(a+1)*(r+.9),.7+rand()*.3,1+rand()*.5])}
  instanced(shade(blob(1,.3,13)),foliage('#5a7340',.03),list,{cast:true});tufts(grasses,reedMat)}
 // Mixed forest: Norway spruce, Scots pine and birches at the sunny edge; built in unit height and instanced.
 function spruceGeo(detail){const tiers=detail?16:10,parts=[];for(let j=0;j<tiers;j++){const t=j/(tiers-1),y=.1+t*.87,r=Math.pow(1-t,.85)*.2+.025,h=r*1.15+.05,g=new T.ConeGeometry(r,h,detail?18:9,detail?3:2,true),p=g.attributes.position,c=[],ph=rand()*6,ph2=rand()*6;g.deleteAttribute('uv')
   for(let i=0;i<p.count;i++){let x=p.getX(i),yy=p.getY(i),z=p.getZ(i);const k=Math.hypot(x,z)/r,a=Math.atan2(z,x),jag=1+(.28*Math.sin(a*5+ph)+.14*Math.sin(a*11+ph2)+(detail?.1*Math.sin(a*17+ph):0)+.3*noise.noise(Math.cos(a)*2.3+j,Math.sin(a)*2.3,ph))*k;x*=jag;z*=jag;yy-=k*k*r*(.45+.2*Math.sin(a*3+ph2));p.setXYZ(i,x,yy,z);const s=.38+.62*Math.pow(k,1.3)*(.8+.2*t)+t*.08;c.push(s*.92,s,s*.95)}
   g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.rotateX((rand()-.5)*.14);g.rotateZ((rand()-.5)*.14);g.rotateY(rand()*6.28);g.translate(0,y,0);parts.push(g)}
  const m=mergeGeometries(parts);m.computeVertexNormals();const n=m.attributes.normal,p=m.attributes.position,v=new T.Vector3();for(let i=0;i<n.count;i++){v.set(p.getX(i),.25,p.getZ(i)).normalize();n.setXYZ(i,...new T.Vector3(n.getX(i),n.getY(i),n.getZ(i)).lerp(v,.62).normalize().toArray())}return m}
 function crownGeo(blobs,y0,y1,spread,rMin,rMax,flat){const parts=[];for(let i=0;i<blobs;i++){const t=i/(blobs-1),g=blob(1,.42,i+rand()*9),y=y0+(y1-y0)*t,r=rMin+(rMax-rMin)*rand(),a=rand()*6.28,o=spread*(1-t*.6)*Math.sqrt(rand());g.scale(r,r*flat,r);g.translate(Math.cos(a)*o,y,Math.sin(a)*o);parts.push(g)}const m=mergeGeometries(parts);m.computeVertexNormals();return shade(m,.45,1.05,.35)}
 const trunkGeo=(rt,rb)=>{const g=new T.CylinderGeometry(rt,rb,1,7,3,true);g.translate(0,.5,0);return g}
 const species=[
  {n:'spruce',crowns:[1,1,1,0,0].map(spruceGeo),crownMat:foliage('#34503a',.25),trunk:trunkGeo(.004,.021),bark:patch(std('#5d4c3c',{roughness:.95}),{color:'float gr=sin(atan(vLocal.z,vLocal.x)*40.+vnoise(vLocal.xy*vec2(9.,60.))*4.);diffuseColor.rgb*=.72+.28*smoothstep(-.6,.6,gr);'}),h:[17,28],w:[.85,1.15]},
  {n:'pine',crowns:[0,1,2].map(()=>crownGeo(12,.66,.97,.12,.05,.09,.45)),crownMat:foliage('#4a6236',.3),trunk:trunkGeo(.007,.017),bark:patch(std('#5b4636',{roughness:.95}),{head:'uniform vec3 uOrange;',uniforms:{uOrange:col('#b0663a')},color:'diffuseColor.rgb=mix(diffuseColor.rgb,uOrange,smoothstep(.35,.62,vLocal.y)*(.7+.3*vnoise(vLocal.xy*vec2(20.,80.))));diffuseColor.rgb*=.8+.2*vnoise(vec2(atan(vLocal.z,vLocal.x)*6.,vLocal.y*90.));'}),h:[18,27],w:[.9,1.2]},
  {n:'birch',crowns:[0,1,2].map(()=>crownGeo(26,.4,.99,.13,.035,.065,.8)),crownMat:foliage('#6d8e42',.35),trunk:trunkGeo(.006,.015),bark:patch(std('#e8e4da',{roughness:.8}),{color:'float ang=atan(vLocal.z,vLocal.x);float lent=smoothstep(.7,.78,vnoise(vec2(ang*2.,vLocal.y*260.)));float pat=smoothstep(.6,.7,fbm(vec2(ang*1.2,vLocal.y*30.)));float base=smoothstep(.16,.02,vLocal.y);diffuseColor.rgb*=1.-max(max(lent*.85,pat*.8),base*.75);'}),h:[13,19],w:[.9,1.2]}
 ]
 const plantings=species.map(s=>s.crowns.map(()=>[]))
 const cell=low?5.6:4.4
 for(let gx=-140;gx<=140;gx+=cell)for(let gz=-140;gz<=140;gz+=cell){const x=gx+(rand()-.5)*cell*.9,z=gz+(rand()-.5)*cell*.9,r=Math.hypot(x,z),edge=54+noise.noise(x*.05,z*.05,2.2)*7
  if(r<edge||r>136||Math.hypot(x-101,z+70)<46||(z>0&&Math.abs(x)<6)||!clearAround(x,z,3)||rand()>.86)continue
  const k=r<edge+9&&rand()<.45?2:rand()<.22?1:0,s=species[k],h=s.h[0]+rand()*(s.h[1]-s.h[0]),v=k===0?(r<88?Math.floor(rand()*3):3+Math.floor(rand()*2)):Math.floor(rand()*s.crowns.length);plantings[k][v].push([x,groundY(x,z)-.3,z,h*(s.w[0]+rand()*(s.w[1]-s.w[0])),h])}
 // A few solitary birches and a pine inside the clearing.
 for(const [x,z,k] of [[-41,15,2],[-37,34,2],[27,-18,2],[-15,-35,2],[38,-4,2],[-44,-12,2]])plantings[k][0].push([x,-.5,z,k===1?22:16,k===1?22:16])
 species.forEach((s,k)=>{const all=plantings[k].flat();instanced(s.trunk,s.bark,all.map(([x,y,z,w,h])=>[x,y,z,w,h,w]),{cast:true});s.crowns.forEach((g,v)=>{const cr=instanced(g,s.crownMat,plantings[k][v].map(([x,y,z,w,h])=>[x,y,z,w,h,w]),{cast:true,tint:()=>new T.Color(.85+rand()*.25,.85+rand()*.3,.8+rand()*.25)});if(s.n==='birch')summerOnly.push(cr)})})
 // Leafless birch twigs for winter, sharing the birches' placement.
 {const parts=[];for(let i=0;i<30;i++){const y=.38+rand()*.58,len=.1+rand()*.2*(1.1-y),g=new T.CylinderGeometry(.0025,.005,len,4,1,true);g.deleteAttribute('uv');g.translate(0,len/2,0);g.rotateZ(.5+rand()*.7);g.rotateY(rand()*6.28);g.translate(0,y,0);parts.push(g)}
  winterOnly.push(instanced(mergeGeometries(parts),twig,plantings[2].flat().map(([x,y,z,w,h])=>[x,y,z,w,h,w]),{cast:true}))}
 // Distant forest carpet over the hills and up the mountain flanks to the tree line.
 {const far=new T.ConeGeometry(.2,.62,6,1,true),top=new T.ConeGeometry(.14,.4,6,1,true);far.translate(0,.38,0);top.translate(0,.74,0);const g=mergeGeometries([far,top].map(p=>{p.deleteAttribute('uv');const c=[],pos=p.attributes.position;for(let i=0;i<pos.count;i++){const v=.5+pos.getY(i)*.55;c.push(v,v,v)}p.setAttribute('color',new T.Float32BufferAttribute(c,3));return p.toNonIndexed()}))
  const list=[],fc=low?11:8.5;for(let gx=-380;gx<=380;gx+=fc)for(let gz=-400;gz<=380;gz+=fc){const x=gx+(rand()-.5)*fc,z=gz+(rand()-.5)*fc,r=Math.hypot(x,z);if(r<134||r>390||Math.hypot(x-101,z+70)<48||(z>0&&Math.abs(x)<8))continue;const mh=z<-150?mountainHeight(x,z+265)-1:-9;if(mh>58+noise.noise(x*.04,z*.04,5)*10)continue;const h=14+rand()*10;list.push([x,Math.max(groundY(x,z),mh)-.5,z,h,h,h])}
  instanced(g,patch(std('#2c4232',{vertexColors:true,roughness:.95,flatShading:true}),{snowTop:false,snowExtra:'snowAmt*=.7;'}),list,{tint:()=>new T.Color(.8+rand()*.35,.85+rand()*.35,.8+rand()*.3)}).userData.noReflect=true}

 // Chimney smoke: soft camera-facing puffs animated entirely on the GPU.
 const smokeBase=new T.PlaneGeometry(1,1)
 function smoke(origin,{count=34,rise=7,rate=.055,size=.9,drift=3.2,opacity=.42,period=0,life=3,wobble=.25}={}){const g=new T.InstancedBufferGeometry();g.index=smokeBase.index;g.setAttribute('position',smokeBase.attributes.position);g.setAttribute('uv',smokeBase.attributes.uv);g.setAttribute('aSeed',new T.InstancedBufferAttribute(Float32Array.from({length:count},(_,i)=>i/count+rand()*.02),1));g.instanceCount=count
  const m=new T.Mesh(g,new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime,uOrigin:{value:origin},uRise:{value:rise},uRate:{value:rate},uSize:{value:size},uDrift:{value:drift},uOpacity:{value:opacity},uPeriod:{value:period},uLife:{value:life},uWobble:{value:wobble},uLight:smokeLight,uColor:{value:new T.Color('#e4e6e4').multiplyScalar(1.25)}},vertexShader:SMOKE_V,fragmentShader:SMOKE_F}));m.frustumCulled=false;m.renderOrder=5;m.userData.noAO=true;keep(m);scene.add(m);return m}
 scene.updateMatrixWorld(true)
 smoke(new T.Vector3(1.9,4.55,.3));const crownSmoke=smoke(ceremonyBuilding.localToWorld(new T.Vector3(0,7.1,0)),{count:40,size:1.1});smoke(new T.Vector3(12,.7,27),{count:18,rise:3.5,size:.45,drift:1.2,opacity:.3})
 // Steam: bursts when water hits the stones, a gentle plume from the herbal generator, and in winter over the water.
 smoke(new T.Vector3(1.9,1.2,.55),{count:16,rise:1.1,size:.35,drift:.15,opacity:.35,period:7,life:2.6,wobble:.35});smoke(ceremonyBuilding.localToWorld(new T.Vector3(0,1.35,0)),{count:22,rise:1.6,size:.5,drift:.2,opacity:.35,period:9,life:3.2,wobble:.5});smoke(herbalBuilding.localToWorld(new T.Vector3(2.8,1.05,-1.4)),{count:14,rate:.12,rise:1.3,size:.3,drift:.2,opacity:.22,wobble:.3})
 winterOnly.push(smoke(new T.Vector3(4.5,.95,2.7),{count:20,rate:.07,rise:1.8,size:.55,drift:.6,opacity:.15,wobble:.4}),smoke(new T.Vector3(poolX+1.39,.45,poolZ+2.12),{count:14,rate:.07,rise:1.4,size:.6,drift:.5,opacity:.2,wobble:.4}))
 // Warm light pools on the ground; they fade in at dusk.
 const poolTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.18,'rgba(255,255,255,.5)');gr.addColorStop(.5,'rgba(255,255,255,.14)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);return new T.CanvasTexture(c)})()
 const poolMat=new T.MeshBasicMaterial({map:poolTex,color:'#ffb45e',transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,fog:false,polygonOffset:true,polygonOffsetFactor:-4})
 {const plane=new T.PlaneGeometry(2,2);plane.rotateX(-Math.PI/2);const lp=new T.InstancedMesh(plane,poolMat,pools.length),pd=new T.Object3D();pools.forEach(([x,z,r,y=-.1],i)=>{pd.position.set(x,y,z);pd.scale.set(r,1,r);pd.updateMatrix();lp.setMatrixAt(i,pd.matrix)});lp.userData.noAO=true;lp.renderOrder=4;scene.add(lp)}
 // Falling snow around the camera, and footprints along the busiest routes.
 const snowfallMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime,uScale:{value:600},uLight:{value:1}},vertexShader:SNOWFALL_V,fragmentShader:SNOWFALL_F})
 {const flakes=new T.Points(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(Float32Array.from({length:(low?1500:4500)*3},()=>rand()),3)),snowfallMat);flakes.frustumCulled=false;scene.add(flakes);winterOnly.push(flakes)}
 {const list=[],walk=(pts,y,every=.42)=>{let carry=0,n=0;for(let i=1;i<pts.length;i++){const [x0,z0]=pts[i-1],[x1,z1]=pts[i],l=Math.hypot(x1-x0,z1-z0);if(!l)continue;const ux=(x1-x0)/l,uz=(z1-z0)/l;let t=carry;for(;t<l;t+=every){const sd=n++%2?.11:-.11;list.push([x0+ux*t-uz*sd,y,z0+uz*t+ux*sd,.055,1,.13,Math.atan2(ux,uz)])}carry=t-l}}
  walk(eastPath.slice(0,40),-.113);walk(entryPath.slice(25),-.113);walk(trail,-.113);walk(westPath.slice(0,35),-.113);walk([[3.7,1.6],[5.8,.5],[7.5,-1.5],[8.5,-4]],-.215)
  const fp=instanced(new T.CircleGeometry(1,10).rotateX(-Math.PI/2),footprint,list);fp.userData.noReflect=fp.userData.noAO=true;winterOnly.push(fp)}
 // Live reflection in the pool on capable devices; phones keep the cheaper shaded water.
 let poolWater=null
 if(!low){poolWater=new Reflector(new T.CircleGeometry(1,96),{textureWidth:512,textureHeight:512,clipBias:.003,multisample:0,shader:POOL});poolWater.position.set(poolX,.405,poolZ);poolWater.rotation.x=-Math.PI/2;poolWater.scale.set(5.55,3.85,1);poolWater.material.uniforms.uTime=uTime;poolWater.userData.noAO=true;scene.add(poolWater);scene.remove(poolSurface);poolSurface.geometry.dispose()
  const skipped=[];scene.traverse(o=>{if(o.userData.noReflect)skipped.push(o)});const reflect=poolWater.onBeforeRender
  poolWater.onBeforeRender=(r,sc,c)=>{if(c!==camera)return;const vis=skipped.map(o=>o.visible);skipped.forEach(o=>o.visible=false);sc.background=envTarget.texture;reflect(r,sc,c);sc.background=null;skipped.forEach((o,i)=>o.visible=vis[i])}}
 const markers=stops.slice(1).map((s,i)=>{const m=keep(mesh(new T.SphereGeometry(.13,16,12),new T.MeshBasicMaterial({color:0xffdb8f}),...s.point));m.userData.index=i+1;m.castShadow=false;return m})
 scene.traverse(o=>{if(o.material===glass)o.userData.noAO=true})

 // Post-processing: sky pass, scene pass, ground-truth ambient occlusion, then tone mapping.
 const composer=new EffectComposer(renderer,new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:low?2:4}))
 const scenePass=new RenderPass(scene,camera);scenePass.clear=false
 composer.addPass(new RenderPass(skyScene,camera));composer.addPass(scenePass)
 let gtao=null;const noAO=[];scene.traverse(o=>{if(o.userData.noAO)noAO.push(o)})
 if(!low){gtao=new GTAOPass(scene,camera,1,1);gtao.updateGtaoMaterial({radius:.8,distanceExponent:1.5,thickness:1.2,scale:1.1,samples:12});const fullSize=gtao.setSize.bind(gtao);gtao.setSize=(w,h)=>fullSize(Math.ceil(w/2),Math.ceil(h/2));gtao.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:6,rings:2,samples:16});gtao.blendIntensity=.85;const base=gtao.overrideVisibility.bind(gtao);gtao.overrideVisibility=()=>{base();noAO.forEach(o=>o.visible=false)};composer.addPass(gtao)}
 const outputPass=new OutputPass();composer.addPass(outputPass)

 // Shadows follow the area in view and re-render only when that area changes.
 let shadowKey=''
 const updateShadow=()=>{const dist=camera.position.distanceTo(controls.target),q=Math.pow(1.25,Math.round(Math.log(Math.min(95,Math.max(12,dist*.8)))/Math.log(1.25))),step=q/24,cx=Math.round(controls.target.x/step)*step,cz=Math.round(controls.target.z/step)*step,key=q+'|'+cx+'|'+cz
  if(key===shadowKey)return;shadowKey=key;const c=sun.shadow.camera;c.left=c.bottom=-q;c.right=c.top=q;c.near=1;c.far=q*2+260;c.updateProjectionMatrix();sun.target.position.set(cx,0,cz);sun.position.set(cx,0,cz).addScaledVector(sunDir,q+130);renderer.shadowMap.needsUpdate=true}

 // Time of day and season: one preset per combination, applied in place without rebuilding the scene.
 let night=0
 const nightLights=[[glow,14,26],[stoveLight,5,9],[ceremonyLight,10,18],[herbLight,0,12],[loungeLight,0,16],[pergolaLight,0,10],[fireLight,1.5,12]]
 function applyMode(dusk,winter){const P=MODES[winter?(dusk?'winterDusk':'winterDay'):(dusk?'dusk':'day')];night=P.night
  sunDir.setFromSphericalCoords(1,T.MathUtils.degToRad(90-P.elev),T.MathUtils.degToRad(P.az));const U=sky.material.uniforms;[U.turbidity.value,U.rayleigh.value,U.mieCoefficient.value,U.mieDirectionalG.value]=P.sky;U.sunPosition.value.copy(sunDir)
  const C=clouds.material.uniforms;C.uBright.value=P.clouds[0];C.uCover.value=P.clouds[1];C.uTint.value.set(P.clouds[2])
  envTarget.dispose();envTarget=pmrem.fromScene(skyScene,0,.1,1000);scene.environment=envTarget.texture;scene.environmentIntensity=P.env
  scene.fog.color.set(P.fog[0]);scene.fog.density=P.fog[1];hemi.color.set(P.hemi[0]);hemi.groundColor.set(P.hemi[1]);hemi.intensity=P.hemi[2];sun.color.set(P.sun[0]);sun.intensity=P.sun[1];renderer.toneMappingExposure=P.exposure
  for(const [l,a,b] of nightLights){l.userData.base=a+(b-a)*night;l.intensity=l.userData.base}
  led.emissiveIntensity=2+3*night;lampGlow.emissiveIntensity=3+5*night;salt.emissiveIntensity=.55+.75*night;glass.emissive.set('#ffb070');glass.emissiveIntensity=.22*night;clinicGlass.emissive.set('#ffe2b0');clinicGlass.emissiveIntensity=.7*night;poolMat.opacity=.26*night
  smokeLight.value=P.smoke;snowfallMat.uniforms.uLight.value=P.smoke*.85;if(poolWater)poolWater.material.uniforms.uBody.value=P.body;uSnow.value=winter?1:0
  for(const o of winterOnly)o.visible=winter;for(const o of summerOnly)o.visible=!winter;shadowKey=''}
 // Compile every seasonal variant up front so the first switch does not stall.
 for(const o of [...winterOnly,...summerOnly])o.visible=true;renderer.compile(scene,camera);applyMode(false,false)

 let destination=null;const rotate=direction=>{destination=null;const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new T.Vector3(0,1,0),direction*Math.PI/8);camera.position.copy(controls.target).add(offset);controls.update()};api.current={rotate,go(i){destination={pos:new T.Vector3(...stops[i].pos),target:new T.Vector3(...stops[i].target)}},cut(v){roofs.forEach(roof=>roof.visible=!v);crownSmoke.visible=!v;renderer.shadowMap.needsUpdate=true},mode:applyMode}
 controls.addEventListener('start',()=>destination=null)
 const zoomRay=new T.Raycaster(),zoomPointer=new T.Vector2();
 const onWheel=e=>{
  e.preventDefault();e.stopImmediatePropagation();destination=null;
  const rect=renderer.domElement.getBoundingClientRect();zoomPointer.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);
  camera.updateMatrixWorld();zoomRay.setFromCamera(zoomPointer,camera);
  const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?rect.height:1);
  const step=(1-Math.exp(Math.max(-.3,Math.min(.3,-delta*.0015))))*Math.max(3,camera.position.y)*1.5;
  const move=zoomRay.ray.direction.clone().multiplyScalar(-step);
  const nextHeight=camera.position.y+move.y;
  if(nextHeight<.8||nextHeight>230)return;
  camera.position.add(move);controls.target.add(move);controls.update();
 };
 renderer.domElement.addEventListener('wheel',onWheel,{capture:true,passive:false});

 renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','3D sauna. Táhněte pro otáčení nebo použijte šipky vlevo a vpravo.');const onKey=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();rotate(e.key==='ArrowLeft'?1:-1)}};renderer.domElement.addEventListener('keydown',onKey)
 const ray=new T.Raycaster(),pointer=new T.Vector2();let down=[0,0]
 const onDown=e=>down=[e.clientX,e.clientY]
 const onUp=e=>{if(Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(markers)[0];if(hit)choose(hit.object.userData.index)}
 renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointerup',onUp)
 const resize=new ResizeObserver(()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();snowfallMat.uniforms.uScale.value=h*renderer.getPixelRatio()/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)))});resize.observe(el)
 let frame;const tick=()=>{frame=requestAnimationFrame(tick);if(document.hidden)return;const t=reduced.matches?0:performance.now()*.001;uTime.value=t
  const flame=reduced.matches?1:.82+Math.sin(t*13)*.08+Math.sin(t*7.3+1)*.07+Math.sin(t*23)*.04;fire.emissiveIntensity=(4+2*night)*flame;stoveLight.intensity=stoveLight.userData.base*flame;fireLight.intensity=fireLight.userData.base*(reduced.matches?1:.85+Math.sin(t*9.7)*.1+Math.sin(t*5.1+2)*.08)
  if(destination){camera.position.lerp(destination.pos,.065);controls.target.lerp(destination.target,.065);if(camera.position.distanceTo(destination.pos)<.015)destination=null}
  controls.update();updateShadow();sky.position.copy(camera.position);clouds.position.copy(camera.position);composer.render()};tick()
 return()=>{cancelAnimationFrame(frame);resize.disconnect();controls.dispose();renderer.domElement.removeEventListener('wheel',onWheel,true);renderer.domElement.removeEventListener('keydown',onKey);renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointerup',onUp);labels.forEach(texture=>texture.dispose());wearTexture?.dispose();holeTexture?.dispose();poolTex.dispose();heightTarget.dispose();poolWater?.dispose();envTarget.dispose();pmrem.dispose();gtao?.dispose();outputPass.dispose();composer.dispose()
  for(const s of [scene,skyScene])s.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat())m?.dispose()});smokeBase.dispose();renderer.dispose();renderer.domElement.remove();api.current=null}
 },[])
 useEffect(()=>api.current?.cut(cut),[cut])
 useEffect(()=>api.current?.mode(dusk,winter),[dusk,winter])
 return <main className={winter&&!dusk?'sauna-page snowy':'sauna-page'}><div ref={host} className="sauna-scene" aria-label="Interaktivní 3D model sauny v lese"/><header className="sauna-header"><a href="/">AEVUM <span>← Zpět na kliniku</span></a><span>LESNÍ RETREAT / 3D STUDIE</span></header><div className="sauna-modes"><div role="group" aria-label="Denní doba"><button aria-pressed={!dusk} onClick={()=>setDusk(false)}>Den</button><button aria-pressed={dusk} onClick={()=>setDusk(true)}>Soumrak</button></div><div role="group" aria-label="Roční období"><button aria-pressed={!winter} onClick={()=>setWinter(false)}>Léto</button><button aria-pressed={winter} onClick={()=>setWinter(true)}>Zima</button></div></div><div className="sauna-heading"><p>TŘI SAUNY. JEDEN KLID.</p><h1>Lesní lázně.</h1><span>Finská · herbal · solná · odpočívárna</span></div>{error&&<div className="sauna-error">3D zobrazení není dostupné. Zkuste prohlížeč s podporou WebGL. Popis míst si můžete projít níže.</div>}<button className="sauna-info-toggle" aria-expanded={details} aria-controls="sauna-info" onClick={()=>setDetails(!details)}>{details ? 'Zavřít detail ×' : 'O místě ⓘ'}</button>{details && <aside id="sauna-info" className="sauna-detail" aria-live="polite"><span>{stops[active].tag}</span><h2>{stops[active].name}</h2><p>{stops[active].text}</p><button onClick={()=>setCut(!cut)} aria-pressed={cut}>{cut?'Zavřít řez saunou':'Otevřít řez saunou'} ↗</button></aside>}<div className="sauna-rotate" role="group" aria-label="Otáčení pohledu"><button aria-label="Otočit pohled doleva" onClick={()=>api.current?.rotate(1)}>←</button><span>Otočit pohled</span><button aria-label="Otočit pohled doprava" onClick={()=>api.current?.rotate(-1)}>→</button></div><footer className="sauna-bottom"><nav aria-label="Místa v sauně">{stops.map((s,i)=><button key={s.name} aria-pressed={active===i} className={active===i?'selected':''} onClick={()=>choose(i)}><span>{String(i+1).padStart(2,'0')}</span>{s.name}</button>)}</nav><div><span>Levé: posun mapy · pravé: otáčení · kolečko: přiblížení bez centrování · jeden prst: posun</span><span>Koncept prostoru, nikoli realizační dokumentace</span></div></footer></main>
}
