/* Page: inline figures, background and demo playback, navigation, citation, and wheel inertia. */
(function () {
  function setupInlineFigures() {
    var figures = Array.from(document.querySelectorAll('img[data-inline-svg]'));
    var observer;

    function loadFigure(placeholder) {
      if (observer) observer.unobserve(placeholder);
      var name = placeholder.getAttribute('data-inline-svg');
      if (!['main', 'teaser', 'attention', 'tsne', 'real_exp'].includes(name)) return;
      var resource = document.createElement('script');
      // A local script works on both HTTP and file://, where fetch is restricted.
      var resourceUrl = new URL('inline/' + name + '.js', placeholder.src);
      // Share the generated figure version so cached JS cannot restore an old SVG.
      resourceUrl.search = new URL(placeholder.src).search;
      resource.src = resourceUrl.href;
      resource.async = true;
      resource.onload = function () {
        var sources = window.__mopaInlineFigures || {};
        var markup = sources[name];
        delete sources[name];
        resource.remove();
        if (typeof markup !== 'string' || !placeholder.isConnected) return;
        try {
          var parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
          if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg')
            throw new Error('Invalid SVG');
          var svg = document.importNode(parsed.documentElement, true);
          svg.classList.add('paper-figure-svg');
          svg.setAttribute('data-inline-svg', name);
          svg.setAttribute('width', placeholder.getAttribute('width'));
          svg.setAttribute('height', placeholder.getAttribute('height'));
          svg.setAttribute('role', 'img');
          // Keep the accessible description without a native hover tooltip.
          svg.setAttribute('aria-label', placeholder.alt);
          svg.setAttribute('focusable', 'false');
          // Replace only after parsing; the original image remains a fallback.
          placeholder.replaceWith(svg);
        } catch (error) {
          console.warn('Unable to inline figure ' + name + '; keeping the image.', error);
        }
      };
      resource.onerror = function () { resource.remove(); };
      document.head.appendChild(resource);
    }

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) loadFigure(entry.target);
        });
      }, { rootMargin: '500px 0px' });
      figures.forEach(function (figure) { observer.observe(figure); });
    } else {
      figures.forEach(loadFigure);
    }
  }

  function setupHeroBackground() {
    var video = document.querySelector('video[data-hero-video]');
    if (!video) return;
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var visible = false;
    var saveData = navigator.connection && navigator.connection.saveData;
    var fallbackSource = video.querySelector('source');
    var fallbackSrc = fallbackSource && fallbackSource.getAttribute('src');
    var sourceSelected = false;
    var using4k = false;

    function update() {
      var enabled = !reducedMotion.matches && !saveData;
      if (enabled && visible && !document.hidden) {
        if (!sourceSelected) {
          sourceSelected = true;
          var source4k = video.getAttribute('data-hero-4k-src');
          // Large screens can use 4K HEVC; smaller screens keep the lighter H.264 file.
          using4k = Boolean(source4k && fallbackSrc &&
            window.matchMedia('(min-width: 1200px)').matches &&
            video.canPlayType('video/mp4; codecs="hvc1"'));
          if (using4k) video.src = source4k;
        }
        video.play().catch(function () { /* Keep the poster if autoplay is unavailable. */ });
      } else {
        video.pause();
      }
    }
    // The file already contains the full recording at 2× speed.
    video.muted = true;
    video.addEventListener('error', function () {
      if (!using4k) return;
      using4k = false;
      video.src = fallbackSrc;
      update();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        update();
      }).observe(video);
    } else {
      visible = true;
    }
    document.addEventListener('visibilitychange', update);
    if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', update);
    else reducedMotion.addListener(update);
    update();
  }

  function setupDemoVideos() {
    var videos = Array.from(document.querySelectorAll('video[data-demo-video]'));
    if (!videos.length || !('IntersectionObserver' in window)) return;
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var states = new Map();

    function update(video, state) {
      var active = state.visible && !document.hidden && !reducedMotion.matches;
      // Capture manual pause once, before any automatic pause conditions stack.
      if (state.active && !active) state.resume = !video.paused;
      state.active = active;
      if (active) {
        if (state.resume) video.play().catch(function () { /* Native controls remain available. */ });
      } else {
        video.pause();
      }
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var video = entry.target;
        var state = states.get(video);
        var visible = entry.isIntersecting && entry.intersectionRatio >= 0.15;
        state.visible = visible;
        update(video, state);
      });
    }, { threshold: 0.15 });

    videos.forEach(function (video) {
      // Speed is already baked into the files; play them at their normal rate.
      video.muted = true;
      states.set(video, { visible: false, active: false, resume: true });
      observer.observe(video);
    });
    document.addEventListener('visibilitychange', function () {
      states.forEach(function (state, video) {
        update(video, state);
      });
    });
    function updateMotionPreference() {
      states.forEach(function (state, video) { update(video, state); });
    }
    if (reducedMotion.addEventListener)
      reducedMotion.addEventListener('change', updateMotionPreference);
    else reducedMotion.addListener(updateMotionPreference);
  }

  function setupInertia() {
    var root = document.documentElement;
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var desktopPointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    var frame = 0;
    var current = window.scrollY;
    var target = current;
    var expectedPosition = current;
    var previousTime = 0;
    var direction = 0;
    var precisionUntil = 0;

    function limit(value) {
      var maximum = Math.max(0, root.scrollHeight - window.innerHeight);
      return Math.max(0, Math.min(value, maximum));
    }

    function stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      direction = 0;
      current = target = expectedPosition = window.scrollY;
      root.classList.remove('is-inertia-scrolling');
    }

    function prefersNativeScroll(element) {
      if (!(element instanceof Element)) return false;
      if (element.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), video, audio, iframe, [data-native-scroll], .citation-code'))
        return true;
      while (element && element !== document.body && element !== root) {
        var style = getComputedStyle(element);
        if (
          (/(auto|scroll|overlay)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1) ||
          (/(auto|scroll|overlay)/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 1)
        ) return true;
        element = element.parentElement;
      }
      return false;
    }

    function advance(time) {
      // A native/programmatic jump takes precedence over pending wheel motion.
      if (Math.abs(window.scrollY - expectedPosition) > 3) {
        stop();
        return;
      }
      var elapsed = previousTime ? Math.min(time - previousTime, 64) : 1000 / 60;
      previousTime = time;
      target = limit(target);
      // Keep fractional progress internally so the last pixels cannot stall.
      current += (target - current) * (1 - Math.exp(-elapsed / 110));
      var settled = Math.abs(target - current) < 0.5;
      if (settled) current = target;
      window.scrollTo({ left: window.scrollX, top: current, behavior: 'instant' });
      expectedPosition = window.scrollY;
      if (settled) stop();
      else frame = requestAnimationFrame(advance);
    }

    window.addEventListener('wheel', function (event) {
      if (
        reducedMotion.matches || !desktopPointer.matches ||
        event.defaultPrevented || !event.cancelable ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        event.deltaX !== 0 || event.deltaY === 0 || prefersNativeScroll(event.target)
      ) {
        stop();
        return;
      }

      // Fine pixel gestures usually already carry trackpad momentum. Keep the
      // rest of that gesture native, including its larger subsequent deltas.
      var now = performance.now();
      if (event.deltaMode === 0 && (Math.abs(event.deltaY) < 50 || !Number.isInteger(event.deltaY)))
        precisionUntil = now + 180;
      if (event.deltaMode === 0 && now < precisionUntil) {
        precisionUntil = now + 180;
        stop();
        return;
      }

      if (frame && Math.abs(window.scrollY - expectedPosition) > 3) stop();
      var nextDirection = Math.sign(event.deltaY);
      if (!frame || nextDirection !== direction) {
        current = target = expectedPosition = window.scrollY;
      }
      direction = nextDirection;
      var scale = event.deltaMode === 1
        ? parseFloat(getComputedStyle(document.body).lineHeight) || 24
        : event.deltaMode === 2 ? window.innerHeight : 1;
      target = limit(target + event.deltaY * scale);
      if (Math.abs(target - window.scrollY) < 0.5) {
        stop();
        return;
      }
      event.preventDefault();
      if (!frame) {
        root.classList.add('is-inertia-scrolling');
        frame = requestAnimationFrame(advance);
      }
    }, { passive: false });

    // Hand control back before native navigation, focus, or direct scrolling.
    ['pointerdown', 'touchstart', 'keydown', 'click', 'focusin'].forEach(function (type) {
      document.addEventListener(type, stop, { capture: true, passive: true });
    });
    ['resize', 'hashchange', 'blur', 'pagehide', 'pageshow'].forEach(function (type) {
      window.addEventListener(type, stop, { passive: true });
    });
    document.addEventListener('visibilitychange', stop);
    [reducedMotion, desktopPointer].forEach(function (query) {
      if (query.addEventListener) query.addEventListener('change', stop);
      else query.addListener(stop);
    });
  }

  function setupSideNavigation() {
    var navigation = document.querySelector('[data-section-nav]');
    if (!navigation) return;
    var header = navigation.closest('.site-header');
    var hero = document.getElementById('overview');
    var compact = window.matchMedia('(max-width: 1100px)');
    var toggle = navigation.querySelector('summary');
    function updateVisibility() {
      // Match the anchor inset so a direct #method visit also reveals the menu.
      var inset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      var visible = !hero || hero.getBoundingClientRect().bottom <= inset + 1;
      header.classList.toggle('is-visible', visible);
      header.inert = !visible;
      if (!visible && compact.matches) navigation.open = false;
      // Show reading progress through the content, excluding the full-screen cover.
      var contentStart = hero ? hero.getBoundingClientRect().bottom + window.scrollY - inset : 0;
      var scrollRange = document.documentElement.scrollHeight - window.innerHeight - contentStart;
      var progress = visible && scrollRange > 0
        ? Math.max(0, Math.min(1, (window.scrollY - contentStart) / scrollRange)) : 0;
      header.style.setProperty('--nav-progress', progress.toFixed(4));
    }
    function syncLayout() {
      navigation.open = !compact.matches;
      updateVisibility();
    }
    syncLayout();
    if (compact.addEventListener) compact.addEventListener('change', syncLayout);
    else compact.addListener(syncLayout);
    navigation.addEventListener('click', function (event) {
      if (compact.matches && event.target.closest('a')) navigation.open = false;
    });
    document.addEventListener('pointerdown', function (event) {
      if (compact.matches && navigation.open && !navigation.contains(event.target))
        navigation.open = false;
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && compact.matches && navigation.open) {
        navigation.open = false;
        toggle.focus();
      }
    });
    window.addEventListener('resize', updateVisibility);
    window.addEventListener('pageshow', updateVisibility);
    if (hero && 'ResizeObserver' in window)
      new ResizeObserver(updateVisibility).observe(hero);
    return updateVisibility;
  }

  function setupSectionReveals() {
    // Content stays visible if JavaScript or IntersectionObserver is unavailable.
    if (!('IntersectionObserver' in window)) return;
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches) return;
    var pending = new Set(document.querySelectorAll('[data-section-reveal]'));
    if (!pending.size) return;

    function cleanup() {
      observer.disconnect();
      document.removeEventListener('focusin', revealFocusedSection);
      if (reducedMotion.removeEventListener)
        reducedMotion.removeEventListener('change', updateMotionPreference);
      else reducedMotion.removeListener(updateMotionPreference);
    }

    function reveal(section) {
      if (!pending.delete(section)) return;
      section.classList.remove('reveal-pending');
      observer.unobserve(section);
      if (!pending.size) cleanup();
    }

    function revealFocusedSection(event) {
      if (event.target instanceof Element)
        reveal(event.target.closest('[data-section-reveal]'));
    }

    function updateMotionPreference() {
      if (reducedMotion.matches) pending.forEach(reveal);
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) reveal(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -64px 0px' });

    document.addEventListener('focusin', revealFocusedSection);
    if (reducedMotion.addEventListener)
      reducedMotion.addEventListener('change', updateMotionPreference);
    else reducedMotion.addListener(updateMotionPreference);
    pending.forEach(function (section) {
      section.classList.add('reveal-pending');
    });
    // Paint the starting state before observing, including on direct hash visits.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        pending.forEach(function (section) { observer.observe(section); });
      });
    });
  }

  function start() {
    if (window.__paperPageReady) return;
    window.__paperPageReady = 'true';
    var updateSideNavigation = setupSideNavigation();
    setupInlineFigures();
    setupHeroBackground();
    setupDemoVideos();
    var copyButton = document.querySelector('[data-copy-citation]');
    var resetTimer;
    if (copyButton)
      copyButton.addEventListener('click', async function () {
        var code = document.getElementById('bibtex');
        var status = document.querySelector('[data-copy-status]');
        var label = document.querySelector('[data-copy-label]');
        if (!code || !status || !label) return;
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(code.textContent);
          } else {
            var range = document.createRange();
            range.selectNodeContents(code);
            var selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            if (!document.execCommand('copy'))
              throw new Error('Manual copy required');
            selection.removeAllRanges();
          }
          label.textContent = 'Copied';
          status.textContent = 'BibTeX copied to clipboard.';
        } catch (_) {
          var range = document.createRange();
          range.selectNodeContents(code);
          var selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          label.textContent = 'Text selected';
          status.textContent =
            'Press Command+C or Ctrl+C to copy the selected citation.';
        }
        clearTimeout(resetTimer);
        resetTimer = setTimeout(function () {
          label.textContent = 'Copy BibTeX';
        }, 3000);
      });
    var links = Array.from(document.querySelectorAll('nav a'));
    var targets = links
      .map(function (link) {
        return document.querySelector(link.getAttribute('href'));
      })
      .filter(Boolean);
    var scheduled = false;
    function updateNav() {
      scheduled = false;
      if (updateSideNavigation) updateSideNavigation();
      var active = null;
      targets.forEach(function (section) {
        if (section.getBoundingClientRect().top <= 180) active = section.id;
      });
      // A short final section may not reach the activation line above.
      if (targets.length && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2)
        active = targets[targets.length - 1].id;
      links.forEach(function (link) {
        if (link.getAttribute('href') === '#' + active)
          link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
    window.addEventListener(
      'scroll',
      function () {
        if (!scheduled) {
          scheduled = true;
          requestAnimationFrame(updateNav);
        }
      },
      { passive: true },
    );
    updateNav();
    setupInertia();
    setupSectionReveals();
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
