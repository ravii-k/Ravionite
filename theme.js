(function () {
  function getSupabaseUrl() {
    return document.documentElement.dataset.supabaseUrl || "";
  }

  function getPublicGatewayEndpoint() {
    if (window.__RAVIONITE_CONFIG__ && window.__RAVIONITE_CONFIG__.publicGatewayEndpoint) {
      return window.__RAVIONITE_CONFIG__.publicGatewayEndpoint;
    }

    var baseUrl = getSupabaseUrl().replace(/\/+$/, "");
    return baseUrl ? baseUrl + "/functions/v1/public-site-gateway" : "/.netlify/functions/site-gateway";
  }

  async function callPublicGateway(action, payload) {
    var endpoint = getPublicGatewayEndpoint();
    if (!endpoint) {
      throw new Error("Supabase project URL is missing from the page.");
    }

    var response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ action: action }, payload || {}))
    });

    var text = await response.text();
    var data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (_error) {
        data = { error: text };
      }
    }

    if (!response.ok) {
      throw new Error((data && (data.error || data.message)) || "Unable to complete this request right now.");
    }

    return data;
  }

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

    var widthRatio = options.widthRatio || 0.5;
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
    camera.position.set(0, 0, 10);

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
    root.scale.setScalar(options.sceneScale || 0.8);
    root.position.x = typeof options.sceneX === "number" ? options.sceneX : 0;
    root.position.y = typeof options.sceneY === "number" ? options.sceneY : 0;
    scene.add(root);
    var animatedMaterials = [];

    function glassSurface(colorA, colorB) {
      var material = glassMaterial(colorA, colorB);
      animatedMaterials.push(material);
      return material;
    }

    function makeParticleCloud(options) {
      var count = options.count || 96;
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
      var particles = makeParticleCloud({ count: 108, color: 0x9b5fff, size: 0.032, opacity: 0.42, minRadius: 4.5, maxRadius: 7.0 });

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
      var particles = makeParticleCloud({ count: 92, color: 0x60a5ff, size: 0.028, opacity: 0.34, minRadius: 4.2, maxRadius: 6.2 });

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
      var particles = makeParticleCloud({ count: 82, color: 0x9b5fff, size: 0.028, opacity: 0.28, minRadius: 4.0, maxRadius: 6.0 });

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
      var particles = makeParticleCloud({ count: 88, color: 0x60a5ff, size: 0.028, opacity: 0.3, minRadius: 3.8, maxRadius: 5.6 });

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

    function buildFounderVariant() {
      var sphere = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.45, 3),
        glassSurface("#7B2FFF", "#60A5FF")
      );
      sphere.position.x = 0.85;
      var wire = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.48, 2),
        new THREE.MeshBasicMaterial({ color: 0xc4b5fd, wireframe: true, transparent: true, opacity: 0.14 })
      );
      wire.position.copy(sphere.position);
      var edge = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.58, 1),
        new THREE.MeshBasicMaterial({ color: 0x9b5fff, wireframe: true, transparent: true, opacity: 0.08 })
      );
      edge.position.copy(sphere.position);
      var ringA = new THREE.Mesh(
        new THREE.TorusGeometry(2.12, 0.014, 12, 140),
        new THREE.MeshBasicMaterial({ color: 0x60a5ff, transparent: true, opacity: 0.34 })
      );
      var ringB = new THREE.Mesh(
        new THREE.TorusGeometry(2.42, 0.01, 12, 140),
        new THREE.MeshBasicMaterial({ color: 0x9b5fff, transparent: true, opacity: 0.22 })
      );
      var ringC = new THREE.Mesh(
        new THREE.TorusGeometry(2.78, 0.006, 12, 120),
        new THREE.MeshBasicMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0.12 })
      );
      [ringA, ringB, ringC].forEach(function (ring) {
        ring.position.copy(sphere.position);
      });
      ringA.rotation.x = Math.PI / 2;
      ringB.rotation.x = Math.PI / 3.2;
      ringB.rotation.z = 0.36;
      ringC.rotation.x = -Math.PI / 4.2;
      ringC.rotation.z = -0.42;

      var cubes = [
        [3.6, 2.2, -0.8, 0.18],
        [2.8, 2.8, -0.3, 0.14],
        [-0.8, 2.1, -1.1, 0.12],
        [4.2, 0.8, -0.5, 0.12],
        [0.6, -2.6, 0.3, 0.18],
        [3.4, -1.9, -0.4, 0.14]
      ].map(function (item, index) {
        var mesh = new THREE.Mesh(
          new THREE.BoxGeometry(item[3], item[3], item[3]),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.46 + (index % 3) * 0.1 })
        );
        mesh.position.set(item[0], item[1], item[2]);
        mesh.userData = {
          base: item.slice(0, 3),
          phase: index * 0.92,
          rotX: index % 2 === 0 ? 0.003 : -0.0025,
          rotY: 0.0035 + index * 0.0004
        };
        root.add(mesh);
        return mesh;
      });
      var particles = makeParticleCloud({ count: 64, color: 0xffffff, size: 0.023, opacity: 0.24, minRadius: 3.6, maxRadius: 5.8 });

      root.add(sphere);
      root.add(wire);
      root.add(edge);
      root.add(ringA);
      root.add(ringB);
      root.add(ringC);

      return {
        update: function (t) {
          sphere.rotation.y = t * 0.12;
          sphere.rotation.x = t * 0.05;
          wire.rotation.copy(sphere.rotation);
          edge.rotation.y = -t * 0.08;
          edge.rotation.x = t * 0.04;
          ringA.rotation.z = t * 0.08;
          ringB.rotation.z = -t * 0.05;
          ringC.rotation.y = t * 0.035;
          particles.rotation.y = t * 0.01;

          cubes.forEach(function (cube) {
            cube.rotation.x += cube.userData.rotX;
            cube.rotation.y += cube.userData.rotY;
            cube.position.x = cube.userData.base[0] + Math.sin(t * 0.42 + cube.userData.phase) * 0.08;
            cube.position.y = cube.userData.base[1] + Math.cos(t * 0.3 + cube.userData.phase) * 0.07;
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
      var particles = makeParticleCloud({ count: 96, color: 0x9b5fff, size: 0.028, opacity: 0.34, minRadius: 4.1, maxRadius: 6.1 });

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
    else if (variant === "founder") sceneVariant = buildFounderVariant();
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
      targetRotationY = mouseX * 0.16;
      targetRotationX = -mouseY * 0.1;
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
      t += 0.008;

      animatedMaterials.forEach(function (material) {
        material.uniforms.uT.value = t;
        material.uniforms.camPos.value.copy(camera.position);
      });

      sceneVariant.update(t);

      root.rotation.y += (targetRotationY - root.rotation.y) * 0.036;
      root.rotation.x += (targetRotationX - root.rotation.x) * 0.036;

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

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setupContactForm() {
    var form = document.getElementById("contact-form");
    var message = document.getElementById("contact-message");
    var counter = document.getElementById("contact-word-count");
    var status = document.getElementById("contact-status");
    var submit = form ? form.querySelector('button[type="submit"]') : null;
    var honeypot = form ? form.querySelector('input[name="company"]') : null;
    var limit = 200;
    var defaultStatus = "Keep it direct. A sharp first message is easier to respond to well.";
    var limitStatus = "Word limit reached. Tighten the brief before sending.";

    if (!form || !message || !counter) return;

    function words(value) {
      return value.trim().match(/\S+/g) || [];
    }

    function setStatus(text, tone) {
      if (!status) return;
      status.textContent = text;
      status.className = tone ? "contact-status is-" + tone : "contact-status";
    }

    function setSubmitting(isSubmitting) {
      if (!submit) return;
      submit.disabled = isSubmitting;
      submit.textContent = isSubmitting ? "Sending..." : "Send Brief";
    }

    function syncCounter() {
      var list = words(message.value);
      if (list.length > limit) {
        message.value = list.slice(0, limit).join(" ");
        list = words(message.value);
      }

      counter.textContent = list.length + " / " + limit + " words";
      counter.classList.toggle("limit-hit", list.length >= limit);

      if (list.length >= limit) {
        setStatus(limitStatus, "warning");
      } else if (status && status.textContent === limitStatus) {
        setStatus(defaultStatus, "");
      }

      return list.length;
    }

    setStatus(defaultStatus, "");
    syncCounter();
    message.addEventListener("input", syncCounter);

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      var wordCount = syncCounter();
      var formData = new FormData(form);
      var name = String(formData.get("name") || "").trim();
      var email = String(formData.get("email") || "").trim();
      var body = String(formData.get("message") || "").trim();
      var company = honeypot ? honeypot.value.trim() : "";

      if (!name || !email || !body || !wordCount) {
        setStatus("Please fill out your name, email, and message before sending.", "warning");
        return;
      }

      setSubmitting(true);
      setStatus("Sending your brief...", "");

      try {
        await callPublicGateway("contact", {
          name: name,
          email: email,
          message: body,
          company: company,
          source: "ravionite-website"
        });

        form.reset();
        syncCounter();
        setStatus("Sent", "success");
      } catch (error) {
        setStatus(error.message || "Unable to send right now. Please try again later.", "warning");
      } finally {
        setSubmitting(false);
      }
    });
  }

  function setupSampleChapterAccess() {
    var button = document.getElementById("sample-chapters-btn");
    var status = document.getElementById("sample-chapters-status");
    if (!button || !status) return;

    function setStatus(text, tone) {
      status.textContent = text;
      status.className = tone ? "contact-status is-" + tone : "contact-status";
    }

    function setButtonState(isBusy) {
      button.disabled = isBusy;
      button.textContent = isBusy ? "Preparing Secure Link..." : "Open Secure Sample Chapters";
    }

    button.addEventListener("click", async function () {
      setButtonState(true);
      setStatus("Preparing a short-lived private link...", "");

      try {
        var payload = await callPublicGateway("sample_chapter", {});
        if (payload && payload.url) {
          window.open(payload.url, "_blank", "noopener,noreferrer");
          setStatus("Secure link ready.", "success");
        } else {
          throw new Error("The private sample link did not return a URL.");
        }
      } catch (error) {
        setStatus(error.message || "Sample chapters are temporarily unavailable.", "warning");
      } finally {
        setButtonState(false);
      }
    });
  }

  function setupThoughtArchive() {
    var grid = document.getElementById("thoughts-grid");
    var toggle = document.getElementById("thoughts-toggle");
    if (!grid) return;

    var expanded = false;
    var seed = Array.isArray(window.RavioniteThoughtsSeed) ? window.RavioniteThoughtsSeed.slice() : [];
    var thoughts = seed.map(function (body, index) {
      return { id: "seed-" + index, body: body };
    });

    function render() {
      var visible = expanded ? thoughts : thoughts.slice(0, 4);
      grid.innerHTML = visible.map(function (thought) {
        return '<div class="quote-card" data-reveal><div class="quote-text">' + escapeHtml(thought.body || "") + '</div></div>';
      }).join("");

      if (toggle) {
        toggle.hidden = thoughts.length <= 4;
        toggle.textContent = expanded ? "Show Fewer Thoughts" : "See More Thoughts";
      }
    }

    if (toggle) {
      toggle.addEventListener("click", function () {
        expanded = !expanded;
        render();
      });
    }

    render();

    callPublicGateway("latest_thoughts", { limit: 12 }).then(function (payload) {
      var next = payload && Array.isArray(payload.thoughts) ? payload.thoughts : [];
      if (!next.length) return;
      thoughts = next;
      render();
    }).catch(function () {
      render();
    });
  }

  window.NexusTheme = {
    animateNumber: animateNumber,
    mountMarquee: mountMarquee,
    setupNav: setupNav,
    setupScrollProgress: setupScrollProgress,
    setupHeroIntro: setupHeroIntro,
    setupReveal: setupReveal,
    setupContactForm: setupContactForm,
    setupThoughtArchive: setupThoughtArchive,
    setupSampleChapterAccess: setupSampleChapterAccess,
    createHeroScene: createHeroScene,
    copyText: copyText
  };
})();
