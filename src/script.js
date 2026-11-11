import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Timer } from 'three/addons/misc/Timer.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import GUI from 'lil-gui'

import { ZenPhysicsEngine } from './physics.js'
import { SakuraParticles } from './particles.js'
import { waterVertexShader, waterFragmentShader } from './shaders/waterShader.js'

/**
 * ========================================================================
 * 1. БАЗОВА ІНІЦІАЛІЗАЦІЯ ТА СЦЕНА
 * ========================================================================
 */

// Debug GUI
const gui = new GUI({ title: '🌿 Налаштування Дзен-Саду', width: 310 })
if (window.innerWidth < 768) {
    gui.close()
}

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

// Фізичний рушій Дзен (Cannon-es)
const physics = new ZenPhysicsEngine(scene)

// Менеджер завантаження з анімованим прогрес-баром
const loadingScreen = document.getElementById('loading-screen')
const loadingBar = document.getElementById('loading-bar')
const loadingText = document.getElementById('loading-text')

const loadingManager = new THREE.LoadingManager(
    () => {
        setTimeout(() => {
            if (loadingScreen) {
                loadingScreen.classList.add('fade-out')
                setTimeout(() => { loadingScreen.style.display = 'none' }, 600)
            }
        }, 300)
    },
    (url, loaded, total) => {
        const ratio = loaded / total
        if (loadingBar) loadingBar.style.transform = `scaleX(${ratio})`
        if (loadingText) loadingText.textContent = `Відкриття саду сакури: ${Math.round(ratio * 100)}%`
    }
)

const textureLoader = new THREE.TextureLoader(loadingManager)
const gltfLoader = new GLTFLoader(loadingManager)

/**
 * ========================================================================
 * 2. PBR ТЕКСТУРИ ТА МАТЕРІАЛИ
 * ========================================================================
 */

// Текстури землі та саду
const floorColorTexture = textureLoader.load('./floor/coast_sand_rocks_02_1k/coast_sand_rocks_02_diff_1k.webp')
const floorARMTexture = textureLoader.load('./floor/coast_sand_rocks_02_1k/coast_sand_rocks_02_arm_1k.webp')
const floorNormalTexture = textureLoader.load('./floor/coast_sand_rocks_02_1k/coast_sand_rocks_02_nor_gl_1k.webp')
const floorDispTexture = textureLoader.load('./floor/coast_sand_rocks_02_1k/coast_sand_rocks_02_disp_1k.webp')

floorColorTexture.colorSpace = THREE.SRGBColorSpace
floorColorTexture.repeat.set(8, 8)
floorARMTexture.repeat.set(8, 8)
floorNormalTexture.repeat.set(8, 8)
floorDispTexture.repeat.set(8, 8)

floorColorTexture.wrapS = THREE.RepeatWrapping
floorColorTexture.wrapT = THREE.RepeatWrapping
floorARMTexture.wrapS = THREE.RepeatWrapping
floorARMTexture.wrapT = THREE.RepeatWrapping
floorNormalTexture.wrapS = THREE.RepeatWrapping
floorNormalTexture.wrapT = THREE.RepeatWrapping
floorDispTexture.wrapS = THREE.RepeatWrapping
floorDispTexture.wrapT = THREE.RepeatWrapping

// Текстури даху святилища
const roofColorTexture = textureLoader.load('./roof/roof_slates_02_1k/roof_slates_02_diff_1k.webp')
const roofARMTexture = textureLoader.load('./roof/roof_slates_02_1k/roof_slates_02_arm_1k.webp')
const roofNormalTexture = textureLoader.load('./roof/roof_slates_02_1k/roof_slates_02_nor_gl_1k.webp')

roofColorTexture.colorSpace = THREE.SRGBColorSpace
roofColorTexture.repeat.set(3, 2)
roofARMTexture.repeat.set(3, 2)
roofNormalTexture.repeat.set(3, 2)

roofColorTexture.wrapS = THREE.RepeatWrapping
roofARMTexture.wrapS = THREE.RepeatWrapping
roofNormalTexture.wrapS = THREE.RepeatWrapping

