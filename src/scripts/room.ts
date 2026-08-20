import * as THREE from 'three';

/* An empty, sun-filled room.
 *
 * The light pool on the floor is not painted on — the left/right wall is built
 * as four solid panels around a real window opening, and every panel casts a
 * shadow. A single directional light shining through that hole produces the
 * parallelogram of sun on the floorboards and the cross of mullion shadows
 * inside it for free, which is what makes the room read as photographic
 * rather than as a gradient.
 *
 * The window sits on the RIGHT so the busy half of the frame (glare, pool,
 * framed print) stays clear of the contact text, which is set on the left.
 */

const canvas = document.getElementById('room') as HTMLCanvasElement | null;
if (canvas) {
  try {
    initRoom(canvas);
  } catch (err) {
    // No WebGL / blocked context: the CSS warm gradient on #room stands in.
    console.warn('[room] falling back to static background:', err);
  }
}

function initRoom(canvas: HTMLCanvasElement) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = window.innerWidth < 760;

  /* ---------- room dimensions ---------- */
  const W = 9;    // x
  const H = 4.4;  // y
  const D = 11;   // z
  const WALL = 0.16;

  // window aperture, in the right-hand wall (x = +W/2)
  const winZ0 = -1.8, winZ1 = 0.8;
  const winY0 = 1.0, winY1 = 3.4;

  /* ---------- renderer ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.75 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf0e6d6, 12, 26);

  /* Portrait gets its own framing. On a phone the text column is nearly full
     width, so the landscape composition put the framed print directly behind
     the phone number. Aiming lower lifts the print clear above the type and
     fills the bottom of the frame with the sun pool instead. */
  const camera = new THREE.PerspectiveCamera(small ? 52 : 42, window.innerWidth / window.innerHeight, 0.1, 60);
  const CAM_BASE = small ? new THREE.Vector3(-1.9, 1.75, 4.6) : new THREE.Vector3(-1.7, 1.62, 4.3);
  const LOOK_BASE = small ? new THREE.Vector3(0.85, 1.15, -3.2) : new THREE.Vector3(0.85, 1.95, -3.2);
  camera.position.copy(CAM_BASE);
  camera.lookAt(LOOK_BASE);

  /* ---------- materials ---------- */
  const plaster = new THREE.MeshStandardMaterial({ color: 0xf3ebdf, roughness: 0.96, metalness: 0 });
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xfaf6ef, roughness: 1, metalness: 0 });
  const floorMat = new THREE.MeshStandardMaterial({ map: makePlankTexture(), roughness: 0.62, metalness: 0 });

  /* ---------- shell ---------- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  ceiling.receiveShadow = true;
  scene.add(ceiling);

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), plaster);
  backWall.position.set(0, H / 2, -D / 2);
  backWall.receiveShadow = true;
  scene.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(D, H), plaster);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-W / 2, H / 2, 0);
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  /* ---------- right wall: four panels around a real opening ---------- */
  function panel(zFrom: number, zTo: number, yFrom: number, yTo: number) {
    const depth = zTo - zFrom;
    const height = yTo - yFrom;
    if (depth <= 0 || height <= 0) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(WALL, height, depth), plaster);
    m.position.set(W / 2 + WALL / 2, (yFrom + yTo) / 2, (zFrom + zTo) / 2);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }
  panel(-D / 2, D / 2, 0, winY0);        // under the sill
  panel(-D / 2, D / 2, winY1, H);        // over the head
  panel(-D / 2, winZ0, winY0, winY1);    // pier, back side
  panel(winZ1, D / 2, winY0, winY1);     // pier, front side

  /* mullions — a cross inside the aperture, so the sun pool is quartered */
  const mullionMat = new THREE.MeshStandardMaterial({ color: 0xe8dccb, roughness: 0.8 });
  const mv = new THREE.Mesh(new THREE.BoxGeometry(WALL * 0.8, winY1 - winY0, 0.07), mullionMat);
  mv.position.set(W / 2 + WALL / 2, (winY0 + winY1) / 2, (winZ0 + winZ1) / 2);
  mv.castShadow = true;
  scene.add(mv);
  const mh = new THREE.Mesh(new THREE.BoxGeometry(WALL * 0.8, 0.07, winZ1 - winZ0), mullionMat);
  mh.position.set(W / 2 + WALL / 2, (winY0 + winY1) / 2, (winZ0 + winZ1) / 2);
  mh.castShadow = true;
  scene.add(mh);

  /* blown-out sky in the aperture — unlit, so it reads as glare */
  const glare = new THREE.Mesh(
    new THREE.PlaneGeometry(winZ1 - winZ0, winY1 - winY0),
    new THREE.MeshBasicMaterial({ color: 0xfffaf0 })
  );
  glare.rotation.y = -Math.PI / 2;
  glare.position.set(W / 2 + WALL, (winY0 + winY1) / 2, (winZ0 + winZ1) / 2);
  scene.add(glare);

  /* ---------- the framed flower print, on the back wall ---------- */
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(1.34, 1.72, 0.07),
    new THREE.MeshStandardMaterial({ color: 0x3b2c21, roughness: 0.55 })
  );
  const PRINT_Y = small ? 2.62 : 2.15;
  frame.position.set(1.15, PRINT_Y, -D / 2 + 0.05);
  frame.castShadow = true;
  frame.receiveShadow = true;
  scene.add(frame);

  const printTex = new THREE.TextureLoader().load('/flower.jpg', () => render());
  printTex.colorSpace = THREE.SRGBColorSpace;
  const print = new THREE.Mesh(
    new THREE.PlaneGeometry(1.16, 1.54),
    new THREE.MeshStandardMaterial({ map: printTex, roughness: 0.5 })
  );
  print.position.set(1.15, PRINT_Y, -D / 2 + 0.09);
  print.receiveShadow = true;
  scene.add(print);

  /* ---------- light ---------- */
  const SUN_POS = new THREE.Vector3(12, 7.5, 3.5);
  const SUN_TARGET = new THREE.Vector3(-1.5, 0, -3);

  const sun = new THREE.DirectionalLight(0xffe6bd, 3.4);
  sun.position.copy(SUN_POS);
  sun.target.position.copy(SUN_TARGET);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  sun.shadow.camera.left = -11;
  sun.shadow.camera.right = 11;
  sun.shadow.camera.top = 11;
  sun.shadow.camera.bottom = -11;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 42;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.024;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  // cool sky fill + warm bounce off the boards, so shadows are never black
  scene.add(new THREE.HemisphereLight(0xdce7f5, 0xc39a66, 1.05));

  // a whisper of fill on the print so it never sinks into the shadow
  const fill = new THREE.PointLight(0xffe9cc, 2.6, 7, 2);
  fill.position.set(1.2, 2.6, -D / 2 + 1.6);
  scene.add(fill);

  /* ---------- dust in the beam ---------- */
  const dust = makeDust();
  scene.add(dust.points);

  /* ---------- interaction ---------- */
  const ptr = { x: 0, y: 0 };
  const ptrTarget = { x: 0, y: 0 };
  let scrollP = 0;

  if (!reduceMotion) {
    window.addEventListener('pointermove', (e) => {
      ptrTarget.x = e.clientX / window.innerWidth - 0.5;
      ptrTarget.y = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });

    window.addEventListener('scroll', () => {
      scrollP = Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
    }, { passive: true });
  }

  window.addEventListener('resize', onResize, { passive: true });
  function onResize() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 760 ? 1.75 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.fov = window.innerWidth < 760 ? 52 : 42;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    if (reduceMotion) render();
  }

  const look = LOOK_BASE.clone();

  function render() {
    renderer.render(scene, camera);
  }

  function frameLoop(t: number) {
    requestAnimationFrame(frameLoop);

    // don't burn battery once the room has scrolled out of view
    if (document.hidden || window.scrollY > window.innerHeight * 1.2) return;

    ptr.x += (ptrTarget.x - ptr.x) * 0.045;
    ptr.y += (ptrTarget.y - ptr.y) * 0.045;

    camera.position.set(
      CAM_BASE.x + ptr.x * 0.55,
      CAM_BASE.y - ptr.y * 0.3 + scrollP * 0.5,
      CAM_BASE.z + scrollP * 1.9
    );
    look.set(LOOK_BASE.x - ptr.x * 0.5, LOOK_BASE.y - scrollP * 0.18, LOOK_BASE.z);
    camera.lookAt(look);

    dust.update(t);
    render();
  }

  if (reduceMotion) {
    render();
  } else {
    requestAnimationFrame(frameLoop);
  }

  /* ---------- helpers ---------- */

  /** Floorboards, drawn once into a canvas — cheaper and sharper than shipping
   *  a wood photo, and it tiles cleanly along the room's length. */
  function makePlankTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d')!;
    g.fillStyle = '#b98f66';
    g.fillRect(0, 0, 512, 512);

    const planks = 7;
    const h = 512 / planks;
    for (let i = 0; i < planks; i++) {
      // per-plank tonal variation
      const v = 0.86 + Math.random() * 0.22;
      g.fillStyle = `rgb(${Math.round(185 * v)},${Math.round(143 * v)},${Math.round(102 * v)})`;
      g.fillRect(0, i * h, 512, h - 1);
      // seam
      g.fillStyle = 'rgba(90,62,40,.32)';
      g.fillRect(0, i * h + h - 1, 512, 1);
      // grain
      for (let j = 0; j < 26; j++) {
        g.strokeStyle = `rgba(120,84,54,${0.03 + Math.random() * 0.05})`;
        g.lineWidth = 0.6 + Math.random();
        g.beginPath();
        const y = i * h + Math.random() * h;
        g.moveTo(0, y);
        g.bezierCurveTo(170, y + (Math.random() - 0.5) * 5, 340, y + (Math.random() - 0.5) * 5, 512, y);
        g.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2.6);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  /** Motes, most of them seeded inside the actual beam volume (the window
   *  rectangle swept along the light direction) so they glitter where the sun
   *  is and stay nearly invisible elsewhere. This is what sells the shaft of
   *  light without any volumetric rendering. */
  function makeDust() {
    const COUNT = small ? 420 : 900;
    const dir = SUN_TARGET.clone().sub(SUN_POS).normalize();

    const pos = new Float32Array(COUNT * 3);
    const alpha = new Float32Array(COUNT);
    const seed = new Float32Array(COUNT);
    const base = new Float32Array(COUNT * 3);

    for (let i = 0; i < COUNT; i++) {
      let x: number, y: number, z: number, a: number;
      if (i % 10 < 7) {
        // inside the shaft
        const zz = winZ0 + Math.random() * (winZ1 - winZ0);
        const yy = winY0 + Math.random() * (winY1 - winY0);
        const sMax = Math.abs(yy / dir.y);
        const s = Math.random() * sMax;
        x = W / 2 + dir.x * s;
        y = yy + dir.y * s;
        z = zz + dir.z * s;
        a = 0.55 + Math.random() * 0.45;
      } else {
        // ambient room dust
        x = (Math.random() - 0.5) * (W - 0.6);
        y = 0.2 + Math.random() * (H - 0.5);
        z = (Math.random() - 0.5) * (D - 0.6);
        a = 0.025 + Math.random() * 0.055;
      }
      base[i * 3] = pos[i * 3] = x;
      base[i * 3 + 1] = pos[i * 3 + 1] = y;
      base[i * 3 + 2] = pos[i * 3 + 2] = z;
      alpha[i] = a;
      seed[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));

    const mat = new THREE.PointsMaterial({
      size: small ? 0.028 : 0.022,
      sizeAttenuation: true,
      color: 0xfff2d8,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // fold the per-point alpha into the shader so beam motes glow and room
    // motes stay faint, without needing a second draw call
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'attribute float aAlpha;\nvarying float vAlpha;\nvoid main() {')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vAlpha = aAlpha;');
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'varying float vAlpha;\nvoid main() {')
        .replace(
          '#include <premultiplied_alpha_fragment>',
          '#include <premultiplied_alpha_fragment>\n  float d = length(gl_PointCoord - vec2(0.5));\n  gl_FragColor.a *= vAlpha * smoothstep(0.5, 0.06, d);'
        );
    };

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;

    return {
      points,
      update(t: number) {
        const arr = geo.getAttribute('position') as THREE.BufferAttribute;
        const time = t * 0.00016;
        for (let i = 0; i < COUNT; i++) {
          const s = seed[i];
          arr.array[i * 3] = base[i * 3] + Math.sin(time + s) * 0.09;
          arr.array[i * 3 + 1] = base[i * 3 + 1] + Math.sin(time * 0.7 + s * 1.7) * 0.06;
          arr.array[i * 3 + 2] = base[i * 3 + 2] + Math.cos(time * 0.85 + s) * 0.09;
        }
        arr.needsUpdate = true;
      },
    };
  }
}
