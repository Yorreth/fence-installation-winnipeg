(() => {
  // Footer year
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Marquee: the loop relies on two identical, side-by-side groups and a
  // translateX(-50%) animation, which only stays seamless if EACH group is
  // at least as wide as the browser window — otherwise there's a stretch of
  // the loop where neither copy reaches across the screen, i.e. a blank gap.
  // The static markup only has one short copy of the trust list per group,
  // which isn't wide enough on most desktop monitors. So before starting
  // the animation, keep duplicating each group's content (in lockstep, so
  // both stay identical) until it comfortably outruns the widest screen we
  // might be on. Also wait for webfonts to finish loading first, since a
  // font swap mid-animation would reflow the text and throw off the
  // percentage-based transform the same way.
  const marqueeTrack = document.querySelector('.marquee-track');
  if (marqueeTrack) {
    const prepareAndStartMarquee = () => {
      const groups = Array.from(marqueeTrack.querySelectorAll('.marquee-group'));
      if (groups.length === 2) {
        const unitMarkup = groups[0].innerHTML;
        const targetWidth = Math.max(window.innerWidth, screen.width || 0) * 1.5;
        let guard = 0;
        while (groups[0].getBoundingClientRect().width < targetWidth && guard < 25) {
          groups.forEach((g) => g.insertAdjacentHTML('beforeend', unitMarkup));
          guard++;
        }
        // Set the duration from the group's actual width so the scroll speed
        // stays the same on every screen size, instead of a fixed 22s that
        // gets faster the more copies wider screens need.
        const PIXELS_PER_SECOND = 60;
        const groupWidth = groups[0].getBoundingClientRect().width;
        marqueeTrack.style.animationDuration = `${groupWidth / PIXELS_PER_SECOND}s`;
      }
      marqueeTrack.classList.add('is-running');
    };
    if (document.fonts && document.fonts.ready) {
      Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]).then(prepareAndStartMarquee).catch(prepareAndStartMarquee);
    } else {
      prepareAndStartMarquee();
    }
  }

  // Header scroll state
  const header = document.getElementById('header');
  if (header) {
    const onScroll = () => {
      if (window.scrollY > 12) header.classList.add('scrolled');
      else header.classList.remove('scrolled');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Mobile nav toggle
  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('main-nav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      const open = mainNav.classList.toggle('open');
      navToggle.classList.toggle('open', open);
      navToggle.setAttribute('aria-expanded', String(open));
    });
    mainNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('open');
        navToggle.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // FAQ accordion
  document.querySelectorAll('.faq-question').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const open = item.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  // Reveal-on-scroll
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in-view'));
  }

  // ---------- Multi-step lead form ----------
  const form = document.getElementById('leadForm');
  if (form) {
    const steps = Array.from(form.querySelectorAll('.form-step'));
    const dots = Array.from(form.querySelectorAll('.step-dot'));
    const serviceInput = document.getElementById('serviceInput');
    const successPanel = document.getElementById('formSuccess');
    const successMessage = document.getElementById('successMessage');
    let currentStep = 1;

    const showStep = (n) => {
      currentStep = n;
      steps.forEach((step) => {
        step.classList.toggle('active', Number(step.dataset.step) === n);
      });
      dots.forEach((dot) => {
        const dotStep = Number(dot.dataset.dot);
        dot.classList.toggle('active', dotStep === n);
        dot.classList.toggle('completed', dotStep < n);
      });
    };

    const validateStep = (n) => {
      const step = steps.find((s) => Number(s.dataset.step) === n);
      const fields = step.querySelectorAll('input, select, textarea');
      for (const field of fields) {
        if (!field.checkValidity()) {
          field.reportValidity();
          return false;
        }
      }
      return true;
    };

    // Step 1: service selection auto-advances
    form.querySelectorAll('.service-option').forEach((option) => {
      option.addEventListener('click', () => {
        form.querySelectorAll('.service-option').forEach((o) => o.classList.remove('selected'));
        option.classList.add('selected');
        serviceInput.value = option.dataset.value;
        setTimeout(() => showStep(2), 220);
      });
    });

    form.querySelectorAll('.next-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (validateStep(currentStep)) showStep(currentStep + 1);
      });
    });

    form.querySelectorAll('.back-btn').forEach((btn) => {
      btn.addEventListener('click', () => showStep(currentStep - 1));
    });

    // Endpoint and phone come from _data/business.yml via the form's
    // action and data-phone attributes, so there's nothing to edit here.
    const leadEndpoint = form.getAttribute('action');
    const phoneDisplay = form.dataset.phone;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validateStep(3)) return;

      const data = Object.fromEntries(new FormData(form).entries());
      const submitBtn = form.querySelector('[data-step="3"] .next-btn, [data-step="3"] button[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending...'; }

      try {
        const res = await fetch(leadEndpoint, {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: new FormData(form),
        });

        if (!res.ok) throw new Error('Form submission failed');

        steps.forEach((step) => step.classList.remove('active'));
        form.querySelector('.form-progress').style.display = 'none';
        successMessage.textContent = `Thanks, ${data.name.split(' ')[0]} — a local fencing pro will reach out to you at ${data.phone} within 24 hours.`;
        successPanel.hidden = false;
      } catch (err) {
        console.error('Lead submission error:', err);
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Get My Free Quote'; }
        alert(`Something went wrong sending your request. Please call ${phoneDisplay} directly and we'll get you a quote right away.`);
      }
    });
  }
})();
