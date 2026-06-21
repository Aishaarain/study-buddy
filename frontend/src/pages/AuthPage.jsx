import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

/* ─── Small Class Helper ───────────────────────────────────────────── */
const cn = (...classes) => classes.filter(Boolean).join(' ');

/* ─── Three.js Background Scene ────────────────────────────────────── */
function AuthScene() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const W = window.innerWidth;
    const H = window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });

    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x03010f, 0.025);

    const camera = new THREE.PerspectiveCamera(70, W / H, 0.1, 500);
    camera.position.set(0, 2, 12);

    scene.add(new THREE.AmbientLight(0x0a0520, 2));

    const pLight1 = new THREE.PointLight(0x7c5cfc, 8, 22);
    pLight1.position.set(-5, 6, 3);
    scene.add(pLight1);

    const pLight2 = new THREE.PointLight(0x00e5ff, 5, 18);
    pLight2.position.set(6, -3, 5);
    scene.add(pLight2);

    const pLight3 = new THREE.PointLight(0xff6ac1, 3, 14);
    pLight3.position.set(3, 4, -4);
    scene.add(pLight3);

    /* Stars */
    const starGeo = new THREE.BufferGeometry();
    const sv = [];
    const sc = [];

    for (let i = 0; i < 350; i++) {
      const r = 60 + Math.random() * 180;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);

      sv.push(
        r * Math.sin(ph) * Math.cos(th),
        r * Math.sin(ph) * Math.sin(th),
        r * Math.cos(ph)
      );

      const c = new THREE.Color();
      c.setHSL(
        0.62 + Math.random() * 0.25,
        0.5,
        0.65 + Math.random() * 0.35
      );

      sc.push(c.r, c.g, c.b);
    }

    starGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(sv, 3)
    );

    starGeo.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));

    const starMat = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });

    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    /* Central Floating Crystal */
    const crystalGroup = new THREE.Group();
    crystalGroup.position.set(-3.5, 0.5, 0);
    scene.add(crystalGroup);

    const orbMat = new THREE.MeshPhysicalMaterial({
      color: 0x7c5cfc,
      roughness: 0.05,
      metalness: 0.2,
      emissive: 0x7c5cfc,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.85,
      transmission: 0.3,
      thickness: 1.2,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    });

    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 4), orbMat);
    crystalGroup.add(orb);

    const shellMat = new THREE.MeshPhysicalMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.1,
      roughness: 0.02,
      metalness: 0.1,
      transmission: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    crystalGroup.add(
      new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 32), shellMat)
    );

    const ringColors = [0x7c5cfc, 0x00e5ff, 0xff6ac1];

    const rings = ringColors.map((col, i) => {
      const r = new THREE.Mesh(
        new THREE.TorusGeometry(1.8 + i * 0.3, 0.03, 8, 80),
        new THREE.MeshBasicMaterial({
          color: col,
          transparent: true,
          opacity: 0.4 - i * 0.08,
        })
      );

      r.rotation.x = (Math.PI / 3) * i;
      r.rotation.z = (Math.PI / 5) * i;

      crystalGroup.add(r);
      return r;
    });

    const miniOrbs = [];
    const miniColors = [0x7c5cfc, 0x00e5ff, 0xff6ac1, 0xa78bfa, 0x38bdf8];

    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 16, 16),
        new THREE.MeshPhysicalMaterial({
          color: miniColors[i],
          emissive: miniColors[i],
          emissiveIntensity: 0.6,
          transparent: true,
          opacity: 0.9,
          roughness: 0.1,
        })
      );

      m.userData = {
        angle: (i / 5) * Math.PI * 2,
        radius: 2.5 + i * 0.3,
        speed: 0.4 + i * 0.12,
        yOff: (i - 2) * 0.4,
      };

      crystalGroup.add(m);
      miniOrbs.push(m);
    }

    /* Particles */
    const pCount = 120;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    const pVel = new Float32Array(pCount * 3);
    const pAge = new Float32Array(pCount);

    const resetP = (i) => {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.8;

      pPos[i * 3] = Math.cos(a) * r;
      pPos[i * 3 + 1] = -0.5 + Math.random() * 0.3;
      pPos[i * 3 + 2] = Math.sin(a) * r;

      pVel[i * 3] = (Math.random() - 0.5) * 0.006;
      pVel[i * 3 + 1] = 0.01 + Math.random() * 0.012;
      pVel[i * 3 + 2] = (Math.random() - 0.5) * 0.006;

      pAge[i] = Math.random();
    };

    for (let i = 0; i < pCount; i++) resetP(i);

    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));

    const pMat = new THREE.PointsMaterial({
      color: 0xa78bfa,
      size: 0.04,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });

    const particles = new THREE.Points(pGeo, pMat);
    crystalGroup.add(particles);

    [
      [-55, 15, -80, 12, 0x1a0840, 0.12],
      [65, -8, -100, 9, 0x002b3d, 0.09],
      [30, 25, -70, 7, 0x1a0050, 0.08],
    ].forEach(([x, y, z, r, col, op]) => {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(r, 24, 24),
        new THREE.MeshBasicMaterial({
          color: col,
          transparent: true,
          opacity: op,
        })
      );

      sphere.position.set(x, y, z);
      scene.add(sphere);
    });

    const mouse = new THREE.Vector2(0, 0);

    const handleMouseMove = (e) => {
      mouse.x = e.clientX / window.innerWidth - 0.5;
      mouse.y = -(e.clientY / window.innerHeight - 0.5);
    };

    window.addEventListener('mousemove', handleMouseMove);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    const clock = new THREE.Clock();
    let raf;

    const animate = () => {
      raf = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const t = clock.elapsedTime;

      crystalGroup.position.y = 0.5 + Math.sin(t * 0.7) * 0.3;
      crystalGroup.rotation.y += delta * 0.25;

      orb.material.emissiveIntensity = 0.3 + 0.2 * Math.sin(t * 2);
      orb.scale.setScalar(1 + 0.04 * Math.sin(t * 1.5));

      rings.forEach((r, i) => {
        r.rotation.y += delta * (0.5 + i * 0.2);
        r.rotation.z += delta * 0.15;
      });

      miniOrbs.forEach((m) => {
        m.userData.angle += delta * m.userData.speed;

        m.position.set(
          Math.cos(m.userData.angle) * m.userData.radius,
          m.userData.yOff + Math.sin(t * 1.1 + m.userData.angle) * 0.3,
          Math.sin(m.userData.angle) * m.userData.radius
        );
      });

      for (let i = 0; i < pCount; i++) {
        pAge[i] += delta * 0.3;

        if (pAge[i] > 1) {
          resetP(i);
          pAge[i] = 0;
        }

        pPos[i * 3] += pVel[i * 3];
        pPos[i * 3 + 1] += pVel[i * 3 + 1];
        pPos[i * 3 + 2] += pVel[i * 3 + 2];
      }

      pGeo.attributes.position.needsUpdate = true;
      pMat.opacity = 0.5 + 0.4 * Math.sin(t * 2.5);

      pLight1.intensity = 7 + 3 * Math.sin(t * 1.1);
      pLight2.intensity = 4 + 2 * Math.sin(t * 0.8 + 1);
      pLight3.intensity = 2.5 + 1.5 * Math.sin(t * 1.4 + 2);

      stars.rotation.y += 0.00003;
      starMat.opacity = 0.6 + 0.2 * Math.sin(t * 0.25);

      camera.position.x += (mouse.x * 1.5 - camera.position.x) * 0.03;
      camera.position.y += (mouse.y * 0.8 + 2 - camera.position.y) * 0.03;
      camera.lookAt(0, 0.5, 0);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);

      renderer.dispose();

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="pointer-events-none fixed inset-0 z-0" />;
}

