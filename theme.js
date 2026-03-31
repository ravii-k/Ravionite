(function () {
  function animateNumber(id, from, to, duration, formatter) {
    var el = document.getElementById(id);
    if (!el) return;

    var start = performance.now();

    function step(now) {
      var progress = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var value = Math.floor(from + (to - from) * eased);
      el.textContent = formatter ? formatter(value) : String(value);
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  function mountMarquee(trackId, items) {
    var track = document.getElementById(trackId);
    if (!track || !Array.isArray(items) || !items.length) return;

    track.innerHTML = "";
    var repeated = items.concat(items, items);
    repeated.forEach(function (item) {
      var el = document.createElement("div");
      el.className = "marquee-item";
      el.innerHTML =
        '<div class="marquee-icon" style="background:' + item.bg + ';border:1px solid ' + item.border + '">' + item.icon + "</div>" +
        "<div>" +
        '<div class="marquee-name">' + item.name + "</div>" +
        '<div class="marquee-tag">' + item.tag + "</div>" +
        "</div>";
      track.appendChild(el);
    });
  }

  function setupNav(navId) {
    var nav = document.getElementById(navId || "navbar");
    if (!nav) return;

    function syncNav() {
      nav.classList.toggle("scrolled", window.scrollY > 60);
    }

    syncNav();
    window.addEventListener("scroll", syncNav, { passive: true });
  }

  function setupScrollProgress(id) {
    var bar = document.getElementById(id);
    if (!bar) return;

    function syncBar() {
      var doc = document.documentElement;
      var denom = doc.scrollHeight - doc.clientHeight;
      var pct = denom > 0 ? (doc.scrollTop / denom) * 100 : 0;
      bar.style.width = pct + "%";
    }

    syncBar();
    window.addEventListener("scroll", syncBar, { passive: true });
    window.addEventListener("resize", syncBar);
  }

  function setupHeroIntro() {
    var badge = document.querySelector(".hero-badge");
    var lines = document.querySelectorAll(".hero-line-inner");
    var sub = document.querySelector(".hero-sub");
    var actions = document.querySelector(".hero-actions");
    var stats = document.querySelector(".hero-stats");

    function showFallback() {
      [badge, sub, actions, stats].forEach(function (el) {
        if (!el) return;
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      lines.forEach(function (line) {
        line.style.transform = "translateY(0)";
      });
    }

    if (!window.gsap) {
      showFallback();
      return;
    }

    var tl = window.gsap.timeline({ delay: 0.1 });
    if (badge) {
      tl.to(badge, { y: 0, opacity: 1, duration: 0.55, ease: "power2.out" });
    }
    if (lines.length) {
      tl.to(
        lines,
        { y: "0%", duration: 0.85, stagger: 0.14, ease: "power4.out" },
        "-=0.2"
      );
    }
    if (sub) {
      tl.to(sub, { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }, "-=0.4");
    }
    if (actions) {
      tl.to(actions, { y: 0, opacity: 1, duration: 0.55, ease: "power2.out" }, "-=0.35");
    }
    if (stats) {
      tl.to(stats, { opacity: 1, duration: 0.55, ease: "power2.out" }, "-=0.25");
    }
  }

  function setupReveal() {
    var items = document.querySelectorAll("[data-reveal]");
    if (!items.length || !window.gsap || !window.ScrollTrigger) return;

    window.gsap.registerPlugin(window.ScrollTrigger);
    items.forEach(function (item) {
      window.gsap.from(item, {
        y: 32,
        opacity: 0,
        duration: 0.75,
        ease: "power3.out",
        scrollTrigger: {
          trigger: item,
          start: "top 84%",
          once: true
        }
      });
    });
  }

  function createHeroScene(options) {
    if (!window.THREE) return null;

    var canvas = document.getElementById(options.canvasId);
    var hero = document.querySelector(options.heroSelector || ".hero");
    if (!canvas || !hero) return null;

    var widthRatio = options.widthRatio || 0.58;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    function getHeroSize() {
      return {
        w: hero.clientWidth * widthRatio,
        h: hero.clientHeight || window.innerHeight
      };
    }

    var initialSize = getHeroSize();
    renderer.setSize(initialSize.w, initialSize.h);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(48, initialSize.w / initialSize.h, 0.1, 100);
    camera.position.set(0, 0, 9);

    scene.add(new THREE.AmbientLight(0x280850, 2));

    var pointA = new THREE.PointLight(0x7b2fff, 40, 25);
    pointA.position.set(-5, 4, 3);
    scene.add(pointA);

    var pointB = new THREE.PointLight(0x2f6fff, 28, 22);
    pointB.position.set(5, -3, 4);
    scene.add(pointB);

    var dLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dLight.position.set(2, 6, 5);
    scene.add(dLight);

    var VS =
      "varying vec3 vNormal;" +
      "varying vec3 vPos;" +
      "void main(){" +
      "vNormal = normalize(normalMatrix * normal);" +
      "vPos = position;" +
      "gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);" +
      "}";

    var FS =
      "uniform float uT;" +
      "uniform vec3 uC1;" +
      "uniform vec3 uC2;" +
      "uniform vec3 camPos;" +
      "varying vec3 vNormal;" +
      "varying vec3 vPos;" +
      "void main(){" +
      "vec3 viewDir = normalize(camPos - vPos);" +
      "float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 2.8);" +
      "float t1 = sin(vPos.y*1.6 + uT*0.38)*0.5+0.5;" +
      "float t2 = sin(vPos.x*2.1 + uT*0.25+1.2)*0.5+0.5;" +
      "vec3 col = mix(uC1, uC2, t1);" +
      "col = mix(col, vec3(0.85,0.9,1.0), fresnel*0.55);" +
      "col += vec3(0.45,0.15,0.9)*fresnel*0.7;" +
      "float alpha = 0.12 + fresnel*0.75 + t2*0.06;" +
      "gl_FragColor = vec4(col, clamp(alpha,0.0,1.0));" +
      "}";

    function glassMaterial(colorA, colorB) {
      return new THREE.ShaderMaterial({
        vertexShader: VS,
        fragmentShader: FS,
        uniforms: {
          uT: { value: 0 },
          uC1: { value: new THREE.Color(colorA) },
          uC2: { value: new THREE.Color(colorB) },
          camPos: { value: camera.position }
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false
      });
    }

    var root = new THREE.Group();
    scene.add(root);
    var animatedMaterials = [];

    function glassSurface(colorA, colorB) {
      var material = glassMaterial(colorA, colorB);
      animatedMaterials.push(material);
      return material;
    }

    function makeParticleCloud(options) {
      var count = options.count || 140;
      var positions = new Float32Array(count * 3);
      for (var i = 0; i < count; i += 1) {
        var radius = (options.minRadius || 4.2) + Math.random() * ((options.maxRadius || 6.8) - (options.minRadius || 4.2));
        var theta = Math.random() * Math.PI * 2;
        var phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);
      }

      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      var points = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          color: options.color || 0x9b5fff,
          size: options.size || 0.035,
          transparent: true,
          opacity: options.opacity || 0.5
        })
      );
      root.add(points);
      return points;
    }

    function makeFloatingSpheres(basePositions) {
      return basePositions.map(function (pos, index) {
        var radius = 0.12 + Math.random() * 0.2;
        var mesh = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 16, 16),
          new THREE.MeshStandardMaterial({
            color: index % 2 === 0 ? 0x9b5fff : 0x60a5ff,
            emissive: index % 2 === 0 ? 0x7b2fff : 0x2f6fff,
            emissiveIntensity: 1.8,
            metalness: 0.1,
            roughness: 0.05,
            transparent: true,
            opacity: 0.92
          })
        );
        mesh.position.set(pos[0], pos[1], pos[2]);
        mesh.userData = { base: pos.slice(), phase: index * 1.17 };
        root.add(mesh);
        return mesh;
      });
    }

    function buildHomeVariant() {
      var knot = new THREE.Mesh(
        new THREE.TorusKnotGeometry(1.9, 0.44, 220, 32, 2, 3),
        glassSurface("#7B2FFF", "#2F6FFF")
      );
      var wireframe = new THREE.Mesh(
        new THREE.TorusKnotGeometry(1.92, 0.45, 100, 18, 2, 3),
        new THREE.MeshBasicMaterial({
          color: 0x9b5fff,
          wireframe: true,
          transparent: true,
          opacity: 0.07
        })
      );
      var ringA = new THREE.Mesh(
        new THREE.TorusGeometry(3.4, 0.018, 12, 120),
        new THREE.MeshBasicMaterial({ color: 0x7b2fff, transparent: true, opacity: 0.28 })
      );
      var ringB = new THREE.Mesh(
        new THREE.TorusGeometry(2.7, 0.012, 12, 100),
        new THREE.MeshBasicMaterial({ color: 0x2f6fff, transparent: true, opacity: 0.2 })
      );
      var spheres = makeFloatingSpheres([
        [-2.8, 1.6, 0.6],
        [3.1, -1.3, -0.4],
        [-1.6, -2.5, 0.9],
        [3.2, 2.0, -1.1],
        [0.6, 3.0, 0.4],
        [-3.0, -0.8, -0.5]
      ]);
      var particles = makeParticleCloud({ count: 160, color: 0x9b5fff, size: 0.035, opacity: 0.55, minRadius: 4.5, maxRadius: 7.2 });

      ringA.rotation.x = Math.PI / 3.2;
      ringB.rotation.x = -Math.PI / 4;
      ringB.rotation.z = Math.PI / 6;

      root.add(knot);
      root.add(wireframe);
      root.add(ringA);
      root.add(ringB);

      return {
        update: function (t) {
          knot.rotation.y = t * 0.18;
          knot.rotation.x = Math.sin(t * 0.14) * 0.09;
          wireframe.rotation.copy(knot.rotation);
          ringA.rotation.z = t * 0.04;
          ringB.rotation.y = t * 0.06;
          particles.rotation.y = t * 0.025;

          spheres.forEach(function (sphere) {
            var phase = sphere.userData.phase;
            sphere.position.y = sphere.userData.base[1] + Math.sin(t + phase) * 0.32;
            sphere.position.x = sphere.userData.base[0] + Math.cos(t * 0.65 + phase) * 0.18;
          });
        }
      };
    }

    function buildWorkflowVariant() {
      var core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.7, 1),
        glassSurface("#60A5FF", "#7B2FFF")
      );
      var shell = new THREE.Mesh(
        new THREE.OctahedronGeometry(2.15, 0),
        new THREE.MeshBasicMaterial({ color: 0x9b5fff, wireframe: true, transparent: true, opacity: 0.11 })
      );
      var ringA = new THREE.Mesh(
        new THREE.TorusGeometry(2.85, 0.022, 16, 140),
        new THREE.MeshBasicMaterial({ color: 0x2f6fff, transparent: true, opacity: 0.3 })
      );
      var ringB = new THREE.Mesh(
        new THREE.TorusGeometry(2.35, 0.016, 16, 120),
        new THREE.MeshBasicMaterial({ color: 0x7b2fff, transparent: true, opacity: 0.24 })
      );
      var ringC = new THREE.Mesh(
        new THREE.TorusGeometry(1.95, 0.012, 16, 100),
        new THREE.MeshBasicMaterial({ color: 0x9b5fff, transparent: true, opacity: 0.16 })
      );
      var cubes = [
        [-2.4, 1.5, 0.2],
        [2.6, 1.3, -0.4],
        [-2.1, -1.7, 0.5],
        [2.2, -1.4, -0.7],
        [0.1, 2.5, 0.6],
        [0.2, -2.5, -0.5]
      ].map(function (pos, index) {
        var mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.32, 0.32, 0.32),
          new THREE.MeshStandardMaterial({
            color: index % 2 === 0 ? 0x60a5ff : 0x9b5fff,
            emissive: index % 2 === 0 ? 0x2f6fff : 0x7b2fff,
            emissiveIntensity: 1.4,
            metalness: 0.2,
            roughness: 0.12,
            transparent: true,
            opacity: 0.95
          })
        );
        mesh.position.set(pos[0], pos[1], pos[2]);
        mesh.userData = { base: pos.slice(), phase: index * 1.05 };
        root.add(mesh);
        return mesh;
      });
      var particles = makeParticleCloud({ count: 130, color: 0x60a5ff, size: 0.03, opacity: 0.42, minRadius: 4.2, maxRadius: 6.4 });

      ringA.rotation.x = Math.PI / 2.6;
      ringB.rotation.y = Math.PI / 3.4;
      ringB.rotation.z = Math.PI / 5;
      ringC.rotation.x = -Math.PI / 3.4;
      ringC.rotation.z = Math.PI / 4.8;

      root.add(core);
      root.add(shell);
      root.add(ringA);
      root.add(ringB);
      root.add(ringC);

      return {
        update: function (t) {
          core.rotation.x = t * 0.2;
          core.rotation.y = t * 0.26;
          shell.rotation.x = -t * 0.14;
          shell.rotation.y = t * 0.18;
          ringA.rotation.z = t * 0.09;
          ringB.rotation.x = -t * 0.11;
          ringC.rotation.y = t * 0.16;
          particles.rotation.y = t * 0.018;

          cubes.forEach(function (cube) {
            var phase = cube.userData.phase;
            cube.rotation.x += 0.005;
            cube.rotation.y += 0.007;
            cube.position.y = cube.userData.base[1] + Math.sin(t * 1.2 + phase) * 0.24;
            cube.position.x = cube.userData.base[0] + Math.cos(t * 0.7 + phase) * 0.12;
          });
        }
      };
    }

    function buildNarrativeVariant() {
      var ribbonGroup = new THREE.Group();
      var curveA = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-2.7, -1.2, 0.4),
        new THREE.Vector3(-1.0, 0.9, 0.7),
        new THREE.Vector3(0.2, -0.3, 0.2),
        new THREE.Vector3(1.6, 1.2, -0.5),
        new THREE.Vector3(2.8, -1.3, -0.2)
      ]);
      var curveB = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-2.4, 1.6, -0.2),
        new THREE.Vector3(-0.7, 0.2, -0.7),
        new THREE.Vector3(0.8, 1.1, 0.3),
        new THREE.Vector3(2.1, -0.2, 0.6),
        new THREE.Vector3(2.8, -1.7, -0.4)
      ]);
      var ribbonA = new THREE.Mesh(
        new THREE.TubeGeometry(curveA, 160, 0.16, 18, false),
        glassSurface("#9B5FFF", "#60A5FF")
      );
      var ribbonB = new THREE.Mesh(
        new THREE.TubeGeometry(curveB, 160, 0.11, 18, false),
        glassSurface("#7B2FFF", "#2F6FFF")
      );
      var core = new THREE.Mesh(
        new THREE.SphereGeometry(0.72, 32, 32),
        glassSurface("#7B2FFF", "#60A5FF")
      );
      var shell = new THREE.Mesh(
        new THREE.SphereGeometry(0.94, 20, 20),
        new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.09 })
      );
      var ring = new THREE.Mesh(
        new THREE.TorusGeometry(3.1, 0.018, 16, 140),
        new THREE.MeshBasicMaterial({ color: 0x9b5fff, transparent: true, opacity: 0.18 })
      );
      var pages = [
        [-2.1, 2.1, -0.3],
        [2.4, 1.8, 0.5],
        [-2.3, -2.0, 0.4],
        [2.0, -1.8, -0.5]
      ].map(function (pos, index) {
        var plane = new THREE.Mesh(
          new THREE.PlaneGeometry(0.52, 0.74),
          new THREE.MeshBasicMaterial({
            color: index % 2 === 0 ? 0x60a5ff : 0x9b5fff,
            transparent: true,
            opacity: 0.18,
            side: THREE.DoubleSide
          })
        );
        plane.position.set(pos[0], pos[1], pos[2]);
        plane.userData = { base: pos.slice(), phase: index * 1.3 };
        root.add(plane);
        return plane;
      });
      var particles = makeParticleCloud({ count: 110, color: 0x9b5fff, size: 0.03, opacity: 0.35, minRadius: 4.0, maxRadius: 6.1 });

      ring.rotation.x = Math.PI / 2.8;
      ribbonGroup.add(ribbonA);
      ribbonGroup.add(ribbonB);
      root.add(ribbonGroup);
      root.add(core);
      root.add(shell);
      root.add(ring);

      return {
        update: function (t) {
          ribbonGroup.rotation.y = t * 0.08;
          ribbonGroup.rotation.x = Math.sin(t * 0.3) * 0.12;
          core.rotation.y = -t * 0.14;
          core.rotation.x = t * 0.05;
          shell.rotation.y = t * 0.18;
          ring.rotation.z = t * 0.045;
          particles.rotation.y = -t * 0.02;

          pages.forEach(function (page) {
            var phase = page.userData.phase;
            page.rotation.y = Math.sin(t * 0.8 + phase) * 0.7;
            page.rotation.x = Math.cos(t * 0.6 + phase) * 0.35;
            page.position.y = page.userData.base[1] + Math.sin(t + phase) * 0.18;
          });
        }
      };
    }

    function buildMemoryVariant() {
      var spine = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 4.0, 16),
        new THREE.MeshBasicMaterial({ color: 0x60a5ff, transparent: true, opacity: 0.18 })
      );
      var layerConfigs = [
        { y: 1.45, radius: 0.72, ring: 1.15, colors: ["#60A5FF", "#7B2FFF"] },
        { y: 0, radius: 0.84, ring: 1.36, colors: ["#7B2FFF", "#9B5FFF"] },
        { y: -1.45, radius: 0.68, ring: 1.05, colors: ["#9B5FFF", "#60A5FF"] }
      ];
      var layers = layerConfigs.map(function (cfg, index) {
        var sphere = new THREE.Mesh(
          new THREE.SphereGeometry(cfg.radius, 28, 28),
          glassSurface(cfg.colors[0], cfg.colors[1])
        );
        sphere.scale.z = 0.78;
        sphere.position.y = cfg.y;
        var ring = new THREE.Mesh(
          new THREE.TorusGeometry(cfg.ring, 0.018, 16, 120),
          new THREE.MeshBasicMaterial({
            color: index === 1 ? 0x2f6fff : 0x9b5fff,
            transparent: true,
            opacity: 0.24
          })
        );
        ring.position.y = cfg.y;
        ring.rotation.x = Math.PI / 2;
        root.add(sphere);
        root.add(ring);
        return { sphere: sphere, ring: ring, phase: index * 1.2 };
      });
      var nodes = [];
      layerConfigs.forEach(function (cfg, layerIndex) {
        for (var i = 0; i < 3; i += 1) {
          var node = new THREE.Mesh(
            new THREE.SphereGeometry(0.13, 14, 14),
            new THREE.MeshStandardMaterial({
              color: layerIndex % 2 === 0 ? 0x60a5ff : 0x9b5fff,
              emissive: layerIndex % 2 === 0 ? 0x2f6fff : 0x7b2fff,
              emissiveIntensity: 1.5,
              metalness: 0.12,
              roughness: 0.08
            })
          );
          node.userData = {
            layerY: cfg.y,
            angle: (Math.PI * 2 * i) / 3,
            radius: cfg.ring + 0.18,
            speed: 0.4 + layerIndex * 0.15
          };
          root.add(node);
          nodes.push(node);
        }
      });
      var particles = makeParticleCloud({ count: 120, color: 0x60a5ff, size: 0.03, opacity: 0.38, minRadius: 3.8, maxRadius: 5.8 });

      root.add(spine);

      return {
        update: function (t) {
          particles.rotation.y = t * 0.024;
          layers.forEach(function (layer, index) {
            var pulse = 1 + Math.sin(t * 1.2 + layer.phase) * 0.04;
            layer.sphere.scale.x = pulse;
            layer.sphere.scale.y = pulse;
            layer.ring.rotation.z = t * (index % 2 === 0 ? 0.12 : -0.1);
          });

          nodes.forEach(function (node, index) {
            var angle = t * node.userData.speed + node.userData.angle;
            node.position.x = Math.cos(angle) * node.userData.radius;
            node.position.z = Math.sin(angle) * node.userData.radius;
            node.position.y = node.userData.layerY + Math.sin(t * 1.4 + index) * 0.12;
          });
        }
      };
    }

    function buildResearchVariant() {
      var crystal = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.02, 0),
        glassSurface("#7B2FFF", "#60A5FF")
      );
      var shell = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.48, 1),
        new THREE.MeshBasicMaterial({ color: 0x9b5fff, wireframe: true, transparent: true, opacity: 0.09 })
      );
      var torusA = new THREE.Mesh(
        new THREE.TorusGeometry(2.25, 0.12, 24, 180),
        glassSurface("#9B5FFF", "#2F6FFF")
      );
      var torusB = new THREE.Mesh(
        new THREE.TorusGeometry(1.7, 0.08, 24, 140),
        glassSurface("#60A5FF", "#7B2FFF")
      );
      var orbit = new THREE.Mesh(
        new THREE.TorusGeometry(3.05, 0.018, 14, 140),
        new THREE.MeshBasicMaterial({ color: 0x2f6fff, transparent: true, opacity: 0.2 })
      );
      var spheres = makeFloatingSpheres([
        [-2.5, 1.7, 0.3],
        [2.7, 1.4, -0.6],
        [-2.2, -1.9, 0.5],
        [2.1, -1.7, -0.4]
      ]);
      var particles = makeParticleCloud({ count: 130, color: 0x9b5fff, size: 0.03, opacity: 0.45, minRadius: 4.1, maxRadius: 6.3 });

      torusA.rotation.x = Math.PI / 2.9;
      torusA.rotation.z = Math.PI / 7;
      torusB.rotation.y = Math.PI / 4.1;
      torusB.rotation.z = -Math.PI / 5.5;
      orbit.rotation.x = -Math.PI / 3.3;

      root.add(crystal);
      root.add(shell);
      root.add(torusA);
      root.add(torusB);
      root.add(orbit);

      return {
        update: function (t) {
          crystal.rotation.x = t * 0.12;
          crystal.rotation.y = t * 0.18;
          shell.rotation.y = -t * 0.11;
          torusA.rotation.y = t * 0.09;
          torusB.rotation.x = -t * 0.1;
          orbit.rotation.z = t * 0.04;
          particles.rotation.y = t * 0.02;

          spheres.forEach(function (sphere) {
            var phase = sphere.userData.phase;
            sphere.position.y = sphere.userData.base[1] + Math.sin(t + phase) * 0.22;
            sphere.position.x = sphere.userData.base[0] + Math.cos(t * 0.55 + phase) * 0.14;
          });
        }
      };
    }

    var variant = options.variant || "home";
    var sceneVariant;
    if (variant === "workflow") sceneVariant = buildWorkflowVariant();
    else if (variant === "narrative") sceneVariant = buildNarrativeVariant();
    else if (variant === "memory") sceneVariant = buildMemoryVariant();
    else if (variant === "research") sceneVariant = buildResearchVariant();
    else sceneVariant = buildHomeVariant();

    var mouseX = 0;
    var mouseY = 0;
    var targetRotationX = 0;
    var targetRotationY = 0;
    var isRunning = true;

    function onMouseMove(event) {
      mouseX = (event.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (event.clientY / window.innerHeight - 0.5) * 2;
      targetRotationY = mouseX * 0.32;
      targetRotationX = -mouseY * 0.22;
    }

    document.addEventListener("mousemove", onMouseMove);

    function onResize() {
      var size = getHeroSize();
      renderer.setSize(size.w, size.h);
      camera.aspect = size.w / size.h;
      camera.updateProjectionMatrix();
    }

    window.addEventListener("resize", onResize);

    var t = 0;
    function animate() {
      if (!isRunning) return;
      requestAnimationFrame(animate);
      t += 0.011;

      animatedMaterials.forEach(function (material) {
        material.uniforms.uT.value = t;
        material.uniforms.camPos.value.copy(camera.position);
      });

      sceneVariant.update(t);

      root.rotation.y += (targetRotationY - root.rotation.y) * 0.055;
      root.rotation.x += (targetRotationX - root.rotation.x) * 0.055;

      renderer.render(scene, camera);
    }

    function onVisibilityChange() {
      isRunning = !document.hidden;
      if (isRunning) animate();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    animate();

    return {
      destroy: function () {
        isRunning = false;
        document.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("resize", onResize);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        renderer.dispose();
      }
    };
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise(function (resolve, reject) {
      var input = document.createElement("textarea");
      input.value = text;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      input.style.pointerEvents = "none";
      document.body.appendChild(input);
      input.focus();
      input.select();

      try {
        var ok = document.execCommand("copy");
        document.body.removeChild(input);
        if (!ok) throw new Error("Copy command failed");
        resolve();
      } catch (error) {
        document.body.removeChild(input);
        reject(error);
      }
    });
  }

  window.NexusTheme = {
    animateNumber: animateNumber,
    mountMarquee: mountMarquee,
    setupNav: setupNav,
    setupScrollProgress: setupScrollProgress,
    setupHeroIntro: setupHeroIntro,
    setupReveal: setupReveal,
    createHeroScene: createHeroScene,
    copyText: copyText
  };
})();