// Традиційні японські матеріали (PBR + Physical)
const toriiRedMaterial = new THREE.MeshPhysicalMaterial({
    color: '#b91c1c', // Священний червоний лак Шуруї
    roughness: 0.25,
    metalness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.14
})

const darkCedarMaterial = new THREE.MeshStandardMaterial({
    color: '#291811', // Темний зістарений японський кедр
    roughness: 0.85,
    metalness: 0.05
})

const stoneLanternMaterial = new THREE.MeshStandardMaterial({
    color: '#64748b',
    roughness: 0.8,
    metalness: 0.1
})

const shojiPaperMaterial = new THREE.MeshStandardMaterial({
    color: '#fffbeb',
    roughness: 0.9,
    emissive: '#f59e0b',
    emissiveIntensity: 0.4
})

const goldTrimMaterial = new THREE.MeshStandardMaterial({
    color: '#fbbf24',
    roughness: 0.25,
    metalness: 0.9
})

/**
 * ========================================================================
 * 3. ГЕОМЕТРІЯ ТА ПРИМІТИВИ (ЯПОНСЬКИЙ ХРАМ, ТОРІЇ, СТАВОК)
 * ========================================================================
 */

// 1. Земля саду Дзен (PlaneGeometry з природним пісочно-моховим тоном і displacement)
const zenFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(32, 32, 96, 96),
    new THREE.MeshStandardMaterial({
        color: '#c2b69d', // Теплий колір піску та гравію
        map: floorColorTexture,
        aoMap: floorARMTexture,
        roughnessMap: floorARMTexture,
        metalnessMap: floorARMTexture,
        normalMap: floorNormalTexture,
        displacementMap: floorDispTexture,
        displacementScale: 0.12,
        displacementBias: -0.06,
        roughness: 0.85
    })
)
zenFloor.rotation.x = -Math.PI * 0.5
zenFloor.receiveShadow = true
scene.add(zenFloor)

const shrineGroup = new THREE.Group()
scene.add(shrineGroup)

// 2. Червоні священні ворота Торії (Torii Gates)
function createTorii(zPos = 3.8, scale = 1.0) {
    const torii = new THREE.Group()

    // Дві головні циліндричні колони (Hashira)
    const pillarGeo = new THREE.CylinderGeometry(0.18, 0.22, 4.2, 16)
    const leftPillar = new THREE.Mesh(pillarGeo, toriiRedMaterial)
    leftPillar.position.set(-1.8, 2.1, 0)
    leftPillar.castShadow = true

    const rightPillar = new THREE.Mesh(pillarGeo, toriiRedMaterial)
    rightPillar.position.set(1.8, 2.1, 0)
    rightPillar.castShadow = true

    // Чорні кам'яні основи під колонами (Daiishi)
    const baseGeo = new THREE.CylinderGeometry(0.28, 0.32, 0.35, 16)
    const leftBase = new THREE.Mesh(baseGeo, darkCedarMaterial)
    leftBase.position.set(-1.8, 0.17, 0)
    leftBase.receiveShadow = true

    const rightBase = new THREE.Mesh(baseGeo, darkCedarMaterial)
    rightBase.position.set(1.8, 0.17, 0)
    rightBase.receiveShadow = true

    // Верхня головна вигнута перекладина (Kasagi)
    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.32, 0.45), toriiRedMaterial)
    topBeam.position.set(0, 4.15, 0)
    topBeam.castShadow = true

    // Чорна верхня накладка на перекладину (Shimaki)
    const capBeam = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.08, 0.48), darkCedarMaterial)
    capBeam.position.set(0, 4.35, 0)
    capBeam.castShadow = true

    // Нижня пряма перекладина (Nuki)
    const lowerBeam = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.2, 0.25), toriiRedMaterial)
    lowerBeam.position.set(0, 3.4, 0)
    lowerBeam.castShadow = true

    // Табличка святилища посередині (Gakuzuka)
    const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.6, 0.08), darkCedarMaterial)
    tablet.position.set(0, 3.75, 0)
    const tabletGold = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.45, 0.09), goldTrimMaterial)
    tabletGold.position.set(0, 3.75, 0)

    torii.add(leftPillar, rightPillar, leftBase, rightBase, topBeam, capBeam, lowerBeam, tablet, tabletGold)
    torii.position.z = zPos
    torii.scale.set(scale, scale, scale)
    return torii
}