/* ─── Auth Page ────────────────────────────────────────────────────── */
export default function AuthPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState('login');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPass, setShowPass] = useState(false);

  const features = [
    {
      icon: '🧠',
      title: 'AI-Powered Quizzes',
      desc: 'Auto-generate quizzes from your uploaded materials.',
    },
    {
      icon: '💬',
      title: 'Chat with Docs',
      desc: 'Ask questions and get instant answers from your notes.',
    },
    {
      icon: '🃏',
      title: 'Smart Flashcards',
      desc: 'Spaced repetition flashcards built from your content.',
    },
    {
      icon: '📅',
      title: 'Study Planner',
      desc: 'Personalized schedules powered by your learning pace.',
    },
  ];

  const validate = () => {
    const e = {};

    if (mode === 'register' && !formData.name.trim()) {
      e.name = 'Name is required';
    }

    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      e.email = 'Enter a valid email';
    }

    if (formData.password.length < 8) {
      e.password = 'Min 8 characters';
    }

    if (mode === 'register' && formData.password !== formData.confirm) {
      e.confirm = 'Passwords do not match';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setLoading(true);

      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;

        navigate('/landing');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.name,
            },
          },
        });

        if (error) throw error;

        if (!data.session) {
          alert(
            'Account created! Please check your email to confirm before logging in.'
          );
          setMode('login');
        } else {
          navigate('/landing');
        }
      }
    } catch (error) {
      alert(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (field, label, type = 'text', placeholder = '') => {
    const isPasswordField = field === 'password' || field === 'confirm';

    return (
      <div className="mb-4">
        <label className="mb-2 block font-['Syne'] text-[11px] font-bold uppercase tracking-[1.2px] text-violet-200/80">
          {label}
        </label>

        <div className="relative">
          <input
            type={isPasswordField ? (showPass ? 'text' : 'password') : type}
            value={formData[field]}
            placeholder={placeholder}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                [field]: e.target.value,
              }))
            }
            className={cn(
              'w-full rounded-[10px] border bg-violet-400/10 px-4 py-3 font-["Syne"] text-sm text-[#e8e0ff] outline-none transition placeholder:text-violet-300/35 focus:border-violet-400/70 focus:ring-4 focus:ring-violet-500/15',
              isPasswordField && 'pr-12',
              errors[field]
                ? 'border-red-400/70'
                : 'border-violet-400/25'
            )}
          />

          {field === 'password' && (
            <button
              type="button"
              onClick={() => setShowPass((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-base"
            >
              {showPass ? '🙈' : '👁️'}
            </button>
          )}
        </div>

        {errors[field] && (
          <span className="mt-1 block font-['Syne'] text-[11px] text-red-400">
            {errors[field]}
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <AuthScene />

      <main className="fixed inset-0 z-10 flex min-h-screen w-full flex-col items-stretch justify-start gap-5 overflow-y-auto overflow-x-hidden bg-[#03010f]/20 px-4 py-6 font-['Syne'] text-white md:flex-row md:items-center md:justify-center md:gap-0 md:px-5">
        {/* Left Text Section */}
        <section className="flex w-full items-center justify-center px-2 py-3 text-center md:max-w-[560px] md:flex-1 md:px-6 md:py-8 md:text-left">
          <div className="mx-auto w-full max-w-[470px] md:mx-0">
            <div className="mb-5 flex items-center justify-center gap-3 md:mb-7 md:justify-start">
              <span className="text-2xl text-violet-400 drop-shadow-[0_0_8px_#7c5cfc]">
                ✦
              </span>

              <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text font-['Orbitron'] text-xl font-bold tracking-[2px] text-transparent">
                StudyAI
              </span>
            </div>

            <h1 className="m-0 font-['Orbitron'] text-[clamp(32px,10vw,46px)] font-extrabold leading-[1.12] tracking-[-0.5px] text-[#e8e0ff] md:text-[clamp(34px,4vw,50px)]">
              Make Your
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
                Study Smarter.
              </span>
            </h1>

            <p className="mx-auto mt-4 max-w-[95%] font-['Syne'] text-sm leading-7 text-violet-100/70 md:mx-0 md:max-w-none md:text-[15px]">
              Upload your notes, textbooks, or slides — StudyAI transforms them
              into interactive quizzes, flashcards, and AI conversations that
              accelerate your understanding.
            </p>

            <div className="mt-7 flex flex-col gap-3">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-left transition hover:translate-x-1 hover:border-violet-400/40 hover:bg-violet-500/15"
                >
                  <span className="mt-0.5 text-[22px] leading-none">
                    {feature.icon}
                  </span>

                  <div>
                    <h3 className="mb-1 font-['Syne'] text-sm font-bold text-violet-200">
                      {feature.title}
                    </h3>

                    <p className="m-0 font-['Syne'] text-xs leading-5 text-violet-100/55">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-center gap-6 md:justify-start">
              {[
                ['10K+', 'Students'],
                ['500K+', 'Flashcards'],
                ['98%', 'Satisfaction'],
              ].map(([number, label]) => (
                <div key={label} className="text-center">
                  <div className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text font-['Orbitron'] text-xl font-extrabold text-transparent md:text-2xl">
                    {number}
                  </div>

                  <div className="mt-1 font-['Syne'] text-[11px] text-violet-100/50">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right Form Section */}
        <section className="flex w-full items-center justify-center p-0 pb-8 md:w-auto md:max-w-[460px] md:p-5">
          <div className="w-full max-w-[420px] overflow-hidden rounded-[20px] border border-violet-400/25 bg-[#08041c]/80 shadow-[0_0_60px_rgba(124,92,252,0.15),0_0_120px_rgba(0,229,255,0.05),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl">
            {/* Tabs */}
            <div className="flex border-b border-violet-400/20">
              {['login', 'register'].map((tabMode) => (
                <button
                  key={tabMode}
                  type="button"
                  onClick={() => {
                    setMode(tabMode);
                    setErrors({});
                  }}
                  className={cn(
                    'flex-1 border-b-2 px-4 py-4 font-["Orbitron"] text-xs font-semibold uppercase tracking-[1.5px] transition',
                    mode === tabMode
                      ? 'border-violet-500 bg-violet-500/10 text-violet-200'
                      : 'border-transparent bg-transparent text-violet-200/50 hover:bg-violet-500/5 hover:text-violet-200/80'
                  )}
                >
                  {tabMode === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>

            {/* Form Body */}
            <div className="px-5 py-6 sm:px-7 sm:py-7">
              {mode === 'login' ? (
                <>
                  <p className="mb-5 mt-0 font-['Syne'] text-sm text-violet-100/55">
                    Welcome back, ready to study?
                  </p>

                  {renderInput(
                    'email',
                    'Email',
                    'email',
                    'you@university.edu'
                  )}

                  {renderInput(
                    'password',
                    'Password',
                    'password',
                    '••••••••'
                  )}

                  <div className="-mt-1 mb-1 text-right">
                    <a
                      href="#"
                      className="font-['Syne'] text-xs text-violet-400/80 no-underline hover:text-violet-300"
                    >
                      Forgot password?
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <p className="mb-5 mt-0 font-['Syne'] text-sm text-violet-100/55">
                    Create your free account.
                  </p>

                  {renderInput('name', 'Full Name', 'text', 'Ada Lovelace')}

                  {renderInput(
                    'email',
                    'Email',
                    'email',
                    'you@university.edu'
                  )}

                  {renderInput(
                    'password',
                    'Password',
                    'password',
                    'Min 8 characters'
                  )}

                  {renderInput(
                    'confirm',
                    'Confirm Password',
                    'password',
                    'Repeat password'
                  )}
                </>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="mt-5 flex min-h-[46px] w-full items-center justify-center rounded-[10px] border-none bg-gradient-to-r from-violet-500 to-cyan-400 px-4 py-3 font-['Orbitron'] text-sm font-bold tracking-[1.5px] text-white shadow-[0_0_24px_rgba(124,92,252,0.4)] transition hover:-translate-y-0.5 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : mode === 'login' ? (
                  'Enter StudyAI →'
                ) : (
                  'Start Studying →'
                )}
              </button>

        

             
            </div>
          </div>
        </section>
      </main>
    </>
  );
}