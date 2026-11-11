import * as CANNON from 'cannon-es'
import * as THREE from 'three'

/**
 * ========================================================================
 * МОДУЛЬ ФІЗИКИ: ДЗЕН-САД ТА БАЛАНСУВАННЯ КАМІННЯ (CANNON-ES)
 * ========================================================================
 * 
 * 1. Земна гравітація: g = -9.82 м/с²
 * 2. Статичні колайдери: земля саду, ворота Торії, пагода, кам'яні ліхтарі
 * 3. Динамічний спавн: гладкі річкові камені дзен, дерев'яні кулі та ліхтарики
 */

export class ZenPhysicsEngine {
    constructor(scene) {
        this.scene = scene
        this.objectsToUpdate = []

        // Фізичний світ
        this.world = new CANNON.World()
        this.world.gravity.set(0, -9.82, 0)

        // SAPBroadphase для високої продуктивності
        this.world.broadphase = new CANNON.SAPBroadphase(this.world)
        this.world.allowSleep = true

        // Матеріали контактів
        this.groundMaterial = new CANNON.Material('ground')
        this.stoneMaterial = new CANNON.Material('stone')
        this.lanternMaterial = new CANNON.Material('lantern')

        // Каміння об каміння / землю (пружний глухий відскок річкової гальки)
        const stoneContact = new CANNON.ContactMaterial(
            this.stoneMaterial,
            this.groundMaterial,
            {
                friction: 0.6,
                restitution: 0.35 // Справжній камінь пружно осідає без надмірного відскоку
            }
        )

        const stoneOnStoneContact = new CANNON.ContactMaterial(
            this.stoneMaterial,
            this.stoneMaterial,
            {
                friction: 0.7, // Високе тертя дозволяє будувати вежі з каміння (дзэн-баланс)!
                restitution: 0.25
            }
        )

        this.world.addContactMaterial(stoneContact)
        this.world.addContactMaterial(stoneOnStoneContact)
        this.world.defaultContactMaterial = stoneContact

        // Спільні геометрії для Three.js
        this.riverStoneGeo = new THREE.CylinderGeometry(0.38, 0.42, 0.16, 14)
        this.riverStoneGeo.scale(1.0, 1.0, 0.8) // Сплюснута форма гальки
        this.stoneMat = new THREE.MeshStandardMaterial({
            color: '#475569',
            roughness: 0.6,
            metalness: 0.15
        })

        this.woodOrbGeo = new THREE.SphereGeometry(0.3, 16, 16)
        this.woodMat = new THREE.MeshStandardMaterial({
            color: '#b45309',
            roughness: 0.7,
            metalness: 0.1
        })

        this.lanternGeo = new THREE.BoxGeometry(0.45, 0.55, 0.45)
        this.lanternMat = new THREE.MeshStandardMaterial({
            color: '#fffbeb',
            emissive: '#f59e0b',
            emissiveIntensity: 1.2,
            roughness: 0.4
        })

        this.initStaticColliders()
    }

    initStaticColliders() {
        // Підлога саду
        const floorShape = new CANNON.Plane()
        const floorBody = new CANNON.Body({
            mass: 0,
            shape: floorShape,
            material: this.groundMaterial
        })
        floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI * 0.5)
        this.world.addBody(floorBody)

        // Колайдер головного святилища / пагоди (Box)
        const shrineShape = new CANNON.Box(new CANNON.Vec3(2.0, 1.4, 2.0))
        const shrineBody = new CANNON.Body({
            mass: 0,
            shape: shrineShape,
            position: new CANNON.Vec3(0, 1.4, -4.5),
            material: this.groundMaterial
        })
        this.world.addBody(shrineBody)

        // Колонни воріт Торії (2 циліндричні опори)
        this.addCylinderCollider(new THREE.Vector3(-1.8, 1.8, 3.5), 0.22, 3.6)
        this.addCylinderCollider(new THREE.Vector3(1.8, 1.8, 3.5), 0.22, 3.6)