const mainTorii = createTorii(4.2, 1.0)
const secondTorii = createTorii(7.0, 1.15)
shrineGroup.add(mainTorii, secondTorii)

// 3. Храм-Пагода святилища (Shinto Shrine Pagoda)
const pagoda = new THREE.Group()
pagoda.position.set(0, 0, -4.8)

// Кам'яно-дерев'яний піднятий фундамент (Box)
const foundation = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.6, 4.6), darkCedarMaterial)
foundation.position.y = 0.3
foundation.receiveShadow = true
foundation.castShadow = true

// Сходи святилища
const stepGeo = new THREE.BoxGeometry(1.6, 0.15, 0.4)
for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(stepGeo, darkCedarMaterial)
    step.position.set(0, 0.08 + i * 0.15, 2.4 - i * 0.35)
    step.receiveShadow = true
    step.castShadow = true
    pagoda.add(step)
}

// Головна зала першого ярусу (Стіни Сьодзі + кедрові балки)
const mainHall = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.8, 3.6), shojiPaperMaterial)
mainHall.position.y = 1.5
mainHall.castShadow = true
mainHall.receiveShadow = true

// Кутові колони святилища
const pillarMat = toriiRedMaterial
for (let x of [-1.75, 1.75]) {
    for (let z of [-1.75, 1.75]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.8, 8), pillarMat)
        p.position.set(x, 1.5, z)
        p.castShadow = true
        pagoda.add(p)
    }
}

// Матеріал дахів пагоди (повний PBR набір карт)
const pagodaRoofMaterial = new THREE.MeshStandardMaterial({
    map: roofColorTexture,
    aoMap: roofARMTexture,
    roughnessMap: roofARMTexture,
    metalnessMap: roofARMTexture,
    normalMap: roofNormalTexture,
    roughness: 0.75
})

// Перший ярусний дах пагоди (ConeGeometry 4 грані з черепицею)
const lowerRoof = new THREE.Mesh(
    new THREE.ConeGeometry(3.8, 1.2, 4),
    pagodaRoofMaterial
)
lowerRoof.rotation.y = Math.PI * 0.25
lowerRoof.position.y = 2.8
lowerRoof.castShadow = true

// Другий ярус святилища
const upperHall = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 2.4), shojiPaperMaterial)
upperHall.position.y = 3.9
upperHall.castShadow = true

// Верхній дах пагоди
const upperRoof = new THREE.Mesh(
    new THREE.ConeGeometry(2.8, 1.0, 4),
    pagodaRoofMaterial
)
upperRoof.rotation.y = Math.PI * 0.25
upperRoof.position.y = 4.8
upperRoof.castShadow = true

// Золотий шпиль пагоди (Sorin)
const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.1, 1.4, 8), goldTrimMaterial)
spire.position.y = 5.8
spire.castShadow = true

pagoda.add(foundation, mainHall, lowerRoof, upperHall, upperRoof, spire)
shrineGroup.add(pagoda)

// 4. Традиційні кам'яні ліхтарі Торо (Tōrō Lanterns)
function createToroLantern(x, z) {
    const toro = new THREE.Group()

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.6), stoneLanternMaterial)
    base.position.y = 0.15
    base.castShadow = true

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.0, 8), stoneLanternMaterial)
    pole.position.y = 0.8
    pole.castShadow = true

    // Середня світлова камера (Hibukuro)
    const chamber = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.45, 0.48), shojiPaperMaterial)
    chamber.position.y = 1.45
    chamber.castShadow = true

    // Шапка ліхтаря (Kasa)
    const roofToro = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.35, 4), stoneLanternMaterial)
    roofToro.rotation.y = Math.PI * 0.25
    roofToro.position.y = 1.85
    roofToro.castShadow = true

    // Тепле світло свічки всередині
    const candleLight = new THREE.PointLight('#ff9922', 1.8, 4)
    candleLight.position.y = 1.45
    toro.add(candleLight)

    toro.add(base, pole, chamber, roofToro)
    toro.position.set(x, 0, z)
    return toro
}

