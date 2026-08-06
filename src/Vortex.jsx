import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

/* ==================================================================
   Yin-Yang Vortex
   Dvě protilehlé spirály, které do sebe plynule přecházejí.
   Světlá větev = jang (technologie), hluboká zelenomodrá = jin (příroda).

   Optimalizace oproti původnímu prototypu:
   · barvy i jednotkové matice se počítají jen jednou při startu
   · v každém snímku se přepisuje pouze translace (indexy 12–14)
   · konstanty na částici jsou předpočítané v typovaných polích
   · po odscrollování z hera se renderuje na poloviční frekvenci
================================================================== */

const RADIUS = 70
const TWIST = 5
const FLOW = 1.3
const HEIGHT = 40
const GOLDEN = 2.399963229728653
const BG = 0x04070a

export default function Vortex({ count = 14000, bloom = 1.7, idleRef = null }) {
  const hostRef = useRef(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: 'high-performance',
      })
    } catch (err) {
      return
    }

    let w = host.clientWidth || window.innerWidth
    let h = host.clientHeight || window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 1.6)

    renderer.setPixelRatio(dpr)
    renderer.setSize(w, h, false)
    renderer.setClearColor(BG, 1)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(BG, 95, 320)

    const camera = new THREE.PerspectiveCamera(58, w / h, 1, 700)
    camera.position.set(0, 16, 118)

    /* ---------- geometrie roje ---------- */

    const geometry = new THREE.TetrahedronGeometry(0.26)
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const mesh = new THREE.InstancedMesh(geometry, material, count)
    mesh.frustumCulled = false
    scene.add(mesh)

    const side = new Float32Array(count)
    const uArr = new Float32Array(count)
    const rArr = new Float32Array(count)
    const base = new Float32Array(count)
    const blend = new Float32Array(count)
    const pos = new Float32Array(count * 3)

    const half = count * 0.5
    const color = new THREE.Color()

    for (let i = 0; i < count; i++) {
      const s = i < half ? -1 : 1
      const local = s < 0 ? i : i - half
      const u = (local + 0.5) / half

      side[i] = s
      uArr[i] = u
      rArr[i] = RADIUS * Math.sqrt(u)
      base[i] = GOLDEN * local + s * TWIST * Math.sqrt(u)
      blend[i] = 1 - u

      // částice startují rozprostřené a teprve se slétají do tvaru
      pos[i * 3] = (Math.random() - 0.5) * 200
      pos[i * 3 + 1] = (Math.random() - 0.5) * 200
      pos[i * 3 + 2] = (Math.random() - 0.5) * 200

      if (s < 0) {
        color.setHSL(0.09, 0.22, 0.97 - 0.62 * u) // jang — teplá slonovina
      } else {
        color.setHSL(0.45, 0.88, 0.08 + 0.5 * (1 - u)) // jin — hluboká zelenomodrá
      }
      mesh.setColorAt(i, color)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

    const m = mesh.instanceMatrix.array
    for (let i = 0; i < count; i++) {
      const o = i * 16
      m[o] = 1
      m[o + 5] = 1
      m[o + 10] = 1
      m[o + 15] = 1
      m[o + 12] = pos[i * 3]
      m[o + 13] = pos[i * 3 + 1]
      m[o + 14] = pos[i * 3 + 2]
    }
    mesh.instanceMatrix.needsUpdate = true

    /* ---------- postprocessing ---------- */

    const composer = new EffectComposer(renderer)
    composer.setPixelRatio(dpr)
    composer.setSize(w, h)
    composer.addPass(new RenderPass(scene, camera))
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), bloom, 0.45, 0)
    composer.addPass(bloomPass)
    composer.addPass(new OutputPass())

    /* ---------- smyčka ---------- */

    const clock = new THREE.Clock()
    let raf = 0
    let orbit = 0
    let frame = 0
    let visible = !document.hidden

    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!visible) return

      const idle = idleRef && idleRef.current
      frame++
      if (idle && frame % 2) return // mimo hero stačí polovina snímků

      const delta = Math.min(clock.getDelta(), 0.05)
      const t = clock.elapsedTime

      orbit += delta * 0.042
      camera.position.x = Math.sin(orbit) * 118
      camera.position.z = Math.cos(orbit) * 118
      camera.position.y = 16 + Math.sin(orbit * 0.7) * 12
      camera.lookAt(0, 0, 0)

      const lerp = Math.min(1, delta * 6)

      for (let i = 0; i < count; i++) {
        const s = side[i]
        const spiral = base[i] + s * t * FLOW
        const rr = rArr[i]
        const b = blend[i]

        const tx = s * rr * Math.cos(spiral) * b
        const ty = HEIGHT * (0.5 - uArr[i]) * Math.sin(spiral * 0.5 + t)
        const tz = rr * Math.sin(spiral) * b

        const p = i * 3
        const x = (pos[p] += (tx - pos[p]) * lerp)
        const y = (pos[p + 1] += (ty - pos[p + 1]) * lerp)
        const z = (pos[p + 2] += (tz - pos[p + 2]) * lerp)

        const o = i * 16
        m[o + 12] = x
        m[o + 13] = y
        m[o + 14] = z
      }
      mesh.instanceMatrix.needsUpdate = true

      composer.render()
    }
    raf = requestAnimationFrame(tick)

    /* ---------- události ---------- */

    const onVisibility = () => {
      visible = !document.hidden
      if (visible) clock.getDelta() // zahodit pauzu
    }
    document.addEventListener('visibilitychange', onVisibility)

    let resizeTimer = 0
    const onResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        w = host.clientWidth || window.innerWidth
        h = host.clientHeight || window.innerHeight
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h, false)
        composer.setSize(w, h)
        bloomPass.setSize(w, h)
      }, 180)
    }
    window.addEventListener('resize', onResize)

    const onLost = (e) => {
      e.preventDefault()
      cancelAnimationFrame(raf)
    }
    renderer.domElement.addEventListener('webglcontextlost', onLost)

    /* ---------- úklid ---------- */

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      renderer.domElement.removeEventListener('webglcontextlost', onLost)
      composer.dispose()
      geometry.dispose()
      material.dispose()
      mesh.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement)
    }
  }, [count, bloom, idleRef])

  return <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
}
