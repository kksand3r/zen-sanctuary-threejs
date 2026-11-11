/**
 * ========================================================================
 * КАСТОМНИЙ GLSL ШЕЙДЕР: СВЯЩЕННИЙ СТАВОК ДЗЕН (ZEN WATER & CAUSTICS)
 * ========================================================================
 * 
 * 1. VERTEX SHADER:
 * - Створює плавні хвилі на поверхні води за допомогою суми гармонійних синусоїд
 * - Розраховує динамічну нормаль хвилі для віддзеркалення світла
 */
export const waterVertexShader = /* glsl */ `
uniform float uTime;
uniform float uWaveSpeed;
uniform float uWaveHeight;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
    vUv = uv;
    vec3 transformed = position;

    // Композиція гармонійних хвиль по осях X та Z
    float wave1 = sin(position.x * 2.8 + uTime * uWaveSpeed * 1.5) * uWaveHeight;
    float wave2 = cos(position.y * 3.2 + uTime * uWaveSpeed * 1.2) * (uWaveHeight * 0.7);
    float wave3 = sin((position.x + position.y) * 2.0 + uTime * uWaveSpeed) * (uWaveHeight * 0.5);

    float totalElevation = wave1 + wave2 + wave3;
    transformed.z += totalElevation; // Для PlaneGeometry вісь Z є локальною висотою

    // Розрахунок деформованої нормалі
    vec3 computedNormal = normalize(vec3(
        -cos(position.x * 2.8 + uTime * uWaveSpeed * 1.5) * 2.8 * uWaveHeight,
        -sin(position.y * 3.2 + uTime * uWaveSpeed * 1.2) * 3.2 * (uWaveHeight * 0.7),
        1.0
    ));
    vNormal = normalize(normalMatrix * computedNormal);

    vec4 worldPos = modelMatrix * vec4(transformed, 1.0);
    vWorldPosition = worldPos.xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`

/**
 * 2. FRAGMENT SHADER:
 * - Процедурна сонячна водна каустика (мерехтіння сонячних променів у воді)
 * - Ефект Френеля: погляд прямо — прозора вода, погляд під кутом — дзеркальне відбиття неба
 * - Спекулярні сонячні відблиски на гребенях хвиль
 * - Плавне згасання по краях водойми
 */
export const waterFragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uColorDeep;
uniform vec3 uColorShallow;
uniform vec3 uSunPosition;
uniform float uOpacity;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;

// Процедурна каустика на базі пересічних синусоїдальних сіток
float getCaustic(vec2 uv, float time) {
    vec2 p = uv * 12.0;
    float c1 = sin(p.x * 1.5 + sin(p.y * 1.2 + time * 1.5));
    float c2 = cos(p.y * 1.8 + cos(p.x * 1.4 - time * 1.3));
    float c3 = sin((p.x + p.y) * 1.3 + time * 1.8);
    float caustic = (c1 + c2 + c3) / 3.0;
    return pow(max(caustic, 0.0), 3.0) * 2.2;
}

void main() {
    // Вектор погляду камери
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 normal = normalize(vNormal);

    // 1. Ефект Френеля для води
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);

    // 2. Розрахунок сонячного відблиску (Specular Highlight)
    vec3 lightDir = normalize(uSunPosition - vWorldPosition);
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 36.0);

    // 3. Процедурна водна каустика
    float caustic = getCaustic(vUv, uTime);

    // 4. Градієнт глибини води
    vec2 centeredUv = vUv - 0.5;
    float dist = length(centeredUv);
    float depthFactor = clamp(dist * 2.0, 0.0, 1.0);

    vec3 waterColor = mix(uColorShallow, uColorDeep, depthFactor);
    waterColor += vec3(1.0, 0.95, 0.8) * caustic * 0.45; // Золотисті промені каустики
    waterColor += vec3(1.0, 0.9, 0.8) * spec * 0.8;      // Сонячний блік

    // Віддзеркалення неба при низькому куті
    vec3 skyReflection = vec3(0.9, 0.75, 0.7);
    waterColor = mix(waterColor, skyReflection, fresnel * 0.65);

    // Плавний альфа-край водойми (кругла або овальна форма)
    float edgeAlpha = smoothstep(0.49, 0.42, dist);

    gl_FragColor = vec4(waterColor, edgeAlpha * uOpacity);
}
`