shrineGroup.add(createToroLantern(-1.5, 2.2))
shrineGroup.add(createToroLantern(1.5, 2.2))
shrineGroup.add(createToroLantern(-1.5, -2.5))
shrineGroup.add(createToroLantern(1.5, -2.5))

// 5. Дзен-доріжка з каменів (Stepping Stones)
const stoneGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.08, 10)
for (let i = 0; i < 9; i++) {
    const step = new THREE.Mesh(stoneGeo, stoneLanternMaterial)
    step.position.set((Math.random() - 0.5) * 0.2, 0.04, 3.5 - i * 0.85)
    step.rotation.y = Math.random() * Math.PI
    step.scale.set(1.0 + Math.random() * 0.3, 1.0, 1.0 + Math.random() * 0.3)
    step.receiveShadow = true
    scene.add(step)
}

// 6. Природні валуни саду каміння (Dodecahedron)
const boulderGeo = new THREE.DodecahedronGeometry(0.5, 1)
const boulderMat = new THREE.MeshStandardMaterial({ color: '#52525b', roughness: 0.8 })
for (let i = 0; i < 16; i++) {
    const boulder = new THREE.Mesh(boulderGeo, boulderMat)
    const angle = Math.random() * Math.PI * 2
    const radius = 5.5 + Math.random() * 6.0
    boulder.position.set(Math.cos(angle) * radius, 0.2 + Math.random() * 0.15, Math.sin(angle) * radius)
    boulder.rotation.set(Math.random(), Math.random(), Math.random())
    const s = 0.6 + Math.random() * 0.9
    boulder.scale.set(s, s * 0.7, s)
    boulder.castShadow = true
    boulder.receiveShadow = true
    scene.add(boulder)
}

/**
 * ========================================================================
 * 4. КАСТОМНИЙ GLSL ШЕЙДЕР: СВЯЩЕННИЙ СТАВОК ДЗЕН (ZEN WATER & CAUSTICS)
 * ========================================================================
 */
const waterParams = {
    colorDeep: '#0f3c4c',
    colorShallow: '#38bdf8',
    waveSpeed: 1.2,
    waveHeight: 0.06,
    opacity: 0.88
}

const waterMaterial = new THREE.ShaderMaterial({
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
        uTime: { value: 0 },
        uWaveSpeed: { value: waterParams.waveSpeed },
        uWaveHeight: { value: waterParams.waveHeight },
        uColorDeep: { value: new THREE.Color(waterParams.colorDeep) },
        uColorShallow: { value: new THREE.Color(waterParams.colorShallow) },
        uSunPosition: { value: new THREE.Vector3(8, 12, 6) },
        uOpacity: { value: waterParams.opacity }
    }
})

// Поверхня ставка (густа PlaneGeometry для плавної водної хвилі)
const pondWater = new THREE.Mesh(
    new THREE.PlaneGeometry(5.8, 5.8, 64, 64),
    waterMaterial
)
pondWater.rotation.x = -Math.PI * 0.5
pondWater.position.set(4.8, 0.08, 0.5)
scene.add(pondWater)

// Кам'яні береги навколо ставка (кільце природного каміння)
const pondRocks = new THREE.Group()
for (let i = 0; i < 28; i++) {
    const angle = (i / 28) * Math.PI * 2
    const r = 2.7 + (Math.sin(angle * 4) * 0.25)
    const rock = new THREE.Mesh(boulderGeo, stoneLanternMaterial)
    rock.position.set(4.8 + Math.cos(angle) * r, 0.12, 0.5 + Math.sin(angle) * r)
    rock.scale.set(0.65, 0.45, 0.65)
    rock.castShadow = true
    rock.receiveShadow = true
    pondRocks.add(rock)
}
scene.add(pondRocks)

// Червоний вигнутий японський місток через край ставка (Taiko-bashi)
const bridge = new THREE.Group()
bridge.position.set(4.8, 0.1, -1.8)

