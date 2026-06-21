import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { supabase } from '../lib/supabaseClient';

export default function Upload() {
  const mountRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [hint, setHint] = useState('Drag files or click to upload');
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050510, 0.05);

    const camera = new THREE.PerspectiveCamera(65, mount.clientWidth / mount.clientHeight, 0.1, 500);
    camera.position.set(0, 2, 9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x0a0520, 1.6));
    const cyanLight = new THREE.PointLight(0x00bfa5, 5, 20);
    cyanLight.position.set(6, 4, 5);
    scene.add(cyanLight);
    const purpleLight = new THREE.PointLight(0x7c5cfc, 4, 16);
    purpleLight.position.set(-5, 5, 3);
    scene.add(purpleLight);

    // Central rotating platform
    const platform = new THREE.Group();
    scene.add(platform);

    const platformMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(2.5, 2.2, 0.2, 64),
      new THREE.MeshPhysicalMaterial({
        color: 0x0d0d2b,
        roughness: 0.08,
        metalness: 0.6,
        emissive: 0x00bfa5,
        emissiveIntensity: 0.04,
      })
    );
    platform.add(platformMesh);

    const platformRim = new THREE.Mesh(
      new THREE.TorusGeometry(2.5, 0.04, 16, 100),
      new THREE.MeshBasicMaterial({ color: 0x00bfa5 })
    );
    platformRim.rotation.x = Math.PI / 2;
    platformRim.position.y = 0.1;
    platform.add(platformRim);

    // Floating document cubes
    const documents = [];
    const docMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a0a3a,
      roughness: 0.15,
      metalness: 0.4,
      emissive: 0x00bfa5,
      emissiveIntensity: 0.2,
    });

    for (let i = 0; i < 5; i++) {
      const doc = new THREE.Group();
      const docMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.8, 0.02),
        docMat.clone()
      );
      doc.add(docMesh);

      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.82, 0.025),
        new THREE.MeshBasicMaterial({ color: 0x00bfa5, transparent: true, opacity: 0.3 })
      );
      doc.add(edge);

      const angle = (i / 5) * Math.PI * 2;
      doc.userData = {
        baseAngle: angle,
        radius: 2,
        speed: 0.5 + Math.random() * 0.3,
        offset: Math.random() * Math.PI * 2,
      };
      platform.add(doc);
      documents.push(doc);
    }

    // Animated particles (data stream)
    const particleGeo = new THREE.BufferGeometry();
    const particleCount = 200;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      particleGeo,
      new THREE.PointsMaterial({
        color: 0x00bfa5,
        size: 0.025,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      })
    );
    scene.add(particles);

    // Surrounding ring structure
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.5 + i * 0.8, 0.015, 16, 200),
        new THREE.MeshBasicMaterial({ color: 0x00bfa5, transparent: true, opacity: 0.2 })
      );
      ring.rotation.x = (Math.PI / 2) * (1 + i * 0.3);
      ring.rotation.y = Math.random() * Math.PI;
      platform.add(ring);
      rings.push(ring);
    }

    // Background stars
    const starsGeo = new THREE.BufferGeometry();
    const starPos = [];
    for (let i = 0; i < 200; i++) {
      const r = 60 + Math.random() * 150;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      starPos.push(r * Math.sin(p) * Math.cos(t), r * Math.sin(p) * Math.sin(t), r * Math.cos(p));
    }
    starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starsGeo,
      new THREE.PointsMaterial({ size: 0.2, color: 0xb8c7ff, transparent: true, opacity: 0.6 })
    );
    scene.add(stars);

    let t = 0;
    let frame;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      t += 0.008;

      platform.rotation.y += 0.001;
      particles.rotation.x += 0.0001;
      particles.rotation.y += 0.0008;
      particles.position.y = Math.sin(t * 0.8) * 0.3;

      documents.forEach((doc) => {
        const angle = doc.userData.baseAngle + t * doc.userData.speed;
        doc.position.x = Math.cos(angle) * doc.userData.radius;
        doc.position.y = Math.sin(t * 1.2 + doc.userData.offset) * 0.4;
        doc.position.z = Math.sin(angle) * doc.userData.radius;
        doc.rotation.x = t * 0.5;
        doc.rotation.y += 0.015;
      });

      rings.forEach((ring, i) => {
        ring.rotation.z += 0.0002 * (i + 1);
      });

      camera.position.x += (Math.sin(t * 0.3) * 2 - camera.position.x) * 0.02;
      camera.position.y += (2.5 + Math.cos(t * 0.25) * 0.5 - camera.position.y) * 0.02;
      camera.lookAt(0, 0.5, 0);

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleResize);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    setHovered(true);
  };

  const handleDragLeave = () => {
    setHovered(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setHovered(false);
    const newFiles = Array.from(e.dataTransfer.files);
    setFiles([...files, ...newFiles]);
  };

  const handleFileSelect = (e) => {
    const newFiles = Array.from(e.target.files);
    setFiles([...files, ...newFiles]);
  };

  const handleProcessFiles = async () => {
    if (files.length === 0) return;

    try {
      setHint("Uploading...");

      const file = files[0];
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert("You need to be logged in to upload.");
        return;
      }

      const fileExt = file.name.split('.').pop().toLowerCase();
      const filePath = `${user.id}/${Date.now()}-${file.name}`;

      // 1. Upload the raw file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Backend upload success alert
      if (fileExt === 'pdf') {
        alert('PDF uploaded successfully!');
      }

      setHint("Processing...");

      // 2. Register the document + trigger text extraction/embedding
      const { data, error: fnError } = await supabase.functions.invoke('upload-document', {
        body: {
          title: file.name,
          filePath,
          fileType: fileExt,
          fileSizeBytes: file.size,
        },
      });

      if (fnError) throw fnError;

      const documentId = data.document.id;
      localStorage.setItem("documentId", documentId);

      // 3. Poll until processing finishes
      const pollInterval = setInterval(async () => {
        const { data: doc, error: pollError } = await supabase
          .from('documents')
          .select('status, page_count')
          .eq('id', documentId)
          .single();

        if (pollError) {
          clearInterval(pollInterval);
          alert("Couldn't check processing status.");
          return;
        }

        if (doc.status === 'ready') {
          clearInterval(pollInterval);
          setHint('Drag files or click to upload');
          alert(`PDF processed successfully! (${doc.page_count} chunks indexed)`);
        } else if (doc.status === 'failed') {
          clearInterval(pollInterval);
          setHint('Drag files or click to upload');
          alert("Processing failed. Try a different file.");
        }
      }, 2000);

    } catch (error) {
      setHint('Drag files or click to upload');
      alert(error.message || "Upload failed");
    }
  };

  return (
    <section className="relative min-h-[100dvh] overflow-hidden bg-[#050510] text-white sm:h-screen">
      <div ref={mountRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(0,191,165,.14),transparent_42%),linear-gradient(to_bottom,transparent,rgba(5,5,16,.92))]" />

      

      <div className="absolute inset-0 z-10 flex items-start justify-center overflow-y-auto px-4 py-24 sm:items-center sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto w-full max-w-2xl">
          <h1 className="text-center font-orbitron text-3xl font-black tracking-[.08em] drop-shadow-[0_0_20px_#00bfa5] sm:text-4xl sm:tracking-[.12em] md:text-5xl md:tracking-[.15em]">
            UPLOAD
            <span className="text-cyan-400"> NOTES</span>
          </h1>

          <p className="mx-auto mt-3 max-w-md text-center text-xs leading-relaxed text-slate-300 sm:mt-4 sm:text-sm">
            PDF, DOCX, TXT · Instant Processing · Vector Indexing
          </p>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative mt-8 flex min-h-[180px] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 backdrop-blur-sm transition sm:mt-10 sm:min-h-[220px] sm:rounded-3xl sm:p-8 md:mt-12 md:p-12 ${
              hovered
                ? 'border-cyan-400 bg-cyan-400/15'
                : 'border-cyan-400/40 bg-cyan-400/5'
            }`}
          >
            <label className="w-full cursor-pointer text-center">
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                accept=".pdf,.docx,.txt"
                className="hidden"
              />
              <div className="mb-3 text-4xl sm:text-5xl">📄</div>
              <p className="font-orbitron text-base font-bold sm:text-lg">
                Click or drag files
              </p>
              <p className="mt-2 text-xs text-slate-400 sm:text-sm">
                Supports PDF, DOCX, TXT
              </p>
            </label>
          </div>

          {files.length > 0 && (
            <div className="mt-6 rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-4 backdrop-blur sm:mt-8 sm:p-6">
              <p className="mb-4 font-orbitron text-xs font-bold text-cyan-300 sm:text-sm">
                {files.length} file{files.length !== 1 ? 's' : ''} ready
              </p>

              <div className="max-h-[28vh] space-y-2 overflow-y-auto pr-1 sm:max-h-40">
                {files.map((file, i) => (
                  <div
                    key={i}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-slate-200 sm:px-4"
                  >
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span className="shrink-0 text-cyan-400">✓</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleProcessFiles}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 px-5 py-3 text-sm font-bold shadow-[0_0_20px_rgba(0,191,165,.4)] transition hover:scale-[1.02] sm:px-6 sm:text-base"
              >
                Process Files
              </button>
            </div>
          )}

          <div className="mt-8 text-center text-[10px] uppercase tracking-[.14em] text-white/30 sm:mt-10 sm:text-xs sm:tracking-[.18em]">
            Supported formats: PDF | DOCX | TXT
          </div>
        </div>
      </div>
    </section>
  );
}