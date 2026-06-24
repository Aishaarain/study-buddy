import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { orbDefs } from '../../utils/orbData.js';

function buildGlassMat(color, opacity = 0.18, emissive = 0x000000, emissiveI = 0) {
  return new THREE.MeshPhysicalMaterial({
    color,
    transparent: true,
    opacity,
    roughness: 0.05,
    metalness: 0.1,
    transmission: 0.4,
    thickness: 0.5,
    reflectivity: 0.9,
    emissive,
    emissiveIntensity: emissiveI,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

function makeCanvasTextTexture(
  text,
  width = 512,
  height = 160,
  font = 'bold 46px Inter, Arial',
  withBg = true
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  if (withBg) {
    ctx.fillStyle = 'rgba(10, 6, 35, 0.78)';
    ctx.roundRect(16, 30, width - 32, height - 60, 32);
    ctx.fill();

    ctx.strokeStyle = 'rgba(124, 92, 252, 0.95)';
    ctx.lineWidth = 4;
    ctx.roundRect(16, 30, width - 32, height - 60, 32);
    ctx.stroke();
  }

  ctx.font = font;
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(124,92,252,0.9)';
  ctx.shadowBlur = 14;
  ctx.fillText(text, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return texture;
}

function makeChipTexture(label) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(20,8,60,0.9)';
  ctx.roundRect(2, 2, 252, 60, 12);
  ctx.fill();

  ctx.strokeStyle = 'rgba(124,92,252,0.7)';
  ctx.lineWidth = 2;
  ctx.roundRect(2, 2, 252, 60, 12);
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px Inter, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 32);

  return new THREE.CanvasTexture(canvas);
}

export default function StudyScene({
  onHoverFeature,
  onSelectFeature,
  onTooltipMove,
  onClearSelection,
}) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

    const particleCount = isMobile ? 80 : 160;
    const bookParticleCount = isMobile ? 35 : 80;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050510, 0.035);

    const camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );
    camera.position.set(0, 3.5, 10);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 5;
    controls.maxDistance = 20;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0;
    controls.target.set(0, 0, 0);
    controls.maxPolarAngle = Math.PI * 0.7;

    const ambientLight = new THREE.AmbientLight(0x0a0520, 1.5);
    scene.add(ambientLight);

    const purpleLight = new THREE.PointLight(0x7c5cfc, 5, 18);
    purpleLight.position.set(-4, 6, 3);
    scene.add(purpleLight);

    const cyanLight = new THREE.PointLight(0x00e5ff, 3.5, 16);
    cyanLight.position.set(5, -2, 4);
    scene.add(cyanLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(-6, 4, -6);
    scene.add(rimLight);

    const underLight = new THREE.PointLight(0x7c5cfc, 2.5, 8);
    underLight.position.set(0, -1.8, 0);
    scene.add(underLight);

    const platformGroup = new THREE.Group();
    scene.add(platformGroup);

    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 2.8, 0.35, 64, 2),
      new THREE.MeshPhysicalMaterial({
        color: 0x0d0d2b,
        roughness: 0.08,
        metalness: 0.6,
        transparent: true,
        opacity: 0.92,
        reflectivity: 1,
        emissive: 0x7c5cfc,
        emissiveIntensity: 0.04,
      })
    );
    island.castShadow = true;
    island.receiveShadow = true;
    platformGroup.add(island);

    const rimRingMat = new THREE.MeshBasicMaterial({ color: 0x7c5cfc });
    const rimRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.0, 0.06, 16, 120),
      rimRingMat
    );
    rimRing.rotation.x = Math.PI / 2;
    rimRing.position.y = -0.16;
    platformGroup.add(rimRing);

    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.15, 0.025, 16, 120),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff })
    );
    outerRing.rotation.x = Math.PI / 2;
    outerRing.position.y = -0.12;
    platformGroup.add(outerRing);

    const glassSurface = new THREE.Mesh(
      new THREE.CylinderGeometry(3.18, 3.18, 0.04, 64),
      buildGlassMat(0x7c5cfc, 0.15, 0x7c5cfc, 0.1)
    );
    glassSurface.position.y = 0.19;
    platformGroup.add(glassSurface);

    function makeLightBeam(x, z, color) {
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.04, 7, 8),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
        })
      );
      beam.position.set(x, 3.3, z);
      platformGroup.add(beam);
    }

    makeLightBeam(2.4, 2.4, 0x7c5cfc);
    makeLightBeam(-2.4, 2.4, 0x00e5ff);
    makeLightBeam(2.4, -2.4, 0x00e5ff);
    makeLightBeam(-2.4, -2.4, 0x7c5cfc);

    const bookGroup = new THREE.Group();
    bookGroup.position.set(0, 0.6, 0);
    platformGroup.add(bookGroup);

    bookGroup.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 1.1, 1.45),
        new THREE.MeshPhysicalMaterial({
          color: 0x1a0a3a,
          roughness: 0.2,
          metalness: 0.5,
          emissive: 0x7c5cfc,
          emissiveIntensity: 0.25,
        })
      )
    );

    const coverMat = new THREE.MeshPhysicalMaterial({
      color: 0x120830,
      roughness: 0.15,
      metalness: 0.4,
      emissive: 0x7c5cfc,
      emissiveIntensity: 0.12,
      transparent: true,
      opacity: 0.9,
    });

    const leftCoverGroup = new THREE.Group();
    leftCoverGroup.position.x = -0.07;
    bookGroup.add(leftCoverGroup);

    const leftCover = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.1, 1.45),
      coverMat.clone()
    );
    leftCover.position.x = -0.45;
    leftCoverGroup.add(leftCover);

    const rightCoverGroup = new THREE.Group();
    rightCoverGroup.position.x = 0.07;
    bookGroup.add(rightCoverGroup);

    const rightCover = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.1, 1.45),
      coverMat.clone()
    );
    rightCover.position.x = 0.45;
    rightCoverGroup.add(rightCover);

    for (let i = 0; i < 5; i++) {
      const pageMat = new THREE.MeshBasicMaterial({
        color: 0xd4b8ff,
        transparent: true,
        opacity: 0.06 + i * 0.012,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const pageL = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 1.05), pageMat);
      pageL.rotation.y = -Math.PI / 2 + 0.02 * i;
      pageL.position.x = -0.07 - 0.06 * i;
      bookGroup.add(pageL);

      const pageR = new THREE.Mesh(
        new THREE.PlaneGeometry(0.88, 1.05),
        pageMat.clone()
      );
      pageR.rotation.y = Math.PI / 2 - 0.02 * i;
      pageR.position.x = 0.07 + 0.06 * i;
      bookGroup.add(pageR);
    }

    const panelGroup = new THREE.Group();
    panelGroup.position.set(0, 0.55, 0);
    platformGroup.add(panelGroup);

    const holoFrame = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 2.6, 0.04),
      buildGlassMat(0x7c5cfc, 0.08, 0x7c5cfc, 0.08)
    );
    holoFrame.position.set(0, 0.3, -1.1);
    panelGroup.add(holoFrame);

    const progressTrack = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.07),
      new THREE.MeshBasicMaterial({
        color: 0x1a0a3a,
        transparent: true,
        opacity: 0.8,
      })
    );
    progressTrack.position.set(0, -0.82, -1.08);
    panelGroup.add(progressTrack);

    const pbFillMat = new THREE.MeshBasicMaterial({
      color: 0x7c5cfc,
      transparent: true,
      opacity: 0.9,
    });

    const pbFill = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.045), pbFillMat);
    pbFill.position.set(-0.2, -0.82, -1.07);
    panelGroup.add(pbFill);

    ['12 PDFs', '85% Quiz', 'Day 5 🔥'].forEach((label, i) => {
      const chip = new THREE.Mesh(
        new THREE.PlaneGeometry(0.75, 0.19),
        new THREE.MeshBasicMaterial({
          map: makeChipTexture(label),
          transparent: true,
          depthWrite: false,
        })
      );
      chip.position.set([-1.1, 0, 1.1][i], -1.08, -1.06);
      panelGroup.add(chip);
    });

    const bookParticleGeo = new THREE.BufferGeometry();
    const bpPos = new Float32Array(bookParticleCount * 3);
    const bpVel = new Float32Array(bookParticleCount * 3);
    const bpAge = new Float32Array(bookParticleCount);

    function resetBookParticle(i) {
      bpPos[i * 3] = (Math.random() - 0.5) * 1.2;
      bpPos[i * 3 + 1] = Math.random() * 0.5;
      bpPos[i * 3 + 2] = (Math.random() - 0.5) * 0.8;

      bpVel[i * 3] = (Math.random() - 0.5) * 0.002;
      bpVel[i * 3 + 1] = 0.004 + Math.random() * 0.006;
      bpVel[i * 3 + 2] = (Math.random() - 0.5) * 0.002;

      bpAge[i] = Math.random();
    }

    for (let i = 0; i < bookParticleCount; i++) resetBookParticle(i);

    bookParticleGeo.setAttribute('position', new THREE.BufferAttribute(bpPos, 3));

    const bookParticleMat = new THREE.PointsMaterial({
      color: 0xa78bfa,
      size: 0.025,
      transparent: true,
      opacity: 0.75,
      sizeAttenuation: true,
      depthWrite: false,
    });

    const bookParticles = new THREE.Points(bookParticleGeo, bookParticleMat);
    bookParticles.position.set(0, 0.75, 0);
    platformGroup.add(bookParticles);

    const orbGroup = new THREE.Group();
    scene.add(orbGroup);

    const orbMeshes = [];
    const orbGlows = [];
    const orbScales = orbDefs.map(() => 1);

    const orbBasePositions = orbDefs.map((def, idx) => {
      const total = orbDefs.length;
      const columns = isMobile ? 2 : Math.min(4, total);
      const row = Math.floor(idx / columns);
      const col = idx % columns;

      const spacingX = isMobile ? 2.15 : 2.45;
      const spacingY = isMobile ? 1.45 : 1.55;

      const x = (col - (columns - 1) / 2) * spacingX;
      const y = 2.35 - row * spacingY + def.yOff * 0.25;
      const z = 0.25 + row * 0.22;

      return new THREE.Vector3(x, y, z);
    });

    orbDefs.forEach((def, idx) => {
      const group = new THREE.Group();
      group.position.copy(orbBasePositions[idx]);

      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 40, 40),
        new THREE.MeshPhysicalMaterial({
          color: def.color,
          roughness: 0.1,
          metalness: 0.25,
          emissive: def.color,
          emissiveIntensity: 0.35,
          transparent: true,
          opacity: 0.92,
          transmission: 0.25,
          thickness: 1.0,
          clearcoat: 1,
          clearcoatRoughness: 0.05,
        })
      );

      mesh.userData = { orbIdx: idx, def };
      group.add(mesh);
      orbMeshes.push(mesh);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.72, 0.025, 8, 80),
        new THREE.MeshBasicMaterial({
          color: def.color,
          transparent: true,
          opacity: 0.35,
        })
      );
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      orbGlows.push(ring);

      group.add(new THREE.PointLight(def.color, 1.5, 3.5));

      const labelTexture = makeCanvasTextTexture(
        def.label,
        512,
        160,
        'bold 46px Inter, Arial',
        true
      );

      const labelMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.85, 0.58),
        new THREE.MeshBasicMaterial({
          map: labelTexture,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );

      labelMesh.name = `orbLabel_${def.id}`;
      labelMesh.position.y = -1.05;
      labelMesh.position.z = 0.05;
      group.add(labelMesh);

      const iconMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.57, 20, 20),
        new THREE.MeshBasicMaterial({
          map: makeCanvasTextTexture(def.icon, 256, 256, 'bold 110px Arial', false),
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        })
      );

      group.add(iconMesh);
      orbGroup.add(group);
    });

    const starGeo = new THREE.BufferGeometry();
    const starVerts = [];
    const starColors = [];

    for (let i = 0; i < particleCount; i++) {
      const r = 80 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      starVerts.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );

      const c = new THREE.Color();
      c.setHSL(0.62 + Math.random() * 0.2, 0.4, 0.7 + Math.random() * 0.3);
      starColors.push(c.r, c.g, c.b);
    }

    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
    starGeo.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      sizeAttenuation: true,
      depthWrite: false,
    });

    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    function makePlanet(x, y, z, r, col, opacity) {
      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(r, 32, 32),
        new THREE.MeshBasicMaterial({
          color: col,
          transparent: true,
          opacity,
        })
      );
      planet.position.set(x, y, z);
      scene.add(planet);
    }

    makePlanet(-60, 20, -90, 14, 0x2a1060, 0.07);
    makePlanet(70, -10, -120, 10, 0x003550, 0.05);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-9999, -9999);
    const mouseNorm = new THREE.Vector2(0, 0);

    let hoveredOrb = null;
    let selectedOrb = null;
    let isPaused = false;

    const handleMouseMove = (e) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

      mouseNorm.x = e.clientX / window.innerWidth - 0.5;
      mouseNorm.y = e.clientY / window.innerHeight - 0.5;

      onTooltipMove({ x: e.clientX, y: e.clientY });
    };

    const handleClick = () => {
      if (hoveredOrb !== null) {
        selectedOrb = hoveredOrb;
        onSelectFeature(orbDefs[selectedOrb]);

        controls.autoRotate = false;

        const worldPos = new THREE.Vector3();
        orbMeshes[selectedOrb].getWorldPosition(worldPos);

        camera.position.lerp(
          worldPos.clone().add(new THREE.Vector3(0, 0.55, 3.1)),
          0.18
        );
        controls.target.lerp(worldPos, 0.18);
      } else {
        selectedOrb = null;
        controls.autoRotate = false;
        onClearSelection();
      }
    };

    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();

        if (e.repeat) return;

        isPaused = !isPaused;
        controls.autoRotate = false;
      }

      if (e.code === 'Escape') {
        selectedOrb = null;
        isPaused = false;
        controls.autoRotate = false;

        camera.position.set(0, 3.5, 10);
        controls.target.set(0, 0, 0);

        onClearSelection();
      }
    };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    const clock = new THREE.Clock();
    let time = 0;

    let animationFrame;

    function animate() {
      animationFrame = requestAnimationFrame(animate);

      const delta = clock.getDelta();

      if (!isPaused) {
        time += delta;

        platformGroup.position.y = Math.sin(time * (Math.PI * 2 / 4)) * 0.1;

        const openAngle = (Math.sin(time * 0.45) * 0.5 + 0.5) * 0.85;
        leftCoverGroup.rotation.y = -openAngle;
        rightCoverGroup.rotation.y = openAngle;

        for (let i = 0; i < bookParticleCount; i++) {
          bpAge[i] += delta * (0.2 + Math.random() * 0.08);

          if (bpAge[i] > 1) {
            resetBookParticle(i);
            bpAge[i] = 0;
          }

          bpPos[i * 3] += bpVel[i * 3];
          bpPos[i * 3 + 1] += bpVel[i * 3 + 1];
          bpPos[i * 3 + 2] += bpVel[i * 3 + 2];
        }

        bookParticleGeo.attributes.position.needsUpdate = true;
        bookParticleMat.opacity = 0.45 + 0.25 * Math.sin(time * 2);

        orbDefs.forEach((def, idx) => {
          const base = orbBasePositions[idx];
          const orb = orbGroup.children[idx];

          const gentleFloatY = Math.sin(time * 1.1 + idx * 0.8) * 0.08;
          const gentleFloatX = Math.sin(time * 0.7 + idx) * 0.035;
          const hoverLift = idx === hoveredOrb ? 0.14 : 0;

          const targetPosition = new THREE.Vector3(
            base.x + gentleFloatX,
            base.y + gentleFloatY + hoverLift,
            base.z
          );

          orb.position.lerp(targetPosition, 0.08);

          orb.rotation.y = Math.sin(time * 0.45 + idx) * 0.08;
          orb.rotation.x = Math.sin(time * 0.35 + idx) * 0.04;
        });

        pbFillMat.color.setHSL(0.72 + 0.05 * Math.sin(time * 0.8), 0.85, 0.55);
        pbFill.position.x = -0.25 + 0.015 * Math.sin(time * 1.5);

        purpleLight.intensity = 4.5 + 1.2 * Math.sin(time * 1.1);
        cyanLight.intensity = 3.2 + 1 * Math.sin(time * 0.8 + 1.2);
        underLight.intensity = 2 + 0.8 * Math.sin(time * 1.6);

        rimRingMat.color.setHSL(
          0.72 + 0.04 * Math.sin(time * 0.5),
          1,
          0.5 + 0.1 * Math.sin(time * 1.5)
        );

        stars.rotation.y += 0.000025;
        stars.rotation.x += 0.00001;
        starMat.opacity = 0.55 + 0.1 * Math.sin(time * 0.3);

        platformGroup.rotation.y = Math.sin(time * 0.25) * 0.015;
      }

      orbGroup.children.forEach((orb) => {
        orb.children.forEach((child) => {
          if (child.name?.startsWith('orbLabel_')) {
            child.lookAt(camera.position);
          }
        });
      });

      raycaster.setFromCamera(mouse, camera);

      const hits = raycaster.intersectObjects(orbMeshes);
      const newHovered = hits.length > 0 ? hits[0].object.userData.orbIdx : null;

      if (newHovered !== hoveredOrb) {
        hoveredOrb = newHovered;
        onHoverFeature(hoveredOrb !== null ? orbDefs[hoveredOrb] : null);
        renderer.domElement.style.cursor = hoveredOrb !== null ? 'pointer' : 'default';
      }

      orbMeshes.forEach((mesh, idx) => {
        const targetScale = idx === hoveredOrb ? 1.22 : 1.0;

        orbScales[idx] += (targetScale - orbScales[idx]) * 0.1;
        orbGroup.children[idx].scale.setScalar(orbScales[idx]);

        const ring = orbGlows[idx];
        ring.scale.setScalar(idx === hoveredOrb ? 1 + 0.06 * Math.sin(time * 5) : 1);
        ring.material.opacity = idx === hoveredOrb ? 0.62 : 0.25;

        mesh.material.emissiveIntensity = 0.25 + 0.1 * Math.sin(time * 2 + idx);
      });

      if (!isPaused && selectedOrb === null) {
        const targetCameraX = -mouseNorm.x * 0.65;
        const targetCameraY = 3.5 - mouseNorm.y * 0.45;

        camera.position.x += (targetCameraX - camera.position.x) * 0.025;
        camera.position.y += (targetCameraY - camera.position.y) * 0.025;
        camera.position.z += (10 - camera.position.z) * 0.025;

        controls.target.x += (0 - controls.target.x) * 0.025;
        controls.target.y += (0 - controls.target.y) * 0.025;
        controls.target.z += (0 - controls.target.z) * 0.025;
      }

      controls.update();
      renderer.render(scene, camera);
    }

    animate();

    return () => {
      cancelAnimationFrame(animationFrame);

      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);

      controls.dispose();
      renderer.dispose();

      if (mount && renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [onHoverFeature, onSelectFeature, onTooltipMove, onClearSelection]);

  return <div ref={mountRef} className="scene-root" />;
}