const bridgeArc = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.14, 8, 24, Math.PI * 0.4),
    toriiRedMaterial
)
bridgeArc.rotation.z = Math.PI * 0.3
bridgeArc.position.y = -1.2
bridgeArc.castShadow = true

const railLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8), darkCedarMaterial)
railLeft.rotation.z = Math.PI * 0.5
railLeft.position.set(0, 0.6, 0.4)
railLeft.castShadow = true

const railRight = railLeft.clone()
railRight.position.z = -0.4

bridge.add(bridgeArc, railLeft, railRight)
scene.add(bridge)

/**
 * ========================================================================
 * 5. СКЛАДНІ 3D МОДЕЛІ (GLTF/GLB) ТА ANIMATION MIXER
 * ========================================================================
 */

// 1. Священна лисиця Кіцуне (fox.glb)
let foxModel = null
let foxMixer = null
let foxActions = {}
let currentFoxAction = null
let foxAnimName = 'walk'

gltfLoader.load(
    './models/fox.glb',
    (gltf) => {
        foxModel = gltf.scene
        foxModel.scale.set(0.018, 0.018, 0.018)

        foxModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true
                child.receiveShadow = true
            }
        })
        scene.add(foxModel)

        if (gltf.animations && gltf.animations.length > 0) {
            foxMixer = new THREE.AnimationMixer(foxModel)
            gltf.animations.forEach((clip) => {
                foxActions[clip.name] = foxMixer.clipAction(clip)
            })

            // 0: Survey, 1: Walk, 2: Run
            const defaultClip = gltf.animations[1] ? gltf.animations[1].name : gltf.animations[0].name
            currentFoxAction = foxActions[defaultClip]
            foxAnimName = defaultClip
            currentFoxAction.play()
        }

        // GUI налаштування лисиці
        const foxFolder = gui.addFolder('🦊 Дух Лисиці Кіцуне')
        const animList = Object.keys(foxActions)
        if (animList.length > 0) {
            const foxCtrl = { animation: foxAnimName }
            foxFolder.add(foxCtrl, 'animation', animList).name('Анімація').onChange((name) => {
                if (foxActions[name] && currentFoxAction !== foxActions[name]) {
                    const nextAction = foxActions[name]
                    currentFoxAction.crossFadeTo(nextAction, 0.4, true)
                    nextAction.play()
                    currentFoxAction = nextAction
                    foxAnimName = name
                }
            })
        }
    },
    undefined,
    (err) => console.log('Fox load info:', err)
)

// 2. Качечка, що пливе у ставку Дзен (duck.glb)
let duckModel = null
gltfLoader.load(
    './models/duck.glb',
    (gltf) => {
        duckModel = gltf.scene
        duckModel.scale.set(0.35, 0.35, 0.35)
        duckModel.position.set(4.8, 0.12, 0.5)

        duckModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true
                child.receiveShadow = true
            }
        })
        scene.add(duckModel)
    },
    undefined,
    (err) => console.log('Duck load info:', err)
)

// 3. Високополігональна скульптура Храмового Дракона (dragon.glb — 91,216 трикутників!)
const dragonPedestal = new THREE.Group()
dragonPedestal.position.set(-4.4, 0, -0.8)

const pedestalBase = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.35, 2.6), darkCedarMaterial)
pedestalBase.position.y = 0.175
pedestalBase.castShadow = true
pedestalBase.receiveShadow = true

const pedestalStep = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 0.45, 8), stoneLanternMaterial)
pedestalStep.position.y = 0.575
pedestalStep.castShadow = true
pedestalStep.receiveShadow = true

const pedestalRing = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.045, 12, 32), goldTrimMaterial)
pedestalRing.rotation.x = Math.PI * 0.5
pedestalRing.position.y = 0.8
pedestalRing.castShadow = true

const dragonLight = new THREE.PointLight('#fbbf24', 2.8, 6.5)
dragonLight.position.set(0.6, 3.0, 0.8)

dragonPedestal.add(pedestalBase, pedestalStep, pedestalRing, dragonLight)
scene.add(dragonPedestal)

let dragonMesh = null
let dragonNativeMaterial = null
const dragonConfig = {
    materialPreset: 'Бурштиновий кришталь (Transmission)',
    autoRotate: false
}