        // Колайдер постаменту хай-полі Дракона
        const dragonPedestalBody = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Box(new CANNON.Vec3(1.3, 1.2, 1.3)),
            position: new CANNON.Vec3(-4.4, 1.2, -0.8),
            material: this.groundMaterial
        })
        this.world.addBody(dragonPedestalBody)
    }

    addCylinderCollider(position, radius, height) {
        const shape = new CANNON.Cylinder(radius, radius, height, 12)
        const body = new CANNON.Body({
            mass: 0,
            shape: shape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            material: this.groundMaterial
        })
        this.world.addBody(body)
    }

    spawnObject(type = 'stone', originPos = null, direction = null) {
        let mesh = null
        let body = null

        if (type === 'lantern') {
            mesh = new THREE.Mesh(this.lanternGeo, this.lanternMat.clone())
            const light = new THREE.PointLight('#f59e0b', 2.0, 4)
            mesh.add(light)

            const shape = new CANNON.Box(new CANNON.Vec3(0.22, 0.27, 0.22))
            body = new CANNON.Body({
                mass: 0.8,
                shape: shape,
                material: this.lanternMaterial
            })
        } else if (type === 'wood') {
            mesh = new THREE.Mesh(this.woodOrbGeo, this.woodMat)
            const shape = new CANNON.Sphere(0.3)
            body = new CANNON.Body({
                mass: 1.5,
                shape: shape,
                material: this.stoneMaterial
            })
        } else {
            // Річковий камінь Дзен
            mesh = new THREE.Mesh(this.riverStoneGeo, this.stoneMat.clone())
            // Різні природні відтінки сірого та охри
            const colors = ['#334155', '#475569', '#64748b', '#57534e']
            mesh.material.color.set(colors[Math.floor(Math.random() * colors.length)])

            const shape = new CANNON.Cylinder(0.4, 0.4, 0.16, 10)
            body = new CANNON.Body({
                mass: 2.8,
                shape: shape,
                material: this.stoneMaterial
            })
        }

        mesh.castShadow = true
        mesh.receiveShadow = true
        this.scene.add(mesh)

        if (originPos) {
            body.position.copy(originPos)
        } else {
            // Скидання з повітря над садом
            body.position.set(
                (Math.random() - 0.5) * 4,
                5 + Math.random() * 2,
                (Math.random() - 0.5) * 4
            )
        }

        mesh.position.copy(body.position)

        if (direction) {
            body.applyImpulse(
                new CANNON.Vec3(direction.x * 12, direction.y * 12 + 2.5, direction.z * 12),
                new CANNON.Vec3(0, 0, 0)
            )
        } else {
            body.applyImpulse(
                new CANNON.Vec3((Math.random() - 0.5) * 3, 1.5, (Math.random() - 0.5) * 3),
                new CANNON.Vec3(0, 0, 0)
            )
        }

        body.angularVelocity.set(
            (Math.random() - 0.5) * 6,
            (Math.random() - 0.5) * 6,
            (Math.random() - 0.5) * 6
        )

        this.world.addBody(body)
        this.objectsToUpdate.push({ mesh, body })

        if (this.objectsToUpdate.length > 40) {
            const oldest = this.objectsToUpdate.shift()
            this.scene.remove(oldest.mesh)
            this.world.removeBody(oldest.body)
        }

        return mesh
    }

    clearAll() {
        for (const item of this.objectsToUpdate) {
            this.scene.remove(item.mesh)
            this.world.removeBody(item.body)
        }
        this.objectsToUpdate = []
    }

    update(deltaTime) {
        this.world.step(1 / 60, deltaTime, 3)

        for (const item of this.objectsToUpdate) {
            item.mesh.position.copy(item.body.position)
            item.mesh.quaternion.copy(item.body.quaternion)
        }
    }
}
