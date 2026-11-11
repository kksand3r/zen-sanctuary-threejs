import * as THREE from 'three'

/**
 * ========================================================================
 * МОДУЛЬ ЧАСТОК: ПЕЛЮСТКИ САКУРИ ТА ЗОЛОТИСТІ СВІТЛЯЧКИ (SAKURA PETALS)
 * ========================================================================
 */

export class SakuraParticles {
    constructor(scene, count = 380) {
        this.scene = scene
        this.count = count

        this.positions = new Float32Array(count * 3)
        this.colors = new Float32Array(count * 3)
        this.speeds = new Float32Array(count)
        this.sways = new Float32Array(count)
        this.rotations = new Float32Array(count)

        const sakuraColors = [
            new THREE.Color('#ffb7c5'), // Класичний ніжно-рожевий сакури
            new THREE.Color('#ff9ebb'), // Насичений рожевий
            new THREE.Color('#ffe4e1'), // Сніжно-рожевий
            new THREE.Color('#ffccd5')  // Пастельний колір цвіту
        ]

        for (let i = 0; i < count; i++) {
            const i3 = i * 3
            // Розподіл часток над садом
            this.positions[i3 + 0] = (Math.random() - 0.5) * 24
            this.positions[i3 + 1] = Math.random() * 8 + 0.2
            this.positions[i3 + 2] = (Math.random() - 0.5) * 24

            this.speeds[i] = 0.4 + Math.random() * 0.6
            this.sways[i] = 0.5 + Math.random() * 1.5
            this.rotations[i] = Math.random() * Math.PI * 2

            const col = sakuraColors[Math.floor(Math.random() * sakuraColors.length)]
            this.colors[i3 + 0] = col.r
            this.colors[i3 + 1] = col.g
            this.colors[i3 + 2] = col.b
        }

        this.geometry = new THREE.BufferGeometry()
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

        this.material = new THREE.PointsMaterial({
            size: 0.14,
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            depthWrite: false
        })

        this.points = new THREE.Points(this.geometry, this.material)
        this.scene.add(this.points)

        // 2. Золотисті світлячки навколо кам'яних ліхтарів (60 штук)
        this.initFireflies(60)
    }

    initFireflies(count) {
        this.fireflyCount = count
        const fPos = new Float32Array(count * 3)
        this.fBaseY = new Float32Array(count)

        for (let i = 0; i < count; i++) {
            const i3 = i * 3
            const angle = Math.random() * Math.PI * 2
            const r = 2.0 + Math.random() * 7.0
            fPos[i3 + 0] = Math.cos(angle) * r
            const y = 0.4 + Math.random() * 2.2
            fPos[i3 + 1] = y
            this.fBaseY[i] = y
            fPos[i3 + 2] = Math.sin(angle) * r
        }

        this.fireflyGeo = new THREE.BufferGeometry()
        this.fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3))

        const fMat = new THREE.PointsMaterial({
            size: 0.08,
            color: '#ffd166',
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })

        this.fireflies = new THREE.Points(this.fireflyGeo, fMat)
        this.scene.add(this.fireflies)
    }

    update(elapsedTime) {
        // Оновлення падіння та вальсування пелюсток сакури
        const pos = this.geometry.attributes.position.array

        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3

            // Повільне падіння донизу
            pos[i3 + 1] -= this.speeds[i] * 0.015

            // Якщо пелюстка торкнулася землі — повертаємо її вгору
            if (pos[i3 + 1] < 0.05) {
                pos[i3 + 1] = 8.0 + Math.random() * 2.0
                pos[i3 + 0] = (Math.random() - 0.5) * 24
                pos[i3 + 2] = (Math.random() - 0.5) * 24
            }

            // Плавне погойдування вітром (гармонійний рух)
            pos[i3 + 0] += Math.sin(elapsedTime * this.sways[i] + i) * 0.008 + 0.004 // легкий дрейф за вітром
            pos[i3 + 2] += Math.cos(elapsedTime * (this.sways[i] * 0.8) + i) * 0.006
        }
        this.geometry.attributes.position.needsUpdate = true

        // Оновлення світлячків
        if (this.fireflyGeo) {
            const fPos = this.fireflyGeo.attributes.position.array
            for (let i = 0; i < this.fireflyCount; i++) {
                const i3 = i * 3
                fPos[i3 + 1] = this.fBaseY[i] + Math.sin(elapsedTime * 2.0 + i) * 0.25
                fPos[i3 + 0] += Math.cos(elapsedTime * 0.6 + i) * 0.004
                fPos[i3 + 2] += Math.sin(elapsedTime * 0.6 + i) * 0.004
            }
            this.fireflyGeo.attributes.position.needsUpdate = true
        }
    }
}