const dragonJadeMaterial = new THREE.MeshPhysicalMaterial({
    color: '#059669',
    roughness: 0.12,
    metalness: 0.0,
    transmission: 0.65,
    thickness: 1.5,
    ior: 1.55,
    attenuationColor: new THREE.Color('#10b981'),
    attenuationDistance: 0.8,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08
})

const dragonGoldMaterial = new THREE.MeshPhysicalMaterial({
    color: '#fbbf24',
    roughness: 0.18,
    metalness: 0.95,
    clearcoat: 0.7,
    clearcoatRoughness: 0.1
})

gltfLoader.load(
    './models/dragon.glb',
    (gltf) => {
        const dragonRoot = gltf.scene

        // Видаляємо фонове полотно зі стандартного семпла, залишаючи лише скульптуру Дракона
        const toRemove = []
        dragonRoot.traverse((child) => {
            if (child.isMesh) {
                if (child.name && child.name.toLowerCase().includes('cloth')) {
                    toRemove.push(child)
                } else {
                    dragonMesh = child
                    dragonNativeMaterial = child.material
                    child.castShadow = true
                    child.receiveShadow = true
                }
            }
        })
        toRemove.forEach((m) => m.parent && m.parent.remove(m))

        // Автоматичне масштабування та точна посадка на верхівку кам'яного постаменту
        dragonRoot.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(dragonRoot)
        const size = new THREE.Vector3()
        box.getSize(size)
        const maxDim = Math.max(size.x, size.y, size.z)
        if (maxDim > 0) {
            const s = 2.4 / maxDim
            dragonRoot.scale.multiplyScalar(s)
        }

        dragonRoot.updateMatrixWorld(true)
        const scaledBox = new THREE.Box3().setFromObject(dragonRoot)
        const center = new THREE.Vector3()
        scaledBox.getCenter(center)

        dragonRoot.position.x -= center.x
        dragonRoot.position.z -= center.z
        dragonRoot.position.y -= scaledBox.min.y - 0.82

        dragonPedestal.add(dragonRoot)
        dragonPedestal.rotation.y = Math.PI * 0.25

        // GUI налаштування хай-полі Дракона та складних матеріалів
        const dragonFolder = gui.addFolder('🐉 Хай-полі Дракон (91k трикутників)')
        dragonFolder.add(dragonConfig, 'materialPreset', [
            'Бурштиновий кришталь (Transmission)',
            'Священний нефрит (Jade Physical)',
            'Імператорське золото (PBR Metal)'
        ]).name('Матеріал').onChange((preset) => {
            if (!dragonMesh) return
            if (preset.includes('кришталь')) dragonMesh.material = dragonNativeMaterial
            else if (preset.includes('нефрит')) dragonMesh.material = dragonJadeMaterial
            else dragonMesh.material = dragonGoldMaterial
        })
        dragonFolder.add(dragonConfig, 'autoRotate').name('Обертати постамент')
    },
    undefined,
    (err) => console.log('Dragon load info:', err)
)

/**
 * ========================================================================
 * 6. АТМОСФЕРА: ПЕЛЮСТКИ САКУРИ ТА ЗОЛОТІ СВІТЛЯЧКИ
 * ========================================================================
 */
const sakura = new SakuraParticles(scene, 380)

/**
 * ========================================================================
 * 7. ОСВІТЛЕННЯ (LIGHTING) ТА ТІНІ (SHADOWS)
 * ========================================================================
 */

// 1. Тепле золотисте сонце (DirectionalLight)
const sun = new THREE.DirectionalLight('#ffe6cc', 2.0)
sun.position.set(8, 12, 6)
sun.castShadow = true

// Оптимізація камери тіней
sun.shadow.mapSize.width = 1024
sun.shadow.mapSize.height = 1024
sun.shadow.camera.near = 1
sun.shadow.camera.far = 30
sun.shadow.camera.top = 11
sun.shadow.camera.right = 11
sun.shadow.camera.bottom = -11
sun.shadow.camera.left = -11
sun.shadow.bias = -0.0005
sun.shadow.normalBias = 0.02
scene.add(sun)

