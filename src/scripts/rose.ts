import * as THREE from 'three';

/* A low-poly rose, generated rather than modelled.
 *
 * Every petal is the same parametric surface — narrow at the base, widest at
 * the shoulder, curling backwards and cupped across its width — instanced ~36
 * times around the stem. Each successive petal is rotated by the golden angle
 * and opened a little further, which is genuinely how a rose packs its petals,
 * so the bloom reads as a rose without anyone hand-modelling one.
 *
 * flatShading is deliberate: it keeps the facets visible so the geometry looks
 * intentionally faceted rather than like a smooth model rendered badly.
 */

const canvas = document.getElementById('scene') as HTMLCanvasElement | null;
if (canvas) {
  try {
    initRose(canvas);
  } catch (err) {
    console.warn('[rose] falling back to static background:', err);
  }
}

type Petal = {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  /** scroll progress (0..1) at which this petal lets go */
  release: number;
  drift: THREE.Vector3;
  spin: THREE.Vector3;
  homePos: THREE.Vector3;
  homeRot: THREE.Euler;
};

function initRose(canvas: HTMLCanvasElement) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = window.innerWidth < 760;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true, // the warm gradient behind comes from CSS
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.75 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);

  const { group: rose, petals } = buildRose();
  scene.add(rose);

  const motes = buildMotes();
  scene.add(motes.points);

  /* ---------- light ---------- */
  // warm key from upper right, the direction the petals open towards
  const key = new THREE.DirectionalLight(0xfff0d8, 3.1);
  key.position.set(4, 6, 4);
  scene.add(key);

  // cool fill so the shadowed side keeps some form instead of going black
  const fill = new THREE.DirectionalLight(0x9fb6d8, 0.85);
  fill.position.set(-5, -1, 2);
  scene.add(fill);

  // rim from behind to catch every petal edge — what makes it read as 3D
  const rim = new THREE.DirectionalLight(0xffb992, 2.2);
  rim.position.set(-2, 3, -6);
  scene.add(rim);

  scene.add(new THREE.AmbientLight(0xffe9d6, 0.55));

  layout();

  /* ---------- interaction ---------- */
  const ptr = { x: 0, y: 0 };
  const ptrTarget = { x: 0, y: 0 };
  let scrollP = 0;   // raw scroll progress
  let scrollLag = 0; // eased behind it, so the rose drifts rather than tracks

  if (!reduceMotion) {
    window.addEventListener('pointermove', (e) => {
      ptrTarget.x = e.clientX / window.innerWidth - 0.5;
      ptrTarget.y = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });

    window.addEventListener('scroll', () => {
      scrollP = Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
    }, { passive: true });
  }

  window.addEventListener('resize', () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 760 ? 1.75 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    layout();
    if (reduceMotion) renderer.render(scene, camera);
  }, { passive: true });

  /** Portrait puts the bloom in the upper half above the text; landscape sets
   *  it to the right of it. Both keep it large enough to fill the frame. */
  function layout() {
    const portrait = window.innerWidth < 760;
    if (portrait) {
      camera.position.set(0, 0.15, 7.6);
      camera.lookAt(0, 0.15, 0);
      rose.position.set(0.15, 1.2, 0);
      rose.scale.setScalar(0.46);
    } else {
      camera.position.set(0, 0.2, 6.6);
      camera.lookAt(0, 0.2, 0);
      rose.position.set(1.75, 0.35, 0);
      rose.scale.setScalar(0.8);
    }
    camera.updateProjectionMatrix();
  }

  let lastT = 0;

  function frame(t: number) {
    requestAnimationFrame(frame);

    // seconds since the last frame, clamped so a background tab that wakes up
    // after a long pause doesn't snap everything forward in one jump
    const dt = Math.min(0.05, lastT ? (t - lastT) / 1000 : 0.016);
    lastT = t;
    // a little past the fold, so the trailing motion can finish settling
    if (document.hidden || window.scrollY > window.innerHeight * 1.7) return;

    // The rose lags the page. Easing toward the scroll position rather than
    // reading it directly is what makes it feel like it is further away.
    scrollLag += (scrollP - scrollLag) * (1 - Math.exp(-2.1 * dt));

    // exponential damping: identical feel regardless of refresh rate
    const ease = 1 - Math.exp(-3.2 * dt);
    ptr.x += (ptrTarget.x - ptr.x) * ease;
    ptr.y += (ptrTarget.y - ptr.y) * ease;

    const time = t * 0.001;

    // scroll spins the bloom up and sheds it; the opaque next section then
    // slides over the top, so the rose reads as sinking underneath it
    shedPetals(scrollLag);
    const twirl = Math.pow(scrollLag, 1.35) * 6.0;

    rose.rotation.y = time * 0.16 + ptr.x * 0.5 + twirl;
    rose.rotation.x = -0.24 + ptr.y * 0.35 + Math.sin(time * 0.5) * 0.03;
    rose.rotation.z = Math.sin(time * 0.37) * 0.035;
    rose.position.y =
      (window.innerWidth < 760 ? 1.2 : 0.35) + Math.sin(time * 0.7) * 0.06 - scrollLag * 1.35;

    motes.update(time);
    renderer.render(scene, camera);
  }

  if (reduceMotion) {
    rose.rotation.set(-0.24, 0.5, 0);
    renderer.render(scene, camera);
  } else {
    requestAnimationFrame(frame);
  }

  /** Releases each petal once scroll passes its own threshold: it drifts out
   *  along its own arm's direction, tumbles, falls under gravity and fades.
   *  Petals are only made transparent once they start moving — blending every
   *  petal from the first frame would cost sorting for no visual gain. */
  function shedPetals(p: number) {
    for (const petal of petals) {
      const local = Math.min(1, Math.max(0, (p - petal.release) / 0.52));

      if (local <= 0) {
        petal.mat.opacity = 1;
        petal.mesh.position.copy(petal.homePos);
        petal.mesh.rotation.copy(petal.homeRot);
        petal.mesh.visible = true;
        continue;
      }

      petal.mesh.position
        .copy(petal.homePos)
        .addScaledVector(petal.drift, local * 0.85);
      petal.mesh.position.y -= 3.0 * local * local; // gravity, deliberately gentle

      petal.mesh.rotation.set(
        petal.homeRot.x + petal.spin.x * local * 2.0,
        petal.homeRot.y + petal.spin.y * local * 2.0,
        petal.homeRot.z + petal.spin.z * local * 2.0
      );

      const fade = 1 - Math.min(1, Math.max(0, (local - 0.6) / 0.4));
      petal.mat.opacity = fade;
      petal.mesh.visible = fade > 0.01;
    }
  }

  /* ---------------- geometry ---------------- */

  /**
   * One petal, as a parametric patch.
   *  u (0..1) runs base -> tip, v (-1..1) runs across the width.
   *  The width profile is a sine lobe so the petal narrows at both ends;
   *  z carries the backward curl, the cupping across v, and a little edge
   *  ruffle that keeps the silhouette from looking machined.
   */
  function petalGeometry(rings: number, seg: number, curl: number, cup: number, ruffle: number) {
    const pos: number[] = [];
    const idx: number[] = [];

    for (let i = 0; i <= rings; i++) {
      const u = i / rings;
      const baseTaper = Math.min(1, u * 3.1);
      const w = Math.pow(Math.sin(Math.PI * (0.12 + u * 0.72)), 0.55) * baseTaper;
      for (let j = 0; j <= seg; j++) {
        const v = (j / seg) * 2 - 1;
        const x = v * w * 0.62;
        const y = u;
        const z =
          -curl * u * u +
          cup * v * v * (0.25 + u * 0.85) +
          ruffle * Math.sin(v * Math.PI * 2.4) * u * u;
        pos.push(x, y, z);
      }
    }

    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < seg; j++) {
        const a = i * (seg + 1) + j;
        const b = a + seg + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function buildRose() {
    const group = new THREE.Group();
    const petals: Petal[] = [];
    const PETALS = small ? 30 : 38;
    const GOLDEN = Math.PI * (3 - Math.sqrt(5));

    // deep crimson at the heart, blushing paler at the open outer petals
    const inner = new THREE.Color(0x6E101C);
    const outer = new THREE.Color(0xE07A72);

    for (let i = 0; i < PETALS; i++) {
      const t = i / (PETALS - 1);
      const eased = Math.pow(t, 0.82);

      const geo = petalGeometry(
        6,
        7,
        0.45 + eased * 0.88,      // outer petals curl back harder
        0.62 - eased * 0.34,      // inner petals are tightly cupped
        0.02 + eased * 0.05       // outer edges ruffle more
      );

      const mat = new THREE.MeshStandardMaterial({
        color: inner.clone().lerp(outer, eased),
        roughness: 0.62,
        metalness: 0.0,
        side: THREE.DoubleSide,
        flatShading: true,
        // Declared up front and never toggled: flipping `transparent` at
        // runtime forces a shader recompile, and doing that per petal as each
        // one releases is a guaranteed hitch mid-scroll.
        transparent: true,
      });

      const petal = new THREE.Mesh(geo, mat);
      const scale = 0.4 + eased * 1.05;
      petal.scale.setScalar(scale);
      // open outward as we move out of the bud
      petal.rotation.x = 0.05 + Math.pow(eased, 1.05) * 1.72;

      const arm = new THREE.Group();
      arm.rotation.y = i * GOLDEN;
      arm.position.y = -eased * 0.16;
      arm.add(petal);
      group.add(arm);

      /* Outer petals let go first, which is the order a real bloom drops
         them, and it keeps the heart of the rose visible longest. */
      petals.push({
        mesh: petal,
        mat,
        release: 0.04 + (1 - eased) * 0.55 + Math.random() * 0.1,
        drift: new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          0.2 + Math.random() * 0.5,
          0.35 + Math.random() * 0.8
        ),
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 2.4,
          (Math.random() - 0.5) * 2.4,
          (Math.random() - 0.5) * 2.4
        ),
        homePos: petal.position.clone(),
        homeRot: petal.rotation.clone(),
      });
    }

    // receptacle, so the petals emerge from something rather than a point
    const hip = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.34, 0),
      new THREE.MeshStandardMaterial({ color: 0x3c5738, roughness: 0.82, flatShading: true })
    );
    hip.position.y = -0.26;
    hip.scale.set(1, 0.8, 1);
    group.add(hip);

    // stem running out of frame, with two low-poly leaves to fill the lower third
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.075, 4.4, 5),
      new THREE.MeshStandardMaterial({ color: 0x36503a, roughness: 0.86, flatShading: true })
    );
    stem.position.y = -2.5;
    group.add(stem);

    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x3f5f3c, roughness: 0.82, side: THREE.DoubleSide, flatShading: true,
    });
    for (const [ry, rz, py] of [[0.5, -0.9, -1.5], [3.6, 0.95, -2.35]] as const) {
      const leaf = new THREE.Mesh(petalGeometry(4, 5, 0.25, 0.16, 0.03), leafMat);
      leaf.scale.set(0.85, 1.5, 0.85);
      leaf.rotation.set(-0.3, ry, rz);
      leaf.position.y = py;
      group.add(leaf);
    }

    group.rotation.x = -0.24;
    return { group, petals };
  }

  /** Warm bokeh drifting through the frame, so the background is never a flat
   *  empty field behind the bloom. */
  function buildMotes() {
    const COUNT = small ? 90 : 160;
    const base = new Float32Array(COUNT * 3);
    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      base[i * 3] = (Math.random() - 0.5) * 14;
      base[i * 3 + 1] = (Math.random() - 0.5) * 10;
      base[i * 3 + 2] = -2 - Math.random() * 6;
      seed[i] = Math.random() * Math.PI * 2;
    }
    pos.set(base);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    /* A bare PointsMaterial draws literal squares, which read as dead pixels
       against a dark ground. A radial-gradient sprite makes them soft dots. */
    const sprite = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d')!;
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.35, 'rgba(255,255,255,.55)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();

    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.12,
        map: sprite,
        color: 0xffd9ae,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      })
    );
    points.frustumCulled = false;

    return {
      points,
      update(time: number) {
        const attr = geo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < COUNT; i++) {
          attr.array[i * 3] = base[i * 3] + Math.sin(time * 0.25 + seed[i]) * 0.35;
          attr.array[i * 3 + 1] = base[i * 3 + 1] + Math.cos(time * 0.2 + seed[i] * 1.3) * 0.3;
        }
        attr.needsUpdate = true;
      },
    };
  }
}