// 2. Ніжно-рожевий розсіяний ембієнт (AmbientLight)
const ambientLight = new THREE.AmbientLight('#ffd8e4', 0.6)
scene.add(ambientLight)

// 3. Тепле сяйво всередині пагоди (PointLight)
const shrineLight = new THREE.PointLight('#ff9922', 3.2, 7)
shrineLight.position.set(0, 1.8, -4.8)
shrineGroup.add(shrineLight)

// М'який вечірній серпанок
scene.fog = new THREE.FogExp2('#241520', 0.018)

/**
 * ========================================================================
 * 8. КАМЕРА, КОНТРОЛЕРИ ТА ЯКІСНИЙ РЕНДЕРЕР
 * ========================================================================
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () => {
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

const camera = new THREE.PerspectiveCamera(65, sizes.width / sizes.height, 0.1, 120)
camera.position.set(7.5, 4.8, 8.5)
scene.add(camera)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.dampingFactor = 0.05
controls.maxPolarAngle = Math.PI / 2 - 0.04
controls.minDistance = 2.5
controls.maxDistance = 30
controls.target.set(0, 1.2, 0)

const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    powerPreference: 'high-performance'
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

// М'які тіні
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

// Тонове відображення ACES Filmic
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.15
renderer.outputColorSpace = THREE.SRGBColorSpace

// Карта оточення (IBL) для реалістичних бліків на лакованих, металевих і скляних матеріалах
const pmremGenerator = new THREE.PMREMGenerator(renderer)
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture
scene.environmentIntensity = 0.55
pmremGenerator.dispose()

/**
 * ========================================================================
 * 9. LIL-GUI
 * ========================================================================
 */
const waterFolder = gui.addFolder('💧 Священний ставок (Шейдер GLSL)')
waterFolder.add(waterParams, 'waveSpeed').min(0.2).max(4.0).step(0.1).name('Швидкість хвиль').onChange(v => {
    waterMaterial.uniforms.uWaveSpeed.value = v
})
waterFolder.add(waterParams, 'waveHeight').min(0.01).max(0.18).step(0.01).name('Висота хвиль').onChange(v => {
    waterMaterial.uniforms.uWaveHeight.value = v
})
waterFolder.addColor(waterParams, 'colorDeep').name('Глибина води').onChange(c => {
    waterMaterial.uniforms.uColorDeep.value.set(c)
})
waterFolder.addColor(waterParams, 'colorShallow').name('Мілководдя').onChange(c => {
    waterMaterial.uniforms.uColorShallow.value.set(c)
})

const physicsFolder = gui.addFolder('🪨 Дзен-Фізика (Cannon-es)')
const physActions = {
    spawnStone: () => physics.spawnObject('stone'),
    spawnLantern: () => physics.spawnObject('lantern'),
    spawnWood: () => physics.spawnObject('wood'),
    clear: () => physics.clearAll()
}
physicsFolder.add(physActions, 'spawnStone').name('🪨 Дзен-камінь [SPACE]')
physicsFolder.add(physActions, 'spawnLantern').name('🏮 Паперовий ліхтарик')
physicsFolder.add(physActions, 'spawnWood').name('🪵 Сакурова куля')
physicsFolder.add(physActions, 'clear').name('🧹 Очистити сад')

const renderFolder = gui.addFolder('🌅 Рендер та освітлення')
renderFolder.add(renderer, 'toneMappingExposure').min(0.5).max(2.5).step(0.05).name('Експозиція')
renderFolder.add(sun, 'intensity').min(0.5).max(3.5).step(0.1).name('Яскравість Сонця')

/**
 * ========================================================================
 * 10. ІНТЕРАКТИВНІСТЬ ТА ПОДІЇ
 * ========================================================================
 */

function throwObjectFromCamera(type = 'stone') {
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    const origin = camera.position.clone().add(dir.clone().multiplyScalar(1.2))
    physics.spawnObject(type, origin, dir)

    const counter = document.getElementById('physics-count')
    if (counter) counter.textContent = physics.objectsToUpdate.length
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault()
        throwObjectFromCamera('stone')
    }
})

// Кнопки інтерфейсу
const btnStone = document.getElementById('btn-spawn-stone')
if (btnStone) btnStone.addEventListener('click', () => throwObjectFromCamera('stone'))

const btnLantern = document.getElementById('btn-spawn-lantern')
if (btnLantern) btnLantern.addEventListener('click', () => throwObjectFromCamera('lantern'))

const btnWood = document.getElementById('btn-spawn-wood')
if (btnWood) btnWood.addEventListener('click', () => throwObjectFromCamera('wood'))

// Сплеск водної хвилі у ставку
const btnWaterSurge = document.getElementById('btn-water-surge')
if (btnWaterSurge) {
    btnWaterSurge.addEventListener('click', () => {
        waterMaterial.uniforms.uWaveHeight.value = 0.16
        waterMaterial.uniforms.uWaveSpeed.value = 3.5

        setTimeout(() => {
            waterMaterial.uniforms.uWaveHeight.value = waterParams.waveHeight
            waterMaterial.uniforms.uWaveSpeed.value = waterParams.waveSpeed
        }, 1500)
    })
}

// Кнопка GUI
const btnToggleGui = document.getElementById('btn-toggle-gui')
if (btnToggleGui) {
    btnToggleGui.addEventListener('click', () => {
        if (gui._hidden) gui.show()
        else gui.hide()
    })
}

/**
 * ========================================================================
 * 11. ГОЛОВНИЙ ЦИКЛ АНІМАЦІЇ ТА РЕНДЕРИНГУ (TICK)
 * ========================================================================
 */
const timer = new Timer()

const tick = () => {
    timer.update()
    const elapsedTime = timer.getElapsed()
    const deltaTime = timer.getDelta()

    // 1. Оновлення кастомного GLSL шейдера води
    waterMaterial.uniforms.uTime.value = elapsedTime

    // 2. Оновлення AnimationMixer лисиці
    if (foxMixer) foxMixer.update(deltaTime)

    // 3. Граціозне пересування лисиці Кіцуне по саду (між Торіями та храмом)
    if (foxModel) {
        let speed = 0.0
        if (foxAnimName.toLowerCase().includes('walk')) speed = 0.35
        else if (foxAnimName.toLowerCase().includes('run')) speed = 0.85

        if (speed > 0) {
            const t = elapsedTime * speed
            // Плавний маршрут патрулювання саду
            const posX = Math.sin(t) * 2.8
            const posZ = 1.0 + Math.cos(t) * 3.8

            const nextT = t + 0.04
            const nextX = Math.sin(nextT) * 2.8
            const nextZ = 1.0 + Math.cos(nextT) * 3.8

            foxModel.position.set(posX, 0, posZ)
            foxModel.lookAt(nextX, 0, nextZ)
        }
    }

    // 4. Плавання качечки по колу в ставку Дзен
    if (duckModel) {
        const duckAngle = elapsedTime * 0.4
        const duckR = 1.4
        const dx = 4.8 + Math.cos(duckAngle) * duckR
        const dz = 0.5 + Math.sin(duckAngle) * duckR
        duckModel.position.set(dx, 0.09 + Math.sin(elapsedTime * 2.0) * 0.015, dz)

        // Качечка дивиться вперед за курсом плавання
        const nextAngle = duckAngle + 0.05
        const ndx = 4.8 + Math.cos(nextAngle) * duckR
        const ndz = 0.5 + Math.sin(nextAngle) * duckR
        duckModel.lookAt(ndx, duckModel.position.y, ndz)
    }

    // 5. Оновлення падіння пелюсток сакури та світлячків
    sakura.update(elapsedTime)

    // 5.1. Поворот постаменту Дракона (якщо увімкнено) та м'яке сяйво
    if (dragonConfig.autoRotate) {
        dragonPedestal.rotation.y += deltaTime * 0.45
    }
    dragonLight.intensity = 2.6 + Math.sin(elapsedTime * 2.2) * 0.35

    // 6. Оновлення Дзен-фізики Cannon-es
    physics.update(deltaTime)

    // 7. Контролери та рендеринг кадру
    controls.update()
    renderer.render(scene, camera)

    window.requestAnimationFrame(tick)
}

tick()
